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

var VoltClient = require('../../lib/client');
var VoltConfiguration = require('../../lib/configuration');
var util = require('util');
var testCase = require('nodeunit');
const testContext = require("../util/test-context");
const debug = require("debug")("voltdb-client-nodejs:ConnectionsTest");

// Setup context
testContext.setup();

function goodConfig() {
  return config('localhost');
}

function badConfig() {
  return config('idontexist');
}

function config(host) {
  debug('this config got called');
  var config = new VoltConfiguration();
  config.host = host;
  config.port = testContext.port();
  var configs = [];
  configs.push(config);
  return configs;
}

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
    var client = new VoltClient(badConfig())
    client.connect(function startup(code, event, results) {
      debug('bad connection test');
      test.expect(1);
      test.notEqual(code, null, 'There should not be a host named idontexists');
      client.exit();
      test.done();
    });
  },
  'Good connection results' : function(test) {
    debug('running good connection test');
    var client = new VoltClient(goodConfig())
    client.connect(function startup(code, event, results) {
      test.expect(1);
      test.equal(code, null, 'Should have been able to connect, is Volt running on localhost?');
      client.exit();
      test.done();
    });
  }
};
