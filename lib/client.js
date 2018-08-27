/* This file is part of VoltDB.
 * Copyright (C) 2008-2018 VoltDB Inc.
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
  util = require("util"),
  VoltConnection = require("./connection"),
  VoltConstants = require("./voltconstants");

const fs = require("fs");
const debug = require("debug")("voltdb-client-nodejs:VoltClient");
const VoltProcedure = require("./query");
const Hashinator = require("./hashinator");

const AdHoc = new VoltProcedure("@AdHoc",["string"]);
const UpdateClasses = new VoltProcedure("@UpdateClasses",["varbinary","string"]);
const Statistics = new VoltProcedure("@Statistics",["string","int"]);
const GetPartitionKeys = new VoltProcedure("@GetPartitionKeys",["string"]);
const SystemInformation = new VoltProcedure("@SystemInformation",["string"]);

const VoltClient = function(configuration) {
  EventEmitter.call(this);

  this.config = configuration;

  this.connect = this.connect.bind(this);
  this._getConnections = this.connect.bind(this);
  this.call = this.call.bind(this);
  this.callProcedure = this.callProcedure.bind(this);
  this.exit = this.exit.bind(this);
  this.connectionStats = this.connectionStats.bind(this);
  
  this._connectListener = this._connectListener.bind(this);
  this._connectErrorListener=this._connectErrorListener.bind(this);
  this._queryResponseListener=this._queryResponseListener.bind(this);
  this._queryResponseErrorListener=this._queryResponseErrorListener.bind(this);
  this._queryDispatchErrorListener=this._queryDispatchErrorListener.bind(this);
  this._fatalErrorListener=this._fatalErrorListener.bind(this);
  
  this._hashinator = null;
  this._connections = [];
  this._badConnections = [];
  this._connectionCounter = 0;
};

util.inherits(VoltClient, EventEmitter);

VoltClient.prototype.isConnected = function(){
  return this._connections.reduce( (r, c) => r || c.isValidConnection(), false );
};

VoltClient.prototype.connect = function() {
  const conPromises = [];

  for(var index = 0; index < this.config.length; index++) {
    var con = new VoltConnection(this.config[index], index);
    
    con.on(VoltConstants.SESSION_EVENT.CONNECTION,this._connectListener);
    con.on(VoltConstants.SESSION_EVENT.CONNECTION_ERROR, this._connectErrorListener);
    con.on(VoltConstants.SESSION_EVENT.QUERY_RESPONSE,this._queryResponseListener);
    con.on(VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR,this._queryResponseErrorListener);
    con.on(VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR,this._queryDispatchErrorListener);
    con.on(VoltConstants.SESSION_EVENT.FATAL_ERROR,this._fatalErrorListener);
    con.onReconnect = () => {
      this._connections.push(con);
      this._badConnections = this._badConnections.filter( c => c.id !== con.id );
    };

    /**
     * Need to register the connection even before the socket connects otherwise
     * it can't be torn down in the event of a socket failure.
     */
    conPromises.push(con.connect());
  }

  const errors = [];

  return Promise.all(conPromises).then( connections => {
    for(let i = 0 ; i < connections.length ; i++){
      const con = connections[i];

      if ( con.isValidConnection() ) {
        this._connections.push(con);
        errors.push(null);
      } else {
        this._badConnections.push(con);
        errors.push(con.loginError);
      }
    }

    if ( this._connections.length > 0 ) this._updateHashinator();

    return { connected: this.isConnected(), errors };
  } );
};

VoltClient.prototype._updateHashinator = function(){
  let hashConfig = null;
  let partitionKeys = null;

  const topoCall = this.statistics("TOPO",0);

  topoCall.read
    .then( response => {
      if ( response.code ) return;
      if ( response.results.status !== 1 ) return; //Todo VoltConstants.RESULT_STATUS.SUCCESS
      
      hashConfig = response.results.table[1].data[0].HASHCONFIG;

      if ( partitionKeys ){
        this._hashinator = new Hashinator(hashConfig, partitionKeys);
      }
    }); 
  
  topoCall.onQueryAllowed
    .then( () => this.getPartitionKeys("string").read )
    .then( response => {
      if ( response.code ) return;
      if ( response.results.status !== 1 ) return; //Todo VoltConstants.RESULT_STATUS.SUCCESS
      
      partitionKeys = response.results.table[0].data;
  
      if ( hashConfig ){
        this._hashinator = new Hashinator(hashConfig, partitionKeys);
      }
    });
};

VoltClient.prototype._getConnection = function() {
  const length = this._connections.length;
  let connection = null;

  for(let index = 0; index < length; index++) {
    // creates round robin
    this._connectionCounter = (this._connectionCounter + 1 ) % length;

    connection = this._connections[this._connectionCounter];

    // validates that the connection is good and not blocked on reads
    if(connection == null || !connection.isValidConnection() ) {
      this._badConnections.push(connection);
      this._connections[this._connectionCounter] = null;

    } else if( !connection.isBlocked()) {
      break;
    }
  }

  this._connections = this._connections.filter(c => !!c );

  return connection;
};

