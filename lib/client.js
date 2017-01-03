/* This file is part of VoltDB.
 * Copyright (C) 2008-2017 VoltDB Inc.
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
util = require('util'),
VoltConnection = require('./connection'),
VoltConstants = require('./voltconstants');

VoltClient = function(configuration) {
  EventEmitter.call(this);

  this.config = configuration;

  this.connect = this.connect.bind(this);
  this._getConnections = this.connect.bind(this);
  this.call = this.call.bind(this);
  this.callProcedure = this.callProcedure.bind(this);
  this.exit = this.connect.bind(this);
  this.connectionStats = this.connectionStats.bind(this);
  
  this._connectListener = this._connectListener.bind(this);
  this._connectErrorListener=this._connectErrorListener.bind(this);
  this._queryResponseListener=this._queryResponseListener.bind(this);
  this._queryResponseErrorListener=this._queryResponseErrorListener.bind(this);
  this._queryDispatchErrorListener=this._queryDispatchErrorListener.bind(this);
  this._fatalErrorListener=this._fatalErrorListener.bind(this);
  
  this._connections = [];
  this._badConnections = [];
  this._connectionCounter = 0;
}

util.inherits(VoltClient, EventEmitter);

VoltClient.prototype.connect = function(callback) {
  var self = this;

  var connectionCount = this.config.length;
  var connectionResults = [];
  for(var index = 0; index < this.config.length; index++) {
    var con = new VoltConnection(this.config[index]);
    
    con.on(VoltConstants.SESSION_EVENT.CONNECTION,this._connectListener);
    con.on(VoltConstants.SESSION_EVENT.CONNECTION, callback);
    con.on(VoltConstants.SESSION_EVENT.CONNECTION_ERROR, callback);
    con.on(VoltConstants.SESSION_EVENT.QUERY_RESPONSE,this._queryResponseListener);
    con.on(VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR,this._queryResponseErrorListener);
    con.on(VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR,this._queryDispatchErrorListener);
    con.on(VoltConstants.SESSION_EVENT.FATAL_ERROR,this._fatalErrorListener);
    
    con.connect();
  }
}

VoltClient.prototype._getConnection = function(callback) {
  var length = this._connections.length;
  var connection = null;
  for(var index = 0; index < length; index++) {

    // creates round robin
    this._connectionCounter++;
    if(this._connectionCounter >= length) {
      this._connectionCounter = 0;
    }
    connection = this._connections[this._connectionCounter];
    // validates that the connection is good and not blocked on reads
    if(connection == null || connection.isValidConnection() == false) {
      this._badConnections.push(connection);
      this._connections[this._connectionCounter] = null;
    } else if(connection.isBlocked() == false) {
      break;
    }
  }
  return connection;
}

VoltClient.prototype.callProcedure = function(query, readCallback, writeCallback) {
 var con = this._getConnection();
  if(con) {
    if(con.callProcedure(query, readCallback, writeCallback) == false) {
      this.emit(VoltConstants.SESSION_EVENT.CONNECTION_ERROR,
        VoltConstants.STATUS_CODES.CONNECTION_TIMEOUT,
        VoltConstants.SESSION_EVENT.CONNECTION_ERROR,
        'Invalid connection in connection pool');
    }

  } else {
    this.emit(VoltConstants.SESSION_EVENT.CONNECTION_ERROR,
      VoltConstants.STATUS_CODES.CONNECTION_TIMEOUT,
      VoltConstants.SESSION_EVENT.CONNECTION_ERROR,
      'No valid VoltDB connections, verify that the database is online');
  }
}

VoltClient.prototype.call = function(query, readCallback, writeCallback) {
  this.callProcedure(query, readCallback, writeCallback);
}

VoltClient.prototype.exit = function(callback) {
}

VoltClient.prototype.connectionStats = function() {
  util.log('Good connections:');
  this._displayConnectionArrayStats(this._connections);

  util.log('Bad connections:');
  this._displayConnectionArrayStats(this._badConnections);
}

VoltClient.prototype._displayConnectionArrayStats = function(array) {
  for(var index = 0; index < array.length; index++) {
    var connection = array[index];
    if(connection != null) {
      util.log('Connection: ', 
      connection.config.host, ': ', 
      connection.invocations, ' Alive: ', 
      connection.isValidConnection());
    }
  }
}

VoltClient.prototype._connectListener = function(code, event, connection) {

  if ( VoltConstants.STATUS_CODES.SUCCESS == code) {
    this._connections.push(connection);
  }
  
  this.emit(VoltConstants.SESSION_EVENT.CONNECTION, 
    code, 
    event,
    connection.config.host);
}

VoltClient.prototype._connectErrorListener = function(code, event, message) {
  this.emit(VoltConstants.SESSION_EVENT.CONNECTION_ERROR, 
    code,
    event,
    message);
}

VoltClient.prototype._queryResponseListener = function(code,event, message) {
  this.emit(VoltConstants.SESSION_EVENT.QUERY_RESPONSE, 
    code,
    event,
    message);
}

VoltClient.prototype._queryResponseErrorListener = function(code, event, message) {
  this.emit(VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR, 
    code,
    event,
    message);
}

VoltClient.prototype._queryDispatchErrorListener = function(code, event, message) {
  this.emit(VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR, 
    code,
    event,
    message);
}

VoltClient.prototype._fatalErrorListener = function(code, event, message) {
  this.emit(VoltConstants.SESSION_EVENT.FATAL_ERROR, 
    code,
    event, 
    message);
}

module.exports = VoltClient;
