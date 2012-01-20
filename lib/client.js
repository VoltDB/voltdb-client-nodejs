/* This file is part of VoltDB.
 * Copyright (C) 2008-2012 VoltDB Inc.
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

var EventEmitter = require('events').EventEmitter;
var VoltConnection = require('./connection');

VoltClient = function (configuration) {
	EventEmitter.call(this);
	
	this.config = configuration;
	
	this.connect = this.connect.bind(this);
	this._getConnections = this.connect.bind(this);
	this.call = this.call.bind(this);
	this.exit = this.connect.bind(this);
	this.connectionStats = this.connectionStats.bind(this);
	
	this._connections = [];
	this._badConnections = [];
	this._connectionCounter = 0;
}

VoltClient.prototype = Object.create(EventEmitter.prototype);

var vc = VoltClient.prototype;

vc.connect = function (callback) {
    var self = this;
    for ( var index = 0; index < this.config.length; index++ ) {
        var con = new VoltConnection(this.config[index]);
    	con.connect(function _onConnect(results) {
    		self._connections.push(this);
    		callback(results);
    	});
	}
}

vc._getConnection = function (username, password, callback) {
    var length = this._connections.length;
    var connection = null;
    for ( var index = 0; index < length; index++) {
        
        // creates round robin
        this._connectionCounter++;
        if ( this._connectionCounter >= length ) {
            this._connectionCounter = 0;
        }
        
        connection = this._connections[this._connectionCounter];
        // validates that the connection is good and not blocked on reads
        if ( connection == null || connection.isValidConnection() == false ) {
                //console.log('connection died: ', connection, this._connectionCounter, length);
                this._badConnections.push(connection);
                this._connections[this._connectionCounter] = null;
        } else if ( connection.isBlocked() == false ) {
            break;
        }
    }
    //console.log('returning', connection.config.host);
    return connection;
}

vc.call = function(query, readCallback, writeCallback ) {
    var con = this._getConnection();
    if ( con != null ) {
        if ( con.call(query,readCallback, writeCallback) == false ) {
            console.log(con.config.host, ' was lost');
            this.call(query, readCallback, writeCallback);
        }
        
    } else {
        console.log('Something terrible happened');
    }
}

vc.exit = function(callback) {
}

vc.connectionStats = function() {
    console.log('Good connections:');
    this._displayConnectionArrayStats(this._connections);
    
    console.log('Bad connections:');
    this._displayConnectionArrayStats(this._badConnections);
}

vc._displayConnectionArrayStats = function(array) {
    for ( var index = 0; index < array.length; index++) {
        var connection = array[index];
        if ( connection != null ) {
            console.log('Connection: ', connection.config.host, ': ', connection.invocations, ' Alive: ', connection.isValidConnection());
        }
    }
}

module.exports = VoltClient;