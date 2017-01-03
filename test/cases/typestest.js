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

// TODO: Remove a lot of the console/util logging statements being used for
// debugging purposes.

var VoltClient = require('../../lib/client');
var VoltConfiguration = require('../../lib/configuration');
var VoltProcedure = require('../../lib/query');
var VoltQuery = require('../../lib/query');

var util = require('util');
var testCase = require('nodeunit');

var client = null;
var initProc = new VoltProcedure('InitTestType', ['int']);

function config() {
  var config = new VoltConfiguration();
  config.host = 'localhost';
  var configs = [];
  configs.push(config);
  return configs;
}

exports.typetest = {

  setUp : function(callback) {
    if(client == null) {
      console.log('typetest setup called');
      client = new VoltClient(config());
      client.connect(function startup(code, event, results) {
        console.log('dasda connected');
        callback();
      });
    } else {
      callback();
    }
  },
  tearDown : function(callback) {
    console.log('typetest teardown called');
    callback();
  },
  'Init test' : function(test) {
    console.log('init test');
    test.expect(2);

    var initProc = new VoltProcedure('InitTestType', ['int']);
    var query = initProc.getQuery();
    query.setParameters([0]);

    client.callProcedure(query, function read(code, event, results) {
      console.log('results', results);
      test.equals(code, null , 'did I get called');
      test.done();
    }, function write(code, event, results) {
      test.equals(code, null, 'Write didn\'t had an error');
      console.log('write ok');
    });
  },
  'select test' : function(test) {
    console.log('select test');
    test.expect(11);

    var initProc = new VoltProcedure('TYPETEST.select', ['int']);
    var query = initProc.getQuery();
    query.setParameters([0]);

    client.callProcedure(query, function read(code, event, results) {

      var testBuffer = new Buffer(4);
      console.log('results inspection: ', results.table[0][0].TEST_TIMESTAMP);
      console.log('inspect', util.inspect(results.table[0][0]));

      test.equals(code, null, 'Invalid status: ' + results.status + 'should be 1');

      test.equals(results.table[0][0].TEST_ID, 0, 'Wrong row ID, should be 0');
      test.equals(results.table[0][0].TEST_TINY, 1, 'Wrong tiny, should be 1');
      test.equals(results.table[0][0].TEST_SMALL, 2, 'Wrong small, should be 2');
      test.equals(results.table[0][0].TEST_INTEGER, 3, 'Wrong integer, should be 3');
      test.equals(results.table[0][0].TEST_BIG, 4, 'Wrong integer, should be 4');
      test.equals(results.table[0][0].TEST_FLOAT, 5.1, 'Wrong float, should be 5.1');
      test.equals(results.table[0][0].TEST_DECIMAL, 6.000342, 'Wrong decimal, should be 6.000342');
      test.equals(results.table[0][0].TEST_VARCHAR, 'seven', 'Wrong varchar, should be seven');
      // TODO: Add varbinary buffer comparison code.
      //test.equals(results.table[0][0].TEST_VARBINARY, 6.00034231,
      // results.table[0][0].TEST_VARBINARY);
      test.equals(results.table[0][0].TEST_TIMESTAMP.getTime(), (new Date(1331310436605)).getTime(), (new Date(1331310436605)).toString() + ": " + results.table[0][0].TEST_TIMESTAMP);

      test.done();
    }, function write(code, event, results) {
      console.log('write ok');
      test.ok(true, 'Write didn\'t get called');
    });
  }
};
