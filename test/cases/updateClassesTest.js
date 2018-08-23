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

const VoltClient = require("../../lib/client");
const debug = require("debug")("voltdb-client-nodejs:TypeTest");

const testContext = require("../util/test-context");
testContext.setup();

require("nodeunit");
const config = require("../config");

//Setup context


const client = new VoltClient(config);

const procName = "VoltTableTest";
const className = "com.voltdb.test.volttable.proc.VoltTableTest";
const jarPath = __dirname + "/../../tools/testdb/typetest.jar";

const dropProc = `drop procedure ${procName} if exists;`;
const createProc = `create procedure from class ${className};`;

function syncQuery(queryString){
  console.log("Query | query: ", queryString);

  return () => client.adHoc(queryString).read.then( function read(response){
    if ( response.code ) {
      throw new Error(response.results.statusString);
    }

    return response;
  });
}

exports.updateClasses = {
  setUp : function(callback) {
    client.connect().then(function startup() {
      if ( !client.isConnected() ) throw Error("Client not connected");

      callback();
    });
  },
  tearDown : function(callback) {
    if ( client ) {
      debug("typetest teardown called");
      client.exit();
      callback();
    }
  },
  "UpdateClasses remove" : function(test) {
    test.expect(2);

    console.log("UpdateClasses(null,'" + className + "')");
    return syncQuery(dropProc)()
      .then( () => client.updateClasses(null, className).read )
      .then( response => {
        test.equals(response.results.status,1, "Command should succeed");

        return syncQuery(createProc)();
      })
      .then( response => {
        test.equals(response.results.status, -2, "Command should not succeed");
        test.done();
      }).catch(console.error);
      
  },

  "UpdateClasses load" : function(test) {
    test.expect(2);
    
    console.log(`UpdateClasses('${jarPath}', null)`);
    return client.updateClasses(jarPath).read.then( response => {
      console.log(response.code, response.results.statusString);
      test.equals(response.results.status, 1, "Command should succeed");

      return syncQuery(createProc)();
    }).then( response => {
      console.log(response.code, response.results.statusString);
      test.equals(response.results.status, 1, "Command should succeed");
      test.done();
    }).catch(console.error);
  }
};
