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

/**
 * Message object constants used only when encoding/decoding a message
 * between the client and server.
 * 
 */
const MESSAGE_TYPE = {
  UNDEFINED : -1,
  LOGIN : 1,
  QUERY : 2
};

const PRESENT = {
  STATUS : 0x20,
  EXCEPTION : 0x40,
  APP_STATUS : 0x80
};


/**
 * Top level event types for all operations. All events have at least the 
 * SESSION_EVENT type and STATUS_CODE.
 *  CONNECT: A successful connection to the volt server
 *  CONNECTION_ERROR: Could not connect, see both the status code and 
 *    the event handler's message parameter. 
 *  QUERY_RESPONSE: Query executed and returned
 *  QUERY_ALLOWED: Indicates that the application may execute another query.
 *    Note that this prevents your application from flooding the database and
 *    the application's code from blocking.
 *  QUERY_RESPONSE_ERROR: The query was successfully dispatched but the
 *    VoltDB server either had a critical fault or lost the connection.
 *  QUERY_DISPATCH_ERROR: The client could not dispatch the query.
 *  FATAL_ERROR: A critical error occurred that was above and beyond all 
 *    other error conditions.
 */
const SESSION_EVENT = {
  CONNECTION : "CONNECT",
  CONNECTION_ERROR: "CONNECT_ERROR",
  QUERY_RESPONSE: "QUERY_RESPONSE",
  QUERY_ALLOWED: "QUERY_ALLOWED",
  QUERY_RESPONSE_ERROR: "QUERY_RESPONSE_ERROR",
  QUERY_DISPATCH_ERROR: "QUERY_DISPATCH_ERROR",
  FATAL_ERROR: "FATAL_ERROR"
};

/**
 * Each SESSION_EVENT has a STATUS_CODE giving some indication why the 
 * operation failed.
 * 
 *  SUCCESS: Operation succeeded. 
 *  USER_ABORT: The user's stored procedure intentionally threw an exception 
 *    of type UserAbortException
 *  GRACEFUL_FAILURE: Query had an error that rolled back the transaction.
 *  UNEXPECTED_FAILURE: Query had an error, rolled back the transaction 
 *    and caused additional errors.
 *  CONNECTION_LOST: The connection to VoltDB was lost before 
 *    the query returned. This is not issued by the server, but is issued 
 *    by the client.'
 *  SERVER_UNAVAILABLE: Attempted to use an invalid connection.
 *  CONNECTION_TIMEOUT: The server stopped replying.
 *  QUERY_TIMEOUT: The server issues a message saying that the query took 
 *    too long to execute.
 *  QUERY_TOOK_TOO_LONG: Driver issued message indicating that the server
 *    has taken too long to respond.
 */
const STATUS_CODES = {
  SUCCESS : null,
  USER_ABORT : -1,
  GRACEFUL_FAILURE : -2,
  UNEXPECTED_FAILURE : -3,
  CONNECTION_LOST : -4,
  SERVER_UNAVAILABLE : -5,
  CONNECTION_TIMEOUT : -6,
  QUERY_TIMEOUT : -7,
  QUERY_TOOK_TOO_LONG : -8
};

const STATUS_CODE_STRINGS = {
  1 : "SUCCESS",
  "-1" : "USER_ABORT",
  "-2" : "GRACEFUL_FAILURE",
  "-3" : "UNEXPECTED_FAILURE",
  "-4" : "CONNECTION_LOST",
  "-5" : "SERVER_UNAVAILABLE",
  "-6" : "CONNECTION_LOST",
  "-7" : "QUERY_TIMEOUT",
  "-8" : "QUERY_TOOK_TOO_LONG"
};

const LOGIN_ERRORS = {
  1 : "Too many connections",
  3 : "Corrupt or invalid login message",
  4 : "Can't resolve host",
  5 : "Authentication failed, client took too long to transmit credentials",
  6 : "Connection refused",
  7 : "Socket closed by other party",
  8 : "Connection timeout"
};

const SOCKET_ERRORS = {
  ENOTFOUND: "HOST_UNKNOWN",
  ECONNREFUSED: "CONNECTION_REFUSED",
  EPIPE: "SOCKET_CLOSED"
};

