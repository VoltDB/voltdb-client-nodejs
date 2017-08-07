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
 * This following is just a simple integration of VoltDB and a Node application.
 * 
 * The code does the following:
 * 1. Exposes the VOLTDB stored procedures
 * 2. Creates a connection
 * 3. Invokes stored procedures and processes the results.
 */

var util = require('util');
var cluster = require('cluster');

// VoltClient manages all communication with VoltDB
var VoltClient = require(__dirname + '/../../../../lib/client');

// VoltConstants has all the event types, codes and other constants
// that the client and your code will rely upon
var VoltConstants = require(__dirname + '/../../../../lib/voltconstants');

// VoltConfiguration sets up the configuration for each VoltDB server
// in your cluster. If you have ten Volt nodes in the cluster, then you should 
// create ten configurations. These configurations are used in the construction
// of the client.
var VoltConfiguration = require(__dirname + '/../../../../lib/configuration');

// VoltProcedure is a static representation of the stored procedure and 
// specifies the procedure's name and the parameter types. The parameter types
// are especially important since they define how the client will marshal the 
// the parameters.
var VoltProcedure = require(__dirname + '/../../../../lib/query');

// VoltQuery is a specific instance of a VoltProcedure. Your code will
// always call stored procedures using a VoltQuery object.
var VoltQuery = require(__dirname + '/../../../../lib/query');

// These are a set of stored procedure definitions.
// See VoltConstants to see the data types supported by the driver.
var resultsProc = new VoltProcedure('Results');
var initProc = new VoltProcedure('Initialize', ['int', 'string']);
var voteProc = new VoltProcedure('Vote', ['long', 'int', 'long']);

// The following is just application specific data
var client = null;

var transactionCounter = 0;
var statsLoggingInterval = 10000;

var area_codes = [907, 205, 256, 334, 251, 870, 501, 479, 480, 602, 623, 928, 
520, 341, 764, 628, 831, 925, 909, 562, 661, 510, 650, 949, 760, 415, 951, 209, 
669, 408, 559, 626, 442, 530, 916, 627, 714, 707, 310, 323, 213, 424, 747, 818, 
858, 935, 619, 805, 369, 720, 303, 970, 719, 860, 203, 959, 475, 202, 302, 689, 
407, 239, 850, 727, 321, 754, 954, 927, 352, 863, 386, 904, 561, 772, 786, 305, 
941, 813, 478, 770, 470, 404, 762, 706, 678, 912, 229, 808, 515, 319, 563, 641, 
712, 208, 217, 872, 312, 773, 464, 708, 224, 847, 779, 815, 618, 309, 331, 630, 
317, 765, 574, 260, 219, 812, 913, 785, 316, 620, 606, 859, 502, 270, 504, 985, 
225, 318, 337, 774, 508, 339, 781, 857, 617, 978, 351, 413, 443, 410, 301, 240, 
207, 517, 810, 278, 679, 313, 586, 947, 248, 734, 269, 989, 906, 616, 231, 612, 
320, 651, 763, 952, 218, 507, 636, 660, 975, 816, 573, 314, 557, 417, 769, 601, 
662, 228, 406, 336, 252, 984, 919, 980, 910, 828, 704, 701, 402, 308, 603, 908, 
848, 732, 551, 201, 862, 973, 609, 856, 575, 957, 505, 775, 702, 315, 518, 646, 
347, 212, 718, 516, 917, 845, 631, 716, 585, 607, 914, 216, 330, 234, 567, 419, 
440, 380, 740, 614, 283, 513, 937, 918, 580, 405, 503, 541, 971, 814, 717, 570, 
878, 835, 484, 610, 267, 215, 724, 412, 401, 843, 864, 803, 605, 423, 865, 931, 
615, 901, 731, 254, 325, 713, 940, 817, 430, 903, 806, 737, 512, 361, 210, 979, 
936, 409, 972, 469, 214, 682, 832, 281, 830, 956, 432, 915, 435, 801, 385, 434, 
804, 757, 703, 571, 276, 236, 540, 802, 509, 360, 564, 206, 425, 253, 715, 920, 
262, 414, 608, 304, 307];

var voteCandidates = 'Edwina Burnam,Tabatha Gehling,Kelly Clauss,' + 
'Jessie Alloway,Alana Bregman,Jessie Eichman,Allie Rogalski,Nita Coster,' + 
'Kurt Walser,Ericka Dieter,Loraine NygrenTania Mattioli';

function getCandidate() {
  return Math.floor(Math.random() * 6) + 1;
}

function getAreaCode() {
  var tmpNumber = Math.floor((area_codes[Math.floor(Math.random() * 1000) % area_codes.length] * 10000000) +
    (Math.random() * 10000000));
  return tmpNumber;
}

