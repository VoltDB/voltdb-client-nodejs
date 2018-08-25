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
const VoltProcedure = require("../../lib/query");
const debug = require("debug")("voltdb-client-nodejs:TypeTest");
const VoltTable = require("../../lib/volttable");

const testContext = require("../util/test-context");
testContext.setup();

require("nodeunit");
const config = require("../config");

//Setup context

const client = new VoltClient(config);

const TIMESTAMP_VALUE = new Date("2002/07/25");

const className = "com.voltdb.test.volttable.proc.VoltTableTest";
const jarPath = __dirname + "/../../tools/testdb/typetest.jar";
const createProc = `create procedure from class ${className};`;
const dropProc = `drop procedure ${className} if exists;`;
const dropTable = "drop table typetest if exists;";
const createTable =`CREATE TABLE typetest(
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
const partitionTable = "PARTITION TABLE typetest ON COLUMN test_id;";
const selectData = "select * from typetest;";

function getTypeTestVoltTable(){
  const vt = new VoltTable();
  
  vt.addColumn("test_id","integer");          //2
  vt.addColumn("test_tiny","tinyint");        //3
  vt.addColumn("test_small","smallint");      //4
  vt.addColumn("test_integer","integer");     //5
  vt.addColumn("test_big","bigint");          //6
  vt.addColumn("test_float","float");         //7.7
  vt.addColumn("test_decimal","decimal");     //8.000008
  vt.addColumn("test_varchar","string");      //"nine"
  vt.addColumn("test_varbinary","varbinary"); //"0A" = [10]
  vt.addColumn("test_timestamp","timestamp"); //1902/07/25

  vt.addRow(2,3,4,5,6,7.7,8.000008, "nine", new Buffer([10]), TIMESTAMP_VALUE);
  
  return vt;
}

function syncExec(procedure, signature, args){
  const proc = new VoltProcedure(procedure, signature);
  const statement = proc.getQuery();
  statement.setParameters(args);

  return () => client.callProcedure(statement).read.then( function read(response){
    if ( response.code ) {
      throw new Error(response.results.statusString);
    }

    return response;
  });
}

function syncQuery(queryString){
  console.log("Query | query: ", queryString);

  return () => client.adHoc(queryString).read.then( function read(response){
    if ( response.code ) {
      throw new Error(response.results.statusString);
    }

    console.log(response.results.statusString);

    return response;
  });
}

exports.volttableTest = {
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
  "Init" : function(test){
    test.expect(1);
    console.log(`UpdateClasses('${jarPath}', null)`);
    return client.updateClasses(jarPath).read
      .then( syncQuery(dropProc) )
      .then( syncQuery(dropTable) )
      .then( syncQuery(createTable) )
      .then( syncQuery(partitionTable) )
      .then( syncQuery(createProc) )
      .then( () => {
        test.ok(true);
        test.done();
      })
      .catch(console.error);
  },
  "VoltTable" : function(test) {
    const volttable = getTypeTestVoltTable();
    syncExec("VoltTableTest",["volttable"],[volttable])()
      .then(({ code, results })=> {
        console.log(results.statusString);

        test.equals(code, null, "Should not be an error code");
        test.equals(results.status, 1, "Status code should be SUCCESS");

        return null;
      })
      .then( syncQuery(selectData) )
      .then( response => {
        const loadedVolttable = response.results.table[0];

        console.log("Inserted", volttable.data );
        console.log("Selected", loadedVolttable.data );

        test.ok(volttable.equals(loadedVolttable), "Inserted VoltTable should be the same that the one selected");
        test.done();
      })

    /*  */
      .catch(console.error);
    
  }
};
