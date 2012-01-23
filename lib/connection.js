/* This file is part of VoltDB.
 * Copyright (C) 2008-2012 VoltDB Inc.
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

var EventEmitter = require('events').EventEmitter; 
Socket = require('net').Socket;
crypto = require('crypto');
util = require('util');
Message = require('./message').Message;

var VoltProcedure = require('./query');
var VoltQuery = require('./query');

VoltMessageManager = function() {}
VoltMessageManager.prototype = Object.create({
    uid: null,
    readCallback : readCallbackStub = function (){},
    writeCallback : writeCallbackStub = function (){},
    message: null,
    retries: 10,
    timerId: -1
});

var vmm = VoltMessageManager.prototype;
vmm.hasReadCallback = function() {
    return this._isValid(this.readCallback);    
}

vmm.hasWriteCallback = function() {
    return this._isValid(this.writeCallback);    
}

vmm._isValid = function(obj) {
    return obj != null && typeof obj != 'undefined';
} 

VoltConnection = function(configuration) {
    EventEmitter.call(this);
    this.config = configuration;

    this.onConnect = this.onConnect.bind(this);
    this.onError = this.onError.bind(this);
    this.onRead = this.onRead.bind(this);
    this._send = this._send.bind(this);
    this.isValidConnection = this.isValidConnection.bind(this);
    this.isBlocked = this.isBlocked.bind(this);
    this._handleQueryTimeout = this._handleQueryTimeout.bind(this);

    this.socket = new Socket();
    this.socket.setNoDelay();
    this.socket.on('error', this.onError);
    this.socket.on('data', this.onRead);
    this.socket.on('connect', this.onConnect);

    this.isWritable = true;
    this.isLoggedIn = false;
    this.connectionCallback = null;

    this._calls = [];
    this._id = 0;
    this._overflow = new Buffer(0);
    this.sendCounter = 0;
    this.timeout = 0;
    this.invocations = 0;
    this.validConnection = true;
    this.blocked = false;
}

util.inherits(VoltConnection, EventEmitter);

var con = VoltConnection.prototype;

con.connect = function(callback) {
    this.socket.connect(this.config.port, this.config.host);
    this.connectionCallback = callback;    
}

con.isValidConnection = function() {
    return this.validConnection;
}

con.isBlocked = function() {
    return this.blocked;
}

con.call = function(query, readCallback, writeCallback) {
    this.invocations++;
    
    var uid = this._getUID();
    query.setUID(uid);
    
    var vmm = new VoltMessageManager();
    vmm.readCallback = readCallback;
    vmm.writeCallback = writeCallback;
    vmm.message = query.getMessage();
    vmm.uid = uid;
    this._calls[uid] = vmm;

    return this._send(vmm);
}

con._getUID = function() {
    var id = String(this._id < 0xFFFFFFFF ? this._id++ : this._id = 0);
    var uid = this._zeros(8 - id.length).join('') + id;
    return uid;
}

con._zeros = function(num) {
    var arr = new Array(num);
    for(var i = 0; i < num; i++)
    arr[i] = 0;
    return arr;
}

con.close = function(callback) {
    this.socket.end();
}

con.onConnect = function(results) {

    var service = this.config.service;
    var sha1 = crypto.createHash('sha1');
    sha1.update(this.config.password);
    var password = new Buffer(sha1.digest('binary'), 'binary');

    var message = this._getLoginMessage(password);

    // you must connect and send login credentials immediately.
    var vmm = new VoltMessageManager();
    vmm.message = message;
    vmm.uid = this._getUID();
    this._send(vmm);
}

con.onError = function(results) {
    console.log('error', results);
    this.connectionCallback(results);
}

con.onRead = function(buffer) {
    var results = null;

    if(this.isLoggedIn == false) {
        results = this._decodeLoginResult(buffer);
        
        this.connectionCallback(results);
        this.isLoggedIn = true;
        this.validConnection = true;
        
    } else {

        var overflow = this._overflow;
        var data = new Buffer(overflow.length + buffer.length);
        var length;

        overflow.copy(data, 0);
        buffer.copy(data, overflow.length, 0);
        while(data.length > 4 
            && data.length >= ( length = Message.readInt(data) + 4)) {
            
            var msg = data.slice(0, length);
            data = data.slice(length);
            results = this._decodeQueryResult(msg);
            
            var vmm = this._calls[results.uid];
            if(vmm != null && typeof vmm != 'undefined') {
                this.sendCounter--;
                clearTimeout(vmm.timerId);
                if (  vmm.hasReadCallback() == true ) {
                    vmm.readCallback(results);
                }
                
                // when to allow more writes.
                if ( this.blocked == true) {
                    this.blocked = false;
                    this._invokeWriteCallback(vmm);
                }
                delete this._calls[results.uid];
            } else {
                console.log('vmm was not valid');
            }
        }
        this._overflow = data;
    }
}

con._send = function(vmm) {
    var result = true;
    try {
        var success = this.socket.write(vmm.message.toBuffer());
        if(success === false ) {
            if ( vmm.retries > 0 ) {
                console.log("Socket could not be written to", this.sendCounter);
                vmm.retries--;
                setTimeout(this._send, 100, vmm);
            } else if ( vmm.retries < 1 ) {
                console.log("Message could note be " 
                    + " dispatched and retries failed"); 
                // should throw error
            }
        } else {
            vmm.timerId = setTimeout(this._handleQueryTimeout ,
                this.config.queryTimeout,vmm);
            this.sendCounter++;
            if ( this.blocked == false ) {
                this._invokeWriteCallback(vmm);
            }
        }
    } catch (err) {
        console.log(err);
        this.validConnection = false;
        result = false;
    }
    return result;
}



con._invokeWriteCallback = function(vmm) {
    // only allow more writes if the queue has not breached a limit
    if(this.sendCounter < 5000) {
        this.blocked = false;
        if ( vmm!= null && vmm.hasWriteCallback() ) {
            vmm.writeCallback();
        }
    } else {
        this.blocked = true;
    }
}

con._getLoginMessage = function(password) {

    var message = new Message();
    message.writeString(this.config.service);
    message.writeString(this.config.username);
    message.writeBinary(password);
    return message;
}

con._decodeLoginResult = function(buffer) {
    return new LoginMessage(buffer);
}

con._decodeQueryResult = function(buffer) {
    return new QueryMessage(buffer);
}

con._handleQueryTimeout = function(vmm) {
    if ( vmm != null && typeof vmm != 'undefined' && vmm.uid != null 
        && typeof vmm.uid != 'undefined') {
        this.sendCounter--;
        if ( vmm.hasReadCallback() == true ) {
            vmm.readCallback({error: true,  
                status: -6, 
                statusString: 'Query timed out before server responded'});
        }
        
        if ( vmm.hasWriteCallback() == true ) {
            this.blocked = false;
            vmm.writeCallback();
        }
        console.log(this.config.host, 'Timeout on call: ', vmm.uid);
        delete this._calls[vmm.uid];
    }
}

module.exports = VoltConnection;
