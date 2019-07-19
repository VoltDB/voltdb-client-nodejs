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

const VoltClient = require('../../lib/client');
const VoltConfiguration = require('../../lib/configuration');
const VoltConstants = require('../../lib/voltconstants');

require('nodeunit');

const testContext = require('../util/test-context');
const debug = require('debug')('voltdb-client-nodejs:ConnectionsTest');

// Setup context
testContext.setup();

function goodConfig() {
  return require('../config');
}

function badConfig() {
  debug('using badConfig');
  const configs = [];

  let config = new VoltConfiguration();
  config.host = 'idontexists';
  config.port = testContext.port();
  config.password = '12345';
  config.user = 'operator';
  config.reconnectInterval = 0; //No reconnects
  configs.push(config);

  //wrong port
  config = Object.assign({}, goodConfig()[0]);
  config.port = 8081;
  config.reconnectInterval = 0; //No reconnects
  configs.push(config);

  return configs;
}

function badAuthConfig(){
  debug('using badAuthConfig');
  var config = Object.assign({},goodConfig()[0]);
  config.password = '12345';
  config.reconnectInterval = 0; //No reconnects

  return [config];
}

const disconnect = client => {
  client._connections.forEach( con => {
    if ( con.validConnection ){
      debug('Closing connection to ' + con.config.host + ':' + con.config.port);
      con.socket.end();
    }
  });

  const call = client.adHoc('select * from query_will_never_get_to_the_db;');
  
  call.read.then( response => {
    debug('Query Response', response);
  });

  return call.onQueryAllowed;
};

const waitForReconnect = (client, retries, interval) => new Promise( resolve => {
  let iteration = 0;

  const handle = setInterval( () => {
    const resolved = client.isConnected();
    iteration++;

    debug('Reconnected yet?', resolved);

    if ( resolved || iteration === retries ) {
      debug('So is connected?', resolved);
      clearInterval(handle);
      resolve(resolved);
    }
  }, interval);
});

exports.connections = {

  setUp : function(callback) {
    debug('connections setup called');
    callback();
  },
  tearDown : function(callback) {
    debug('connections teardown called');
    callback();
  },
  'Bad connection results' : function(test) {
    debug('running bad connection test');
    const config = badConfig();
    var client = new VoltClient(config);

    client.connect().then ( ({ connected, errors }) => {
      debug('bad connection test ');
      test.expect(3);

      test.ok(!connected);
      test.equals(errors[0], VoltConstants.LOGIN_STATUS.HOST_UNKNOWN, 'Login Error 0 should be host unknown');
      test.equals(errors[1], VoltConstants.LOGIN_STATUS.CONNECTION_REFUSED, 'Login Error 0 should be connection refused');

      client.exit();
      test.done();
    }).catch( error => {
      debug('BadConnectionError: ', error);
    });
  },
  'Good connection results' : function(test) {
    debug('running good connection test');
    const client = new VoltClient(goodConfig());

    client.connect().then ( connected => {
      test.expect(1);
      test.ok(connected, 'Should have been able to connect, is Volt running on localhost?');
      client.exit();
      test.done();
    });

  },'Mixed connection results' : function(test) {
    debug('running mixed connection test');
    const mixedConfig = goodConfig().concat(badConfig());
    var client = new VoltClient(mixedConfig);

    client.connect().then ( ({ connected, errors }) => {
      test.expect(6);

      test.ok(connected, 'Should have been able to connect, is Volt running on localhost?');
      test.equals(client._connections.length,1, 'Should have one good connection');
      test.equals(client._badConnections.length, 2, 'Should have one bad connection');
      test.equals(errors[0], null, 'Login Error 0 should be null');
      test.equals(errors[1], VoltConstants.LOGIN_STATUS.HOST_UNKNOWN, 'Login Error 0 should be host unknown');
      test.equals(errors[2], VoltConstants.LOGIN_STATUS.CONNECTION_REFUSED, 'Login Error 0 should be connection refused');

      client.exit();
      test.done();
    });
  },'Bad Auth connection results' : function(test) {
    debug('running bad auth connection test');
    var client = new VoltClient(badAuthConfig());

    client.connect().then ( ({ connected, errors }) => {
      debug('bad auth connection test ');
      test.expect(2);

      test.ok(!connected);
      test.equals(errors[0], VoltConstants.LOGIN_STATUS.AUTHENTICATION_ERROR, 'Login Error 0 should be authentication error');
      client.exit();
      test.done();
    });
  }, 'Reconnect results' : function(test) {
    debug('Reconnect connection test');

    const configs = goodConfig();
    configs[0].reconnectInterval = 5 * 1000; //5s to really see it;

    const client = new VoltClient(configs);

    client.connect()
      .then( () => disconnect(client) )
      .then( () => waitForReconnect(client, 20, 1000))
      .then( connected => {
        debug(' Client Connected: ', client.isConnected());

        test.expect(1);
        test.ok(connected, 'Should have been able to connect, is Volt running on localhost?');
        test.done();
        client.exit();
      });
  }

};