VoltClient.prototype.callProcedure = function(query) {
  const con = this._getConnection();

  if( !con || !con.isValidConnection()) {
    this.emit(VoltConstants.SESSION_EVENT.CONNECTION_ERROR,
      VoltConstants.STATUS_CODES.CONNECTION_TIMEOUT,
      VoltConstants.SESSION_EVENT.CONNECTION_ERROR,
      "No valid VoltDB connections, verify that the database is online");

    const error = new Promise( (resolve,reject) => reject({
      code: VoltConstants.STATUS_CODES.CONNECTION_TIMEOUT,
      event: VoltConstants.SESSION_EVENT.CONNECTION_ERROR,
      results: { status: VoltConstants.STATUS_CODES.CONNECTION_LOST }
    }));
    
    return { read: error, onQueryAllowed: () => null };
  }

  return con.callProcedure(query);
};

VoltClient.prototype.call = function(query) {
  this.callProcedure(query);
};

VoltClient.prototype.adHoc = function(query){
  const statement = AdHoc.getQuery();
  statement.setParameters([query]);

  return this.callProcedure(statement);
};

VoltClient.prototype.getPartitionKeys = function(type = "string"){
  const statement = GetPartitionKeys.getQuery();
  statement.setParameters([type]);

  return this.callProcedure(statement);
};

VoltClient.prototype.statistics = function(component, delta=0){
  const statement = Statistics.getQuery();
  statement.setParameters([component, delta]);

  return this.callProcedure(statement);
};

VoltClient.prototype.updateClasses = function(jar, removeClasses = ""){
  const statement = UpdateClasses.getQuery();
	
  let jarBin = null;
  if ( jar instanceof Buffer ) {
    jarBin = jar;
  } else {
    jarBin = jar ? fs.readFileSync(jar) : new Buffer("NULL");
  }

  statement.setParameters([jarBin, removeClasses]);

  return this.callProcedure(statement);
};

VoltClient.prototype.systemInformation = function(selector){
  const statement = SystemInformation.getQuery();

  statement.setParameters([selector]);

  return this.callProcedure(statement);
};

VoltClient.prototype.exit = function(callback) {

  debug("Exiting | Connections Length: %o", this._connections.length);

  while(this._connections.length > 0){
    var c = this._connections[0];
    c.close();
    this._connections.splice(0, 1);
  }

  if(callback) callback();
};

VoltClient.prototype.connectionStats = function() {
  util.log("Good connections:");
  this._displayConnectionArrayStats(this._connections);

  util.log("Bad connections:");
  this._displayConnectionArrayStats(this._badConnections);
};

VoltClient.prototype._displayConnectionArrayStats = function(array) {
  for(var index = 0; index < array.length; index++) {
    const connection = array[index];

    if(connection != null) {
      util.log("Connection: ", 
        connection.config.host, ": ", 
        connection.invocations, " Alive: ", 
        connection.isValidConnection());
    }
  }
};

/**
 * TODO: Not sure why SUCCESS can be both null and 1. Will leave it as is until 
 * I know why and just brute force map the null to 1 to get it as a String.
 */
function statusCodeToString(code){
  return code === null ? VoltConstants.STATUS_CODE_STRINGS[1] : VoltConstants.STATUS_CODE_STRINGS[code];
}

VoltClient.prototype._connectListener = function(code, event, connection) {

  debug("Connected | Code: %o, Event: %o", statusCodeToString(code), event);
  
  this.emit(VoltConstants.SESSION_EVENT.CONNECTION, 
    code, 
    event,
    connection.config.host);
};

VoltClient.prototype._connectErrorListener = function(code, event, message) {
  debug("Connection Error | Code: %o, Event: %o", statusCodeToString(code), event);

  this.emit(VoltConstants.SESSION_EVENT.CONNECTION_ERROR, 
    code,
    event,
    message);
};

VoltClient.prototype._queryResponseListener = function(code,event, message) {
  this.emit(VoltConstants.SESSION_EVENT.QUERY_RESPONSE, 
    code,
    event,
    message);
};

VoltClient.prototype._queryResponseErrorListener = function(code, event, message) {
  debug("Query Response Error | Code: %o, Event: %o", statusCodeToString(code), event);

  this.emit(VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR, 
    code,
    event,
    message);
};

VoltClient.prototype._queryDispatchErrorListener = function(code, event, message) {
  debug("Query Dispatch Error | Code: %o, Event: %o", statusCodeToString(code), event);

  this.emit(VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR, 
    code,
    event,
    message);
};

VoltClient.prototype._fatalErrorListener = function(code, event, message) {
  debug("Fatal Error | Code: %o, Event: %o", statusCodeToString(code), event);

  this.emit(VoltConstants.SESSION_EVENT.FATAL_ERROR, 
    code,
    event, 
    message);
};

module.exports = VoltClient;
