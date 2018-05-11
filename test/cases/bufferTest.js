!(function (global) { // eslint-disable-line no-unused-vars
  
  "use strict";

  const VoltClient = require("../../lib/client");
  const VoltConfiguration = require("../../lib/configuration");
  const VoltConstants = require("../../lib/voltconstants");
  const VoltProcedure = require("../../lib/query");


  require("nodeunit");
  const testContext = require("../util/test-context");
  const debug = require("debug")("voltdb-client-nodejs:BufferTest");

  //Setup context
  testContext.setup();
  
  /**
   * A "good" client config that points to a volt instance on localhost
   */
  function configs() {
    
    const configs = [];
    
    const config = new VoltConfiguration();
    config.host = "localhost";
    config.port = testContext.port();
    
    configs.push(config);
    
    return configs;
  }

  /**
   * Promise style function for connecting to a Volt instance
   */
  function connect(client){
    
    const p = new Promise(function(resolve, reject) {  
      client.connect(function(code, event, results) {
        if(code === VoltConstants.STATUS_CODES.SUCCESS){
          console.log("Code:", code)
          resolve({errorCode: code, eventCode: event, results: results});
        }
        else{
          debug("Connect Failure | Code: %o, Event: %o", code, event);
          reject({errorCode: code, eventCode: event, results: results});
        }
      });
    });
    
    return p;
  }
  
  /**
   * Promise style function for calling a procedure. An alternative to the old
   * callback style functions that returns both a write and a read promise.
   */
  function query(query, client){

    var writeResolve = null;
    var writeReject = null;
    
    const writePromise = new Promise(function(resolve, reject){
      writeResolve = resolve;
      writeReject = reject;
    });

    const readPromise = new Promise(function(resolve, reject){
      
      client.callProcedure(query, function read(code, event, results) {
        // debug("AdHocQuery Complete | errorCode: %o, eventCode: %o, results:
        // %O", code, event, results);
        if(code === VoltConstants.STATUS_CODES.SUCCESS){
          // The results code is 1 for SUCCESS so can't use voltconstants
          if(results.status === PROC_STATUS_CODE_SUCCESS){ 
            resolve({errorCode: code, eventCode: event, results: results});
          }
          else{
            debug("AdHocQuery Failure | Read Error. errorCode: %o, eventCode: %o, results: %O", statusCodeToString(code), event, results);
            reject({errorCode: code, eventCode: event, results: results});
          }
        }
        else{
          debug("AdHocQuery Failure | Read Error. errorCode: %o, eventCode: %o, results: %O", statusCodeToString(code), event, results);
          reject({errorCode: code, eventCode: event, results: results});
        }
        
      }, function write(code, event, results) {
        if(code === VoltConstants.STATUS_CODES.SUCCESS){
          writeResolve({errorCode: code, eventCode: event, results: results});
        }
        else{
          debug("AdHocQuery Failure | Write Error. errorCode: %o, eventCode: %o, results: %O", statusCodeToString(code), event, results);
          writeReject({errorCode: code, eventCode: event, results: results});
        }
      });
    });
    
    return { writePromise: writePromise, readPromise: readPromise };
  }
  
  /**
   * Sugar for running an adhoc query
   */
  function adHocQuery(queryString, client){
    
    debug("Query | query: %o", queryString);
    
    const p = new VoltProcedure("@AdHoc", [ "string" ]);
    
    const q = p.getQuery();
    q.setParameters([queryString]);
    
    return query(q, client);
  }
  
  /**
   * 
   */
  function statusCodeToString(code){
    return code === null ? VoltConstants.STATUS_CODE_STRINGS[PROC_STATUS_CODE_SUCCESS] : VoltConstants.STATUS_CODE_STRINGS[code];
  }
  
  /**
   * Utility method for volt queries that return a write and a read promise.
   * Useful for when you want to fire off a bunch of writes and then wait on the
   * read at the end. Executes the query and collects the read promises in the
   * given array. Returns both the write and read promise.
   */
  function queryCollect(queryString, readPromises, client){
    const p = adHocQuery(queryString, client);
    readPromises.push(p.readPromise);
    return p;
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
      
      debug("readTest");

      const client = new VoltClient(configs());
      
      debug("Connecting");
      
      connect(client)
        .then(function(value){ 
          test.ok(value.errorCode === VoltConstants.STATUS_CODES.SUCCESS);
          return Promise.resolve(null);
        })
        .then(function(){ 
          return adHocQuery("DROP TABLE PLAYERS IF EXISTS;", client).readPromise;
        })
        .then(function(){ 
          return adHocQuery("CREATE TABLE PLAYERS (" +
            "playerID integer NOT NULL, " +
            "teamid varchar(100) NOT NULL " +
            ");", client).readPromise; 
        })
        .then(function(){ 
          return adHocQuery("DROP TABLE TEAM_PLAYERS IF EXISTS;", client).readPromise; 
        })
        .then(function(){ 
          return adHocQuery("CREATE TABLE TEAM_PLAYERS (" +
            "id integer NOT NULL, " +
            "uid varchar(100) NOT NULL, " +
            "name varchar(100) NOT NULL, " +
            "avatar varbinary(12000) NOT NULL" +
            ");", client).readPromise;
        })
        .then(function(){ 

          const readPromises = [];
          
          return Promise.resolve()
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (0, 'TeamA');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (1, 'TeamA');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (2, 'TeamA');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (3, 'TeamA');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (4, 'TeamA');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (5, 'TeamB');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (6, 'TeamB');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (7, 'TeamB');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (8, 'TeamB');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO PLAYERS VALUES (9, 'TeamB');", readPromises, client).writePromise; })
            .then(function() { return Promise.all(readPromises); });
          
        })
        .then(function(){ 
  
          const readPromises = [];
          
          return Promise.resolve()
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (0, 'GameA', 'TeamA', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (1, 'GameB', 'TeamA', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (2, 'GameC', 'TeamA', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (3, 'GameD', 'TeamA', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (4, 'GameE', 'TeamA', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (5, 'GameA', 'TeamB', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (6, 'GameB', 'TeamB', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (7, 'GameC', 'TeamB', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (8, 'GameD', 'TeamB', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return queryCollect("INSERT INTO TEAM_PLAYERS VALUES (9, 'GameE', 'TeamB', 'ABCDEF');", readPromises, client).writePromise; })
            .then(function() { return Promise.all(readPromises); });
          
        })
        .then(function(){ 
          return adHocQuery("select A.*, " +
            "B.name as name, " +
            "B.avatar as avatar " +
            "from PLAYERS as A left join TEAM_PLAYERS as B on A.playerID=B.id " +
            "where uID='GameA' and A.teamID='TeamA';", client).readPromise; 
        })
        .then(function(value){ 
          debug("Result Count: %O", value.results.table.length);
          debug("Results: %O", value.results.table[0][0]);
          client.exit();
          test.done();
          return Promise.resolve(null);
        })
        .catch(function(value){
          debug("Test Failed | Results: %O", value);
          client.exit();
          test.ok(false, "Test failed, see previous messages");
          test.done();
        });
    }
  };

}(this));
