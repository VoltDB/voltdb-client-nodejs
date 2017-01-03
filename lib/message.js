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
var Parser = require('./parser').Parser,
util = require('util'),
PRESENT = require('./voltconstants').PRESENT,
MESSAGE_TYPE = require('./voltconstants').MESSAGE_TYPE,
STATUS_CODE_STRINGS = require('./voltconstants').STATUS_CODE_STRINGS,
STATUS_CODES = require('./voltconstants').STATUS_CODES;

function Message(buffer) {
  this.type = MESSAGE_TYPE.UNDEFINED;
  this.error = false;
  Parser.call(this, buffer);
  if(!buffer) {
    this.writeInt(0);
    this.writeByte(0);
  } else {
    this.readHeader();
  }
}

Message.prototype = Object.create(Parser.prototype);

Message.prototype.readHeader = function() {
  this.length = this.readInt();
  this.protocol = this.readByte();
};

Message.prototype.writeHeader = function() {
  var pos = this.position;
  this.position = 0;
  this.writeInt(this.buffer.length - 4);
  this.writeByte(0);
  this.position = pos;
};

Message.prototype.toBuffer = function() {
  this.writeHeader();
  return new Buffer(this.buffer);
};
// for getting lengths from incoming data
Message.readInt = function(buffer, offset) {
  return Parser.readInt(buffer, offset);
};
LoginMessage = function(buffer) {
  Message.call(this, buffer);
  this.type = MESSAGE_TYPE.LOGIN;
  this.status = this.readByte();
  this.error = (this.status === 0 ? false : true );
  if(this.error === false) {
    this.serverId = this.readInt();
    this.connectionId = this.readLong();
    this.clusterStartTimestamp = new Date(parseInt(this.readLong().toString()));
    // not microseonds, milliseconds
    this.leaderIP = this.readByte() + '.' + this.readByte() + '.' + this.readByte() + '.' + this.readByte();
    this.build = this.readString();
  }
}

util.inherits(LoginMessage, Message);

var lm = LoginMessage.prototype;
lm.toString = function() {
  return {
    length : this.length,
    protocol : this.protocol,
    status : this.status,
    error : this.error,
    serverId : this.serverId,
    connectionId : this.connectionId,
    clusterStartTimestamp : this.clusterStartTimestamp,
    leaderIP : this.leaderIP,
    build : this.build
  };
}
QueryMessage = function(buffer) {
  Message.call(this, buffer);
  this.type = MESSAGE_TYPE.QUERY;

  this.uid = this.readBinary(8).toString();
  this.fieldsPresent = this.readByte();
  // bitfield, use PRESENT values to check
  this.status = this.readByte();
  this.statusString = STATUS_CODE_STRINGS[this.status];
  if(this.fieldsPresent & PRESENT.STATUS) {
    this.statusString = this.readString();
  }
  this.appStatus = this.readByte();
  this.appStatusString = '';
  if(this.fieldsPresent & PRESENT.APP_STATUS) {
    this.appStatusString = this.readString();
  }
  this.exception
  this.exceptionLength = this.readInt();
  if(this.fieldsPresent & PRESENT.EXCEPTION) {
    this.exception = this.readException(1);
    // seems size doesn't matter, always 1
  } else {
    // don't parse the rest if there was an exception. Bad material there.
    var resultCount = this.readShort();
    // there can be more than one table with rows
    this.table = new Array(resultCount);
    for(var i = 0; i < resultCount; i++) {
      this.table[i] = this.readVoltTable();
    }

  }
}

util.inherits(QueryMessage, Message);

var qm = QueryMessage.prototype;

qm.toString = function() {
  return {
    length : this.length,
    protocol : this.protocol,
    status : this.status,
    error : this.error,
    uid : this.uid,
    fieldsPresent : this.fieldsPresent,
    status : this.status,
    statusString : this.statusString,
    appStatus : this.appStatus,
    appStatusString : this.appStatusString,
    exception : this.exception,
    exceptionLength : this.exceptionLength,
    results : this.results
  };
}
exports.Message = Message;
exports.LoginMessage = LoginMessage;
exports.QueryMessage = QueryMessage;
