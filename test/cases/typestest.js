/* This file is part of VoltDB.
 * Copyright (C) 2008-2012 VoltDB Inc.
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

module.exports = {

    setUp:function(callback) {
        if ( client == null ) {
            client = new VoltClient(config());
            client.connect(function startup(results) {
                console.log('connected');
                callback();
            });
        } else {
            callback();
        }
    },
    
    tearDown:function(callback) {
        console.log('teardown called');
        callback();
    },
    
    'Init test' : function(test) {
        console.log('init test');
        test.expect(2);
        
        var initProc = new VoltProcedure('InitTestType', ['int']);
        var query = initProc.getQuery();
        query.setParameters([0]);
        
        client.call(query, function read( results ) {
            console.log('results', results);
            test.ok(results.status == 1 , 'did I get called');
            test.done();
        }, function write (results) {
             console.log('write ok');
             test.ok(true, 'Write didn\'t get called');
        });
    },
    
    'select test' : function(test) {
        test.expect(2);
        
        var initProc = new VoltProcedure('TYPETEST.select', ['int']);
        var query = initProc.getQuery();
        query.setParameters([0]);
        
        client.call(query, function read( results ) {
            console.log('results', results);
            test.ok(results.status == 1 , 'did I get called');
            test.done();
        }, function write (results) {
             console.log('write ok');
             test.ok(true, 'Write didn\'t get called');
        });
    }
};
