/* This file is part of VoltDB.
 * Copyright (C) 2008-2015 VoltDB Inc.
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

function goodConfig() {
  return config('localhost');
}

function badConfig() {
  return config('idontexist');
}

function config(host) {
  console.log('this config got called');
  var config = new VoltConfiguration();
  config.host = host;
  var configs = [];
  configs.push(config);
  return configs;
}

exports.connections = {

  setUp : function(callback) {
    console.log('connections setup called');
    callback();
  },
  tearDown : function(callback) {
    console.log('connections teardown called');
    callback();
  },
  'Bad connection results' : function(test) {
    console.log('running bad connection test');
    var client = new VoltClient(badConfig())
    client.connect(function startup(code, event, results) {
      console.log('bad connection test');
      test.expect(1);
      test.notEqual(code, null, 'There should not be a host named idontexists');
      test.done();
    });
  },
  'Good connection results' : function(test) {
    console.log('running good connection test');
    var client = new VoltClient(goodConfig())
    client.connect(function startup(code, event, results) {
      test.expect(1);
      test.equal(code, null, 'Should have been able to connect, is Volt running on localhost?');
      test.done();
    });
  }
};
