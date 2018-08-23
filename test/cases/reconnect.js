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
const VoltConstants = require("../../lib/voltconstants");

require("nodeunit");

const testContext = require("../util/test-context");
const debug = console.log; //require("debug")("voltdb-client-nodejs:ConnectionsTest");

// Setup context
testContext.setup();

function goodConfig() {
  const configs = require("../config");
  configs[0].reconnectInterval = 15*1000; //15 seconds to really see it.

  return configs;
}

const disconnect = client => {
  client._connections.forEach( con => {
    if ( con.validConnection ){
      console.log("Closing connection to " + con.config.host + ":" + con.config.port);
      con.socket.end();
    }
  });

  try {
    return client.adHoc("select * from query_will_never_get_to_the_db;").onQueryAllowed;
  } catch (error) {
    console.log("Error", error);

    return error;
  }
};
  

const waitForReconnect = (client, retries, interval) => new Promise( resolve => {
  let iteration = 0;

  const handle = setInterval( () => {
    const resolved = client.isConnected();
    iteration++;

    console.log("Reconnected yet?", resolved);

    if ( resolved || iteration === retries ) {
      console.log("So is connected?", resolved);
      clearInterval(handle);
      resolve(resolved);
    }
  }, interval);
});

exports.connections = {
  setUp : function(callback) {
    debug("connections setup called");
    callback();
  },
  tearDown : function(callback) {
    debug("connections teardown called");
    callback();
  },

};
