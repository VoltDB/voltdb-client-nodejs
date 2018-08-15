/* This file is part of VoltDB.
 * Copyright (C) 2008-2018 VoltDB Inc.
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

var EventEmitter = require("events").EventEmitter, 
  Socket = require("net").Socket,
  crypto = require("crypto"),
  util = require("util"),
  VoltConstants = require("./voltconstants");

const debug = require("debug")("voltdb-client-nodejs:VoltConnection");
const { Message, LoginMessage, QueryMessage } = require("./message");

function VoltMessageManager(configuration) {
  EventEmitter.call(this);
  this.uid = configuration.uid || null;
  this.message = configuration.message || null;
  this.error = false;
  this.time = null;
  this.index = -1;
}

util.inherits(VoltMessageManager, EventEmitter);


function VoltConnection(configuration, id) {
  EventEmitter.call(this);
  this.config = configuration;
  this.id = id;

  this.onConnect = this.onConnect.bind(this);
  this.onError = this.onError.bind(this);
  this.onRead = this.onRead.bind(this);
  this.onReconnect = () => null;
  this._send = this._send.bind(this);
  this._flush = this._flush.bind(this);
  this.isValidConnection = this.isValidConnection.bind(this);
  this.isBlocked = this.isBlocked.bind(this);
  this._checkQueryTimeout = this._checkQueryTimeout.bind(this);
  this._manageOustandingQueries = this._manageOustandingQueries.bind(this);

  this.isWritable = true;
  this.isLoggedIn = false;
  this._sendQueue = [];
  this._syncSendQueue = [];
  this._calls = {};
  this._callIndex = [];
  this._id = 0;
  this._overflow = new Buffer(0);
  this.sendCounter = 0;
  this.timeout = 0;
  this.invocations = 0;
  this.validConnection = true;
  this.blocked = false;
  this.loginError = null;

  this.outstandingQueryManager = null;
  this.flusher = null;
}

util.inherits(VoltConnection, EventEmitter);

VoltConnection.prototype.initSocket = function(socket, resolve) {
  this.socket = socket;

  this.socket.on("error", (e,m,s) => {
    if ( this.socket.destroyed ) this.close();

    this.validConnection = false;
    this.isLoggedIn = false;

    if ( resolve ){
      let loginStatus = VoltConstants.SOCKET_ERRORS[e.code];
      this.loginError = VoltConstants.LOGIN_STATUS[loginStatus];

      resolve(this);
      resolve=undefined; //only once will be called

      if ( loginStatus !== VoltConstants.SOCKET_ERRORS.HOST_UNKNOWN && this.config.reconnectInterval > 0){
        /**
         * This will call reconnect() that will call connect() that will call again to 
         * this function to set this up if it fails again.
         */
        setTimeout( () => this.reconnect(), this.config.reconnectInterval );
      }
      
    } else {
      this.onError(e,m,s);
    }
  });

  this.socket.on("data", buffer => {
    this.onRead(buffer, resolve);
  });

  this.socket.on("connect", this.onConnect);
};

VoltConnection.prototype.reconnect = function(){
  if ( !this.validConnection ){
    this.connect().then(
      () => this.validConnection ? this.onReconnect(this) : null 
    );
  }
};

VoltConnection.prototype.connect = function() {

  return new Promise( (resolve) => {
    this.initSocket(new Socket(), resolve);
    this.socket.connect(this.config.port, this.config.host);
    this.outstandingQueryManager = setInterval(this._manageOustandingQueries, this.config.queryTimeoutInterval);
    this.flusher = setInterval(this._flush, this.config.flushInterval);
  });
};

VoltConnection.prototype.isValidConnection = function() {
  return this.validConnection;
};

VoltConnection.prototype.isBlocked = function() {
  return this.blocked;
};

// Deprecating call in favor of callProcedure
VoltConnection.prototype.call = function(query, writeCallback) {
  return this.callProcedure(query, writeCallback);
};

VoltConnection.prototype.callProcedure = function(query) {
  this.invocations++;

  var uid = this._getUID();
  query.setUID(uid);

  const vmm = new VoltMessageManager({
    message: query.getMessage(),
    uid: uid
  });

  const onQueryAllowed = new Promise( (resolve) => {
    vmm.on(VoltConstants.SESSION_EVENT.QUERY_ALLOWED, (code, event, results) => resolve({ code, event, results }));
  });

  const read = new Promise ( (resolve,reject) => {
    vmm.on(VoltConstants.SESSION_EVENT.QUERY_RESPONSE, (code, event, results) => resolve({ code, event, results }));
    vmm.on(VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR, (code, event, results) => reject({ code, event, results }));
      
    try {
      const error = this._send(vmm, true);
      if ( error ) reject(error);
    } catch (error) {
      console.log("Error", error);
      reject(error);
    }
  });

  return { read, onQueryAllowed };
};

