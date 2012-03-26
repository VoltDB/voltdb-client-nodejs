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

var util = require('util');
var cluster = require('cluster');

var VoltClient = require(__dirname + '/../../../../lib/client');
var VoltConfiguration = require(__dirname + '/../../../../lib/configuration');
var VoltProcedure = require(__dirname + '/../../../../lib/query');
var VoltQuery = require(__dirname + '/../../../../lib/query');

// init the stored procedure definitions
var resultsProc = new VoltProcedure('Results');
var initProc = new VoltProcedure('Initialize', ['int', 'string']);
var voteProc = new VoltProcedure('Vote', ['long', 'int', 'long']);

var client = null;

var transactionCounter = 0;
var statsLoggingInterval = 10000;

var area_codes = [907, 205, 256, 334, 251, 870, 501, 479, 480, 602, 623, 928, 520, 341, 764, 628, 831, 925, 909, 562, 661, 510, 650, 949, 760, 415, 951, 209, 669, 408, 559, 626, 442, 530, 916, 627, 714, 707, 310, 323, 213, 424, 747, 818, 858, 935, 619, 805, 369, 720, 303, 970, 719, 860, 203, 959, 475, 202, 302, 689, 407, 239, 850, 727, 321, 754, 954, 927, 352, 863, 386, 904, 561, 772, 786, 305, 941, 813, 478, 770, 470, 404, 762, 706, 678, 912, 229, 808, 515, 319, 563, 641, 712, 208, 217, 872, 312, 773, 464, 708, 224, 847, 779, 815, 618, 309, 331, 630, 317, 765, 574, 260, 219, 812, 913, 785, 316, 620, 606, 859, 502, 270, 504, 985, 225, 318, 337, 774, 508, 339, 781, 857, 617, 978, 351, 413, 443, 410, 301, 240, 207, 517, 810, 278, 679, 313, 586, 947, 248, 734, 269, 989, 906, 616, 231, 612, 320, 651, 763, 952, 218, 507, 636, 660, 975, 816, 573, 314, 557, 417, 769, 601, 662, 228, 406, 336, 252, 984, 919, 980, 910, 828, 704, 701, 402, 308, 603, 908, 848, 732, 551, 201, 862, 973, 609, 856, 575, 957, 505, 775, 702, 315, 518, 646, 347, 212, 718, 516, 917, 845, 631, 716, 585, 607, 914, 216, 330, 234, 567, 419, 440, 380, 740, 614, 283, 513, 937, 918, 580, 405, 503, 541, 971, 814, 717, 570, 878, 835, 484, 610, 267, 215, 724, 412, 401, 843, 864, 803, 605, 423, 865, 931, 615, 901, 731, 254, 325, 713, 940, 817, 430, 903, 806, 737, 512, 361, 210, 979, 936, 409, 972, 469, 214, 682, 832, 281, 830, 956, 432, 915, 435, 801, 385, 434, 804, 757, 703, 571, 276, 236, 540, 802, 509, 360, 564, 206, 425, 253, 715, 920, 262, 414, 608, 304, 307];

var voteCandidates = 'Edwina Burnam,Tabatha Gehling,Kelly Clauss,' + 'Jessie Alloway,Alana Bregman,Jessie Eichman,Allie Rogalski,Nita Coster,' + 'Kurt Walser,Ericka Dieter,Loraine NygrenTania Mattioli';

function getCandidate() {
  return Math.floor(Math.random() * 6) + 1;
}

function getAreaCode() {
  return area_codes[Math.floor(Math.random() * area_codes.length)] * 10000000 + Math.random() * 10000000;
}

// setup the voter db
function voltInit() {
  util.log('voltInit');
  var query = initProc.getQuery();
  query.setParameters([6, voteCandidates]);
  client.call(query, function initVoter(results) {
    var val = results.table[0][0];
    util.log('Initialized app for ' + val[''] + ' candidates.');

  });
}

function getConfiguration(host) {
  var cfg = new VoltConfiguration();
  cfg.host = host;
  cfg.messageQueueSize = 20;
  return cfg;
}

// Connect to the server
exports.initClient = function(startLoop) {
  if(client == null) {
    var configs = []

    configs.push(getConfiguration('localhost'));
    client = new VoltClient(configs);
    client.connect(function startup(results) {
      util.log('Node up');
      if(startLoop == true) {
        setInterval(logResults, statsLoggingInterval);
        voteInsertLoop();
      } else {
        voltInit();
      }

    }, function loginError(results) {
      util.log('Node not up');
    });
  }
}
// Separate fork will run this code and try to vote as often as possible.
function voteInsertLoop() {

  var query = voteProc.getQuery();
  var innerLoop = function() {
    for(var i = 0; i < 3000; i++) {
      query.setParameters([getAreaCode(), getCandidate(), 200000]);
      client.call(query, function displayResults(results) {
        transactionCounter++;
      }, function readyToWrite() {

      });
    }
    process.nextTick(innerLoop);
  }

  process.nextTick(innerLoop);

}

function logResults() {
  logTime("Voted", statsLoggingInterval, transactionCounter);
  transactionCounter = 0;
}

function logTime(operation, totalTime, count) {
  util.log(util.format('%d: %s %d times in %d milliseconds. %d TPS', process.pid, operation, count, totalTime, Math.floor((count / totalTime) * 1000)));
}

// Call the stored proc to colelct all votes.
exports.getVoteResults = function(callback) {
  var query = resultsProc.getQuery();
  client.call(query, callback);
}