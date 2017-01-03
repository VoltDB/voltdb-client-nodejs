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

/*
 * This version of the sample requires that you have the VoltDB server installed
 * and running the voter example database.
 * 
 * This sample will spawn a number( equal to the number of cores divided by 2) 
 * of cluster nodes that will add votes to a collection of candidates.
 * The main cluster node will act as the web server.
 * 
 * Please see the ./modules/volt.js file for a detailed explanation of the
 * client code.
 */

var express = require('express'), 
routes = require('./routes'), volt = require('./models/volt'), 
votes = require('./jsons/votes'), util = require('util'), 
cluster = require('cluster'), numCPUs = require('os').cpus().length;

function webserverProcess() {
  var app = module.exports = express.createServer();

  // Configuration

  app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
  });

  app.configure('production', function() {
    app.use(express.errorHandler({
      dumpExceptions : true,
      showStack : true
    }));
  });

  app.configure('production', function() {
    app.use(express.errorHandler());
  });
  // Routes
  app.get('/', routes.index);
  app.get('/results', votes.votes);

  app.listen(3000);

  util.log(util.format("Express server listening on port %d in %s mode", 
    app.address().port, app.settings.env));
}

function startup() {
  if(cluster.isMaster) {
    numCPUs /=2;
    // TODO: Add command line to override whatever numCPUs is set to so we don't
    // use all the cores.
    util.log("Using CPUs: " + numCPUs);
    for(var i = 0; i < (numCPUs); i++) {
      cluster.fork();
    }
    volt.initClient(false);
    webserverProcess();
  } else {
    volt.initClient(true);
  }
}

startup();
