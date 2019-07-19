!(function (global) { // eslint-disable-line no-unused-vars
  
  'use strict';

  const VoltClient = require('../../lib/client');
  const VoltConstants = require('../../lib/voltconstants');
  
  require('nodeunit');
  const testContext = require('../util/test-context');
  const debug = require('debug')('voltdb-client-nodejs:BufferTest');

  //Setup context
  testContext.setup();
  
  /**
   * A "good" client config that points to a volt instance on localhost
   */
  function configs() {   
    return require('../config');
  }

  /**
   * Promise style function for calling a procedure. An alternative to the old
   * callback style functions that returns both a write and a read promise.
   */
  function query(call){

    call.onQueryAllowed = call.onQueryAllowed.then( function write(response) {
      if( !response.code ){
        return response;
      } else {
        debug('AdHocQuery Failure | Write Error. errorCode: %o, eventCode: %o, results: %O', 
          statusCodeToString(response.code), response.event, response.results
        );

        this.emit(response);
      }
    });
      
    call.read = call.read.then( function read(response) {
      if(response.results.status === PROC_STATUS_CODE_SUCCESS){ 
        return response;
      } else {
        debug('AdHocQuery Failure | Read Error. errorCode: %o, eventCode: %o, results: %O', statusCodeToString(response.code), response.event, response.results);
        throw new Error(response);
      }
    }).catch( function(error){
      debug('Error: ', error.toString());
      throw new Error(error);
    });
    
    return call;
  }
  
  /**
   * Sugar for running an adhoc query
   */
  function adHocQuery(queryString, client){
    debug('Query | query: %o', queryString);

    return query(client.adHoc(queryString));
  }
  
  /**
   * 
   */
  function queryCollect(query, readPromises, client){
    return new Promise( (resolve, reject) => {
      try {
        const call = adHocQuery(query, client);
        readPromises.push(call.read);
        call.onQueryAllowed.then(resolve);
          
      } catch ( error ) {
        reject(error);
      }
    });
  }

  /**
   * 
   */
  function statusCodeToString(code){
    return code === null ? VoltConstants.STATUS_CODE_STRINGS[PROC_STATUS_CODE_SUCCESS] : VoltConstants.STATUS_CODE_STRINGS[code];
  }
  
  /**
   * 
   */
  const PROC_STATUS_CODE_SUCCESS = 1;
  
  // Exports
  module.exports = {
    setUp : function(callback){
      callback();
    },
    tearDown : function(callback){
      callback();
    },
    readTest : function(test){
      
      debug('readTest');

      const client = new VoltClient(configs());
      
      debug('Connecting');
      
      client.connect()
        .then(function(){
          test.ok(client.isConnected());
          debug('Connection success');
          return Promise.resolve(null);
        })
        .then(function(){
          debug('Dropping table');
          return adHocQuery('DROP TABLE PLAYERS IF EXISTS;', client).read;
        })
        .then(function(){ 
          return adHocQuery('CREATE TABLE PLAYERS (' +
            'playerID integer NOT NULL, ' +
            'teamid varchar(100) NOT NULL ' +
            ');', client).read;
        })
        .then(function(){ 
          return adHocQuery('DROP TABLE TEAM_PLAYERS IF EXISTS;', client).read; 
        })
        .then(function(){ 
          return adHocQuery('CREATE TABLE TEAM_PLAYERS (' +
            'id integer NOT NULL, ' +
            'uid varchar(100) NOT NULL, ' +
            'name varchar(100) NOT NULL, ' +
            'avatar varbinary(12000) NOT NULL' +
            ');', client).read;
        })
        .then(function(){ 
          const readPromises = [];
          
          return Promise.resolve()
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (0, \'TeamA\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (1, \'TeamA\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (2, \'TeamA\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (3, \'TeamA\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (4, \'TeamA\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (5, \'TeamB\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (6, \'TeamB\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (7, \'TeamB\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (8, \'TeamB\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO PLAYERS VALUES (9, \'TeamB\');', readPromises, client); })
            .then(function() { return Promise.all(readPromises); });
          
        })
        .then(function(){ 
  
          const readPromises = [];
          
          return Promise.resolve()
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (0, \'GameA\', \'TeamA\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (1, \'GameB\', \'TeamA\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (2, \'GameC\', \'TeamA\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (3, \'GameD\', \'TeamA\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (4, \'GameE\', \'TeamA\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (5, \'GameA\', \'TeamB\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (6, \'GameB\', \'TeamB\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (7, \'GameC\', \'TeamB\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (8, \'GameD\', \'TeamB\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return queryCollect('INSERT INTO TEAM_PLAYERS VALUES (9, \'GameE\', \'TeamB\', \'ABCDEF\');', readPromises, client); })
            .then(function() { return Promise.all(readPromises); });
        })
        .then(function(){ 
          return adHocQuery('select A.*, ' +
            'B.name as name, ' +
            'B.avatar as avatar ' +
            'from PLAYERS as A left join TEAM_PLAYERS as B on A.playerID=B.id ' +
            'where uID=\'GameA\' and A.teamID=\'TeamA\';', client).read; 
        })
        .then(function(value){ 
          debug('Result Count: %O', value.results.table.length);
          debug('Row Count: %O', value.results.table[0].data.length);
          debug('Results: %O', value.results.table[0].data);
          client.exit();
          const table = value.results.table[0];
          test.equals(table.data.length,1, 'Should return one row');
          test.equals(table.data[0].NAME,'TeamA', 'Name should be TeamA');
          test.equals(table.data[0].TEAMID,'TeamA', 'TeamId should be TeamA');
          test.equals(table.data[0].PLAYERID,0, 'PlayerId should be TeamA');

          test.done();
          return Promise.resolve(null);
        })
        .catch(function(value){
          debug('Test Failed | Results: %O', value);
          client.exit();
          test.ok(false, 'Test failed, see previous messages');
          test.done();
        });
    }
  };

}(this));