// This will initialize the Voter database by invoking a stored procedure.
function voltInit() {
  util.log('voltInit');
  // Start by creating a query instance from the VoltProcedure
  var query = initProc.getQuery();
  
  // Set the parameter values.
  query.setParameters([6, voteCandidates]);
  
  // Call the stored procedure with the query instance and a callback
  // handler to receive the results.
  // The callback handler uses the code to indicate whether there is an error 
  // and the severity. See the VoltConstant source to see all the possible codes 
  // and their definitions.
  // The event indicates what kind of event occurred. Again, check the 
  // VoltConstant source to see the possible values.
  // The result object depends on the operation. Queries will always return a
  // VoltTable array
  client.callProcedure(query, function initVoter(code, event, results) {
    var val = results.table[0][0];
    util.log('Initialized app for ' + val[''] + ' candidates.');
  });
}


// This is a generic event handler. An application can register a common
// event handler for all events emitted by the client. This is very useful 
// for trapping all the various error conditions, like connections being 
// dropped.
function eventListener(code, event, message) {
  util.log(util.format( 'Event %s\tcode: %d\tMessage: %s', event, code, 
    message));
}

// This is a generic configuration object factory.
function getConfiguration(host) {
  var cfg = new VoltConfiguration();
  cfg.host = host;
  // The messageQueueSize sets how many messages to buffer before dispatching 
  // them to the server. The messages are dispatched when either a timeout is 
  // reached or the queue fills up. It is best to keep this number
  // relatively small. High volume applications will see a benefit by having a 
  // queue while low volume applications would be better served with the queue
  // size set to 0. Increasing the queue size beyond 20 will only give you
  // marginal performance improvements.
  cfg.messageQueueSize = 20;
  return cfg;
}

// Connect to the server
exports.initClient = function(startLoop) {
  if(client == null) {
    var configs = []

    configs.push(getConfiguration('localhost'));
    // The client is only configured at this point. The connection
    // is not made until the call to client.connect().
    client = new VoltClient(configs);
    
    // You can register for a long list of event types, including the results
    // of queries. Some developers will prefer a common message loop
    // while others will prefer to consume each event in a separate handler.
    // Queries can also be processed in a common handler at the client level,
    // but would be better handled by using a query callback instead.
    client.on(VoltConstants.SESSION_EVENT.CONNECTION,eventListener);
    client.on(VoltConstants.SESSION_EVENT.CONNECTION_ERROR,eventListener);
    client.on(VoltConstants.SESSION_EVENT.QUERY_RESPONSE_ERROR,eventListener);
    client.on(VoltConstants.SESSION_EVENT.QUERY_DISPATCH_ERROR,eventListener);
    client.on(VoltConstants.SESSION_EVENT.FATAL_ERROR,eventListener);
   
    // The actual connection. 
    // Note, there are two handlers. The first handler will generally indicate
    // a success, though it is possible for one of the connections to the 
    // volt cluster to fail.
    // The second handler is more for catastrophic failures.
    client.connect(function startup(code, event,results) {
      if(code == VoltConstants.STATUS_CODES.SUCCESS) {
        util.log('Node connected to VoltDB');
        if(startLoop) {
          setInterval(logResults, statsLoggingInterval);
          voteInsertLoop();
        } else {
          voltInit();
        }
      } else {
        util.log(`Unexpected status while initClient: ${VoltConstants.STATUS_CODE_STRINGS[code]}`);
        process.exit(1);
      }
    }, function loginError(code, event, results) {
      util.log('Node did not connect to VoltDB');
    });
  }
}

// This method will vote several times and will run in the background.
function voteInsertLoop() {
  
  // Get the query object.  
  var query = voteProc.getQuery();
  var innerLoop = function() {
    // hard coded limited loop.
    // Note, increasing the size of the loop will "blast" the server with a 
    // large backlog of queries and degrade performance when you are running 
    // this application against a two node VoltDB cluster.
    for(var i = 0; i < 30; i++) {
      // Note that you can reuse the query object
      query.setParameters([ getAreaCode(), getCandidate(), 20000]);
      
      // There are two callbacks. The first indicates that the query returned.
      // The second indicates that it is safe to query the server again. The 
      // second handler prevents blocking. You must allow the driver to read 
      // from the VoltConnection's socket or VoltDB will close your socket. The
      // readyToWrite() callback gives you a way to interrupt looping type 
      // operations so that the socket.read events can be processed by the 
      // connection.
      client.callProcedure(query, 
        function displayResults(code, event, results) {
          transactionCounter++;
      }, function readyToWrite(code, event, results) {

      });
    }
      setImmediate(innerLoop);
  }
  process.nextTick(innerLoop);

}

// This just displays how many votes we issued every 10 seconds, per node 
// instance
function logResults() {
  logTime("Voted", statsLoggingInterval, transactionCounter);
  transactionCounter = 0;
}

function logTime(operation, totalTime, count) {
  util.log(util.format('%d: %s %d times in %d milliseconds. %d TPS', 
  process.pid, operation, count, totalTime, 
  Math.floor((count / totalTime) * 1000)));
}

// Call the stored proc to collect all votes.
exports.getVoteResults = function(callback) {
    var query = resultsProc.getQuery();
    client.callProcedure(query, callback);
}
