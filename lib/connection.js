/* This file is part of VoltDB.
 * Copyright (C) 2008-2017 VoltDB Inc.
 *
 * This file contains original code and/or modifications of original code.
 * Any modifications made by VoltDB Inc. are licensed under the following
 * terms and conditions:
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
 * OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

var EventEmitter = require('events').EventEmitter, 
Socket = require('net').Socket,
crypto = require('crypto'),
util = require('util'),
Message = require('./message').Message,
VoltConstants = require('./voltconstants');

function VoltMessageManager(configuration) {
  EventEmitter.call(this);
  this.uid = configuration.uid || null;
  this.message = configuration.message || null;
  this.error = false;
  this.time = null;
  index = -1;
}

util.inherits(VoltMessageManager, EventEmitter);


function VoltConnection(configuration) {
  EventEmitter.call(this);
  this.config = configuration;

  this.onConnect = this.onConnect.bind(this);
  this.onError = this.onError.bind(this);
  this.onRead = this.onRead.bind(this);
  this._send = this._send.bind(this);
  this._flush = this._flush.bind(this);
  this.isValidConnection = this.isValidConnection.bind(this);
  this.isBlocked = this.isBlocked.bind(this);
  this._checkQueryTimeout = this._checkQueryTimeout.bind(this);
  this._manageOustandingQueries = this._manageOustandingQueries.bind(this);

  this.isWritable = true;
  this.isLoggedIn = false;
  this._sendQueue = [];
  this._calls = {};
  this._callIndex = [];
  this._id = 0;
  this._overflow = new Buffer(0);
  this.sendCounter = 0;
  this.timeout = 0;
  this.invocations = 0;
  this.validConnection = true;
  this.blocked = false;
  
}

util.inherits(VoltConnection, EventEmitter);

VoltConnection.prototype.initSocket = function(socket) {
  this.socket = socket;
  this.socket.on('error', this.onError);
  this.socket.on('data', this.onRead);
  this.socket.on('connect', this.onConnect);
}


VoltConnection.prototype.connect = function() {
  this.initSocket(new Socket())
  this.socket.connect(this.config.port, this.config.host);
  setInterval(this._manageOustandingQueries, this.config.queryTimeoutInterval);
  setInterval(this._flush, this.config.flushInterval);
}

VoltConnection.prototype.isValidConnection = function() {
  return this.validConnection;
}

VoltConnection.prototype.isBlocked = function() {
  return this.blocked;
}


// Deprecating call in favor of callProcedure
VoltConnection.prototype.call = function(query, readCallback, writeCallback) {
  return this.callProcedure(query, readCallback, writeCallback);
}

VoltConnection.prototype.callProcedure = function(query, readCallback, writeCallback) {
  this.invocations++;

  var uid = this._getUID();
  query.setUID(uid);

  var vmm = new VoltMessageManager({
    message: query.getMessage(),
    uid: uid});
    
    if (readCallback) {
      vmm.on(VoltConstants.SESSION_EVENT.QUERY_RESPONSE, readCallback);
      vmm.on(VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR, readCallback);
    }
    
    if ( writeCallback ) {
      vmm.on(VoltConstants.SESSION_EVENT.QUERY_ALLOWED, writeCallback);
    }
  return this._send(vmm, true);
}



VoltConnection.prototype._getUID = function() {
  var id = String(this._id < 99999999 ? this._id++ : this._id = 0);
  var uid = this._zeros(8 - id.length).join('') + id;
  return uid;
}

VoltConnection.prototype._zeros = function(num) {
  var arr = new Array(num);
  for(var i = 0; i < num; i++) {
    arr[i] = 0;
  }
  return arr;
}

VoltConnection.prototype.close = function(callback) {
  this.socket.end();
}

VoltConnection.prototype.onConnect = function(results) {
  var service = this.config.service;
  var sha1 = crypto.createHash('sha1');
  sha1.update(this.config.password);
  var password = new Buffer(sha1.digest('base64'), 'base64');

  var message = this._getLoginMessage(password);

  // you must connect and send login credentials immediately.
  var vmm = new VoltMessageManager({
    message: message,
    uid: this._getUID()
  });
  
  this._send(vmm, false);
}

VoltConnection.prototype.onError = function(results) {
  this.emit(
    VoltConstants.SESSION_EVENT.CONNECTION,
    VoltConstants.STATUS_CODES.UNEXPECTED_FAILURE,
    VoltConstants.SESSION_EVENT.CONNECTION,
    this);
}

VoltConnection.prototype.onRead = function(buffer) {
  var results = null;

  if(this.isLoggedIn == false) {
    results = this._decodeLoginResult(buffer);
    this.isLoggedIn = true;
    this.validConnection = true;
    this.emit(VoltConstants.SESSION_EVENT.CONNECTION, 
      VoltConstants.STATUS_CODES.SUCCESS, 
      VoltConstants.SESSION_EVENT.CONNECTION,
      this);
  } else {

    var overflow = this._overflow;
    var data = new Buffer(overflow.length + buffer.length);
    var length;

    overflow.copy(data, 0);
    buffer.copy(data, overflow.length, 0);
    while(data.length > 4 && data.length >= ( length = Message.readInt(data) + 4)) {

      var msg = data.slice(0, length);
      data = data.slice(length);
      results = this._decodeQueryResult(msg);

      var vmm = this._calls[results.uid];
      if(vmm) {
        delete this._calls[results.uid];
        this.sendCounter--;
        vmm.emit(VoltConstants.SESSION_EVENT.QUERY_RESPONSE,
           VoltConstants.STATUS_CODES.SUCCESS, 
           VoltConstants.SESSION_EVENT.QUERY_RESPONSE, 
           results);

        if(this.blocked == true) {
            this.blocked = false;
            this._invokeWriteEventHandler(vmm);
        }
        
      } else {
        this.emit(
          VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR, 
          VoltConstants.STATUS_CODES.QUERY_TOOK_TOO_LONG, 
          VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR,
          "Query completed after an extended period but query manager was deleted" );
      }
    }
    this._overflow = data;
  }
}

VoltConnection.prototype._send = function(vmm, track) {
  var results = true;
  try {
    if(track == true) {
      this._calls[vmm.uid] = vmm;
      this._callIndex.push(vmm.uid);
      vmm.time = Date.now();
    }

    this._queue(vmm.message.toBuffer(), track);

    this.sendCounter++;

    if(this.blocked == false) {
      this._invokeWriteEventHandler(vmm);
    }
  } catch (err) {
    this.emit(VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR, 
      VoltConstants.STATUS_CODES.UNEXPECTED_FAILURE, 
      VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR,
      err.message);
    this.validConnection = false;
    results = false;
  }
  return results;
}

VoltConnection.prototype._queue = function(buffer, track) {
  this._sendQueue.push(buffer);

  if(!track || this._sendQueue.length > this.config.messageQueueSize) {
    this._flush();
  }
};

VoltConnection.prototype._flush = function() {
  var bytes = this._sendQueue.reduce(function(bytes, buffer) {
    return bytes + buffer.length;
  }, 0);
  var combined = new Buffer(bytes);

  this._sendQueue.reduce(function(offset, buffer) {
    buffer.copy(combined, offset);
    return offset + buffer.length;
  }, 0);

  try {
    this.socket.write(combined);
  } catch (err) {
    this.emit(VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR,
      VoltConstants.STATUS_CODES.UNEXPECTED_FAILURE, 
      VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR,
      err.message 
      + ": Connection dropped to server while dispatching query. Is VoltDB Server up?");
      throw err;
  }

  this._sendQueue = [];
};

VoltConnection.prototype._invokeWriteEventHandler = function(vmm) {
  // only allow more writes if the queue has not breached a limit
  if(this.sendCounter < this.config.maxConsecutiveWrites ) {
    this.blocked = false;
    vmm.emit(VoltConstants.SESSION_EVENT.QUERY_ALLOWED,
      VoltConstants.STATUS_CODES.SUCCESS,
      VoltConstants.SESSION_EVENT.QUERY_ALLOWED,
      null);
  } else {
    this.blocked = true;
  }
}

VoltConnection.prototype._getLoginMessage = function(password) {

  var message = new Message();
  message.writeString(this.config.service);
  message.writeString(this.config.username);
  message.writeBinary(password);
  message.type = VoltConstants.MESSAGE_TYPE.LOGIN;
  return message;
}

VoltConnection.prototype._decodeLoginResult = function(buffer) {
  return new LoginMessage(buffer);
}

VoltConnection.prototype._decodeQueryResult = function(buffer) {
  return new QueryMessage(buffer);
}

VoltConnection.prototype._manageOustandingQueries = function() {
  var tmpCallIndex = [];
  var time = Date.now();
  var uid = null;
  while( uid = this._callIndex.pop()) {
    vmm = this._calls[uid];
    if(vmm && this._checkQueryTimeout(vmm, time) == false) {
      tmpCallIndex.push(vmm.uid);
    }
  }
  this._callIndex = tmpCallIndex;
}

VoltConnection.prototype._checkQueryTimeout = function(vmm, time) {
  var queryInvalidated = false;
  if(vmm) {
    if(time - vmm.time > this.config.queryTimeout) {
      queryInvalidated = true;
      this.sendCounter--;
      vmm.emit(VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR,
        VoltConstants.STATUS_CODES.QUERY_TOOK_TOO_LONG,
        VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR,
        {error : true,
          status : VoltConstants.STATUS_CODES.CONNECTION_TIMEOUT,
          statusString : 'Query timed out before server responded'
       });

      vmm.emit(VoltConstants.SESSION_EVENT.QUERY_ALLOWED,
        VoltConstants.STATUS_CODES.SUCCESS,
        VoltConstants.SESSION_EVENT.QUERY_ALLOWED,
        null);
      delete this._calls[vmm.uid];
    }
  }

  return queryInvalidated;
}

module.exports = VoltConnection;