VoltConnection.prototype._getUID = function() {
  var id = String(this._id < 99999999 ? this._id++ : this._id = 0);
  var uid = this._zeros(8 - id.length).join("") + id;
  return uid;
};

VoltConnection.prototype._zeros = function(num) {
  var arr = new Array(num);
  for(var i = 0; i < num; i++) {
    arr[i] = 0;
  }
  return arr;
};

VoltConnection.prototype.close = function(callback) {

  debug("Closing");

  if(this.outstandingQueryManager) clearInterval(this.outstandingQueryManager);
  if(this.flusher) clearInterval(this.flusher);

  if(this.socket) this.socket.end();

  this.validConnection = false;
  this.isLoggedIn = false;

  if(callback) callback();
};

VoltConnection.prototype.onConnect = function() {
  var hashAlgorithm = crypto.createHash(this.config.hashAlgorithm);

  hashAlgorithm.update(this.config.password);
  var password = new Buffer(hashAlgorithm.digest("base64"), "base64");

  var message = this._getLoginMessage(password);

  // you must connect and send login credentials immediately.
  var vmm = new VoltMessageManager({
    message: message,
    uid: this._getUID()
  });
  
  const err = this._send(vmm, false);

  if (err){
    this.emit( err.event,
      err.code,
      err.event,
      err.results
    );
  }
};

VoltConnection.prototype.onError = function(error) {
  this.emit(
    VoltConstants.SESSION_EVENT.CONNECTION_ERROR,
    error,
    VoltConstants.STATUS_CODE_STRINGS[VoltConstants.STATUS_CODES.CONNECTION_LOST],
    this);
};

VoltConnection.prototype.onRead = function(buffer, resolveConnect) {
  var results = null;

  if(this.isLoggedIn == false) {
    results = this._decodeLoginResult(buffer);

    if ( results.error ) {
      this.validConnection = false;
      this.isLoggedIn = false;
      this.loginError = results.status;

      return resolveConnect(this);
    }

    this.isLoggedIn = true;
    this.validConnection = true;

    if ( resolveConnect ) resolveConnect(this);

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

        if(this.blocked) {
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
};

VoltConnection.prototype._send = function(vmm, track) {
  try {
    if(track) {
      this._calls[vmm.uid] = vmm;
      this._callIndex.push(vmm.uid);
      vmm.time = Date.now();
    }

    this._queue(vmm.message.toBuffer(), track);
    this.sendCounter++;

    if( !this.blocked ) {
      this._invokeWriteEventHandler(vmm);
    }
  } catch (err) {
    this.validConnection = false;

    return {
      code: VoltConstants.STATUS_CODES.UNEXPECTED_FAILURE, 
      event: VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR,
      results: err.message
    };
  }
};

VoltConnection.prototype._queue = function(buffer, track) {
  this._sendQueue.push(buffer);

  if(!track || this._sendQueue.length > this.config.messageQueueSize) {
    this._flush();
  }
};

VoltConnection.prototype._flush = function() {
  debug("Flushing | Send Queue Length: %o", this._sendQueue.length);

  var bytes = this._sendQueue.reduce(function(bytes, buffer) {
    return bytes + buffer.length;
  }, 0);
  var combined = new Buffer(bytes);

  this._sendQueue.reduce(function(offset, buffer) {
    buffer.copy(combined, offset);
    return offset + buffer.length;
  }, 0);

  try {
    debug("Socket closed ? ", this.socket);

    this.socket.write(combined);
  } catch (err) {
    debug("Socket Write Error | ", err);

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
};

VoltConnection.prototype._getLoginMessage = function(password) {

  var message = new Message();
  message.writeString(this.config.service);
  message.writeString(this.config.username);
  message.writeBinary(password);
  message.type = VoltConstants.MESSAGE_TYPE.LOGIN;
  return message;
};

VoltConnection.prototype._decodeLoginResult = function(buffer) {
  return new LoginMessage(buffer);
};

VoltConnection.prototype._decodeQueryResult = function(buffer) {
  return new QueryMessage(buffer);
};

VoltConnection.prototype._manageOustandingQueries = function() {
  const tmpCallIndex = [];
  const time = Date.now();
  let uid = this._callIndex.pop();

  while( uid ) {
    let vmm = this._calls[uid];

    if(vmm && this._checkQueryTimeout(vmm, time) == false) {
      tmpCallIndex.push(vmm.uid);
    }

    uid = this._callIndex.pop();
  }
  this._callIndex = tmpCallIndex;
};

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
          statusString : "Query timed out before server responded"
        });

      vmm.emit(VoltConstants.SESSION_EVENT.QUERY_ALLOWED,
        VoltConstants.STATUS_CODES.SUCCESS,
        VoltConstants.SESSION_EVENT.QUERY_ALLOWED,
        null);
      delete this._calls[vmm.uid];
    }
  }

  return queryInvalidated;
};

module.exports = VoltConnection;