const LOGIN_STATUS = {
  TOO_MANY_CONNECTIONS: 1,
  INVALID_LOGIN_MESSAGE: 3,
  HOST_UNKNOWN: 4,
  AUTHENTICATION_ERROR: 5,
  CONNECTION_REFUSED: 6,
  SOCKET_CLOSED: 7,
  ETIMEDOUT: 8
};

const HASH_ALGORITHMS = {
  SHA_1: "sha1",
  SHA_2: "sha256"
};

const RESULT_STATUS = {
  SUCCESS: 1
};

/**************** */

const TYPES_SIZES = {
  "byte" : 1,
  "tinyint" : 1,
  "short" : 2,
  "smallint" : 2,
  "int" : 4,
  "integer" : 4,
  "long" : 8,
  "bigint" : 8,
  "double" : 8,
  "float" : 8,
  "date" : 8,
  "timestamp" : 8,
  "decimal" : 16
};

const TYPES_STRINGS = {
  "-99" : "array",
  "1" : "null",
  "3" : "byte",
  "4" : "short",
  "5" : "int",
  "6" : "long",
  "8" : "double",
  "9" : "string",
  "11" : "date",
  "22" : "decimal",
  "25" : "varbinary"
};

const TYPES_NUMBERS = {
  "array" : -99,
  "null" : 1,
  "byte" : 3,
  "tinyint" : 3,
  "short" : 4,
  "smallint" : 4,
  "int" : 5,
  "integer" : 5,
  "long" : 6,
  "bigint" : 6,
  "double" : 8,
  "float" : 8,
  "string" : 9,
  "date" : 11,
  "timestamp" : 11,
  "decimal" : 22,
  "varbinary" : 25,
  "volttable" : 21
};

const TYPES_READ = {
  "array" : "readArray",
  "null" : "readNull",
  "byte" : "readByte",
  "tinyint" : "readByte",
  "short" : "readShort",
  "smallint" : "readShort",
  "int" : "readInt",
  "integer" : "readInt",
  "long" : "readLong",
  "bigint" : "readLong",
  "double" : "readDouble",
  "float" : "readDouble",
  "string" : "readString",
  "date" : "readDate",
  "timestamp" : "readDate",
  "decimal" : "readDecimal",
  "varbinary" : "readVarbinary"
};

const TYPES_WRITE = {
  "array" : "writeArray",
  "null" : "writeNull",
  "byte" : "writeByte",
  "tinyint" : "writeByte",
  "short" : "writeShort",
  "smallint" : "writeShort",
  "int" : "writeInt",
  "integer" : "writeInt",
  "long" : "writeLong",
  "bigint" : "writeLong",
  "double" : "writeDouble",
  "float" : "writeDouble",
  "string" : "writeString",
  "date" : "writeDate",
  "timestamp" : "writeDate",
  "decimal" : "writeDecimal",
  "varbinary" : "writeVarbinary",
  "volttable" : "writeVoltTable"
};

const NUMERIC_TYPES = {
  "byte" : true,
  "tinyint" : true,
  "short" : true,
  "smallint" : true,
  "int" : true,
  "integer" : true,
  "long" : true,
  "bigint" : true,
  "double" : true,
  "float" : true,
  "date" : true,
  "timestamp" : true,
  "decimal" : true,
  "varbinary" : true
};
const STRING_TYPES = {
  "string" : true,
  "decimal" : true
};
const BIGINT_TYPES = {
  "long" : true,
  "bigint" : true
};


module.exports = {
  PRESENT,
  LOGIN_ERRORS,
  LOGIN_STATUS,
  SOCKET_ERRORS,
  SESSION_EVENT,
  STATUS_CODE_STRINGS,
  STATUS_CODES,
  RESULT_STATUS,
  MESSAGE_TYPE,

  TYPES_SIZES,
  TYPES_STRINGS,
  TYPES_NUMBERS,
  TYPES_READ,
  TYPES_WRITE,
  STRING_TYPES,
  NUMERIC_TYPES,
	BIGINT_TYPES,

	HASH_ALGORITHMS
};