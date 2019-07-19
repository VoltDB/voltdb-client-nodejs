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

// TODO: Remove a lot of the console/util logging statements being used for
// debugging purposes.

var VoltClient = require('../../lib/client');
var VoltProcedure = require('../../lib/query');
const debug = require('debug')('voltdb-client-nodejs:TypeTest');

var util = require('util');
const testContext = require('../util/test-context');
require('nodeunit');

//Setup context
testContext.setup();

var client = null;

function config() {
  return require('../config');
}

const dropTableSQL = 'drop table typetest if exists;';
const createTableSQL =`CREATE TABLE typetest(
  test_id         integer         NOT NULL,
  test_tiny       tinyint         NOT NULL,
  test_small      smallint        NOT NULL,
  test_integer    integer         NOT NULL,
  test_big        bigint          NOT NULL,
  test_float      float           NOT NULL,
  test_decimal    decimal         NOT NULL,
  test_varchar    varchar(100)    NOT NULL,
  test_varbinary  varbinary(4)    NOT NULL,
  test_timestamp  timestamp       NOT NULL,
  PRIMARY KEY (test_id)
);`;
const partitionTableSQL = 'PARTITION TABLE typetest ON COLUMN test_id;';

function syncQuery(queryString){
  debug('Query | query: ', queryString);
  return client.adHoc(queryString).read.then( function read(response){
    if ( response.code ) {
      throw new Error(response.results.statusString);
    }

    return response;
  });
}

const VAR_BINARY_VALUE = new Buffer([8,8,8,8]);
const TIMESTAMP_VALUE = new Date(1331310436605);

exports.typetest = {
  setUp : function(callback) {
    debug('typetest setup called');
    client = new VoltClient(config());
    client.connect().then(function startup() {
      if ( !client.isConnected() ) throw Error('Client not connected');
      callback();
    });
  },
  tearDown : function(callback) {
    if ( client ) {
      debug('typetest teardown called');
      client.exit();
      callback();
    }
  },
  'Init test' : function(test) {
    debug('init test');
    test.expect(1);
    
    return syncQuery(dropTableSQL)
      .then ( () => syncQuery(createTableSQL))
      .then (() => syncQuery(partitionTableSQL))
      .then( () => {
      //Using TYPETEST.insert instead of JavaStoredProcedure to skip the Java Source Compiling and Loading
        const args = [0,1,2,3,4,5.1,6.000342,'seven',VAR_BINARY_VALUE,TIMESTAMP_VALUE.getTime()];
        const signature = ['integer','tinyint','smallint','integer','bigint','float','decimal','string','varbinary','timestamp'];
        const initProc = new VoltProcedure('TYPETEST.insert', signature);
        const query = initProc.getQuery();
        query.setParameters(args);
      
        client.callProcedure(query).read.then( ({ results }) => {
          debug('\nInit Test results %o', results);
          test.equals(results.status, 1 , 'did I get called');
          test.done();
        });
      }).catch( debug );
  },

  'select test' : function(test) {
    debug('select test');
    test.expect(12);

    var initProc = new VoltProcedure('TYPETEST.select', ['int']);
    var query = initProc.getQuery();
    query.setParameters([0]);

    const call = client.callProcedure(query);
    
    call.read.then( function read({ results }) {
      debug('Select test results:', results);
      debug('results inspection: %o', results.table[0].data[0].TEST_TIMESTAMP);
      debug('inspect %s', util.inspect(results.table[0].data[0]));

      test.equals(results.status, 1, 'Invalid status: ' + results.status + 'should be 1');
      test.equals(results.table[0].data.length, 1, 'Row count should be 1');
      test.equals(results.table[0].data[0].TEST_ID, 0, 'Wrong row ID, should be 0');
      test.equals(results.table[0].data[0].TEST_TINY, 1, 'Wrong tiny, should be 1');
      test.equals(results.table[0].data[0].TEST_SMALL, 2, 'Wrong small, should be 2');
      test.equals(results.table[0].data[0].TEST_INTEGER, 3, 'Wrong integer, should be 3');
      test.equals(results.table[0].data[0].TEST_BIG, 4, 'Wrong integer, should be 4');
      test.equals(results.table[0].data[0].TEST_FLOAT, 5.1, 'Wrong float, should be 5.1');
      test.equals(results.table[0].data[0].TEST_DECIMAL, 6.000342, 'Wrong decimal, should be 6.000342');
      test.equals(results.table[0].data[0].TEST_VARCHAR, 'seven', 'Wrong varchar, should be seven');
      test.ok(results.table[0].data[0].TEST_VARBINARY.equals(VAR_BINARY_VALUE), 'Wrong varbinary, should be ' + VAR_BINARY_VALUE);
      test.equals(results.table[0].data[0].TEST_TIMESTAMP.getTime(), TIMESTAMP_VALUE.getTime(), TIMESTAMP_VALUE.toString() + ': ' + results.table[0].data[0].TEST_TIMESTAMP);

      test.done();
    });
  }
};
