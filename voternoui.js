/* This file is part of VoltDB.
 * Copyright (C) 2008-2017 VoltDB Inc.
 *
 * This file contains original code and/or modifications of original code.
 * Any modifications made by VoltDB Inc. are licensed under the following
 * terms and conditions:
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

var cli = require('cli');
var cluster = require ('cluster');
var VoltClient = require('./lib/client');
var VoltConfiguration = require('./lib/configuration');
var VoltProcedure = require('./lib/query');
var VoltQuery = require('./lib/query');

var util = require('util');

var client = null;
var resultsProc = new VoltProcedure('Results');
var initProc = new VoltProcedure('Initialize', ['int', 'string']);
var voteProc = new VoltProcedure('Vote', ['long', 'int', 'long']);

var options = cli.parse({
    voteCount : ['c', 'Number of votes to run', 'number', 10000],
    clusterNode0 : ['h', 'VoltDB host (one of the cluster)', 'string', 'localhost']
});

var area_codes = [907, 205, 256, 334, 251, 870, 501, 479, 480, 602, 623, 928, 
520, 341, 764, 628, 831, 925, 909, 562, 661, 510, 650, 949, 760, 415, 951, 209,
 669, 408, 559, 626, 442, 530, 916, 627, 714, 707, 310, 323, 213, 424, 747, 
 818, 858, 935, 619, 805, 369, 720, 303, 970, 719, 860, 203, 959, 475, 202, 
 302, 689, 407, 239, 850, 727, 321, 754, 954, 927, 352, 863, 386, 904, 561, 
 772, 786, 305, 941, 813, 478, 770, 470, 404, 762, 706, 678, 912, 229, 808, 
 515, 319, 563, 641, 712, 208, 217, 872, 312, 773, 464, 708, 224, 847, 779, 
 815, 618, 309, 331, 630, 317, 765, 574, 260, 219, 812, 913, 785, 316, 620, 
 606, 859, 502, 270, 504, 985, 225, 318, 337, 774, 508, 339, 781, 857, 617, 
 978, 351, 413, 443, 410, 301, 240, 207, 517, 810, 278, 679, 313, 586, 947, 
 248, 734, 269, 989, 906, 616, 231, 612, 320, 651, 763, 952, 218, 507, 636, 
 660, 975, 816, 573, 314, 557, 417, 769, 601, 662, 228, 406, 336, 252, 984, 
 919, 980, 910, 828, 704, 701, 402, 308, 603, 908, 848, 732, 551, 201, 862, 
 973, 609, 856, 575, 957, 505, 775, 702, 315, 518, 646, 347, 212, 718, 516, 
 917, 845, 631, 716, 585, 607, 914, 216, 330, 234, 567, 419, 440, 380, 740, 
 614, 283, 513, 937, 918, 580, 405, 503, 541, 971, 814, 717, 570, 878, 835, 
 484, 610, 267, 215, 724, 412, 401, 843, 864, 803, 605, 423, 865, 931, 615, 
 901, 731, 254, 325, 713, 940, 817, 430, 903, 806, 737, 512, 361, 210, 979, 
 936, 409, 972, 469, 214, 682, 832, 281, 830, 956, 432, 915, 435, 801, 385, 
 434, 804, 757, 703, 571, 276, 236, 540, 802, 509, 360, 564, 206, 425, 253, 
 715, 920, 262, 414, 608, 304, 307];
var voteCandidates = 'Edwina Burnam,Tabatha Gehling,Kelly Clauss,' +
'Jessie Alloway,Alana Bregman,Jessie Eichman,Allie Rogalski,Nita Coster,' + 
'Kurt Walser,Ericka Dieter,Loraine NygrenTania Mattioli';


function main() {

    var clusterNodes = [options.clusterNode0];
    var configs = [];
    for ( var index = 0; index < clusterNodes.length; index++ ) {
        console.log("Host: " + clusterNodes[index]);
        var vc = new VoltConfiguration();
        vc.host = clusterNodes[index];
        configs.push(vc);
    }
    var counter = 0;
    
    client = new VoltClient(configs);    
    client.connect(function startup(results) {
        console.log('Node up');
        voltInit();
    }, function loginError(results) {
        console.log("Error logging in: " + results);
    });
}

function voltInit() {
    console.log('voltInit');
    var query = initProc.getQuery();
    query.setParameters([6, voteCandidates]);
    client.callProcedure(query, function initVoter(event, code, results) {
        if ( results.error == false ) {
            var val = results.table[0][0];
            console.log( 'Initialized app for ' + val[''] + ' candidates.\n\n');
            
            var voteJob = {};
            voteJob.voteCount = options.voteCount;
            voteJob.steps = getSteps();
      
            runNextLink(voteJob);
        }
    });
}

function voteOften(voteJob) {
    console.log('voteOften');
    voteInsertLoop(voteJob);
}

function voteResultsOften(voteJob) {
    console.log('voteResultsOften');
    voteResultsLoop(voteJob);
}

function voteResults(voteJob) {
    console.log('voteResults');
    var query = resultsProc.getQuery();
    client.callProcedure(query, function displayResults(event, code, results) {
        var mytotalVotes = 0;

        var msg = '';
        var longestString = 0;
        var rows = results.table[0];
        for(var i = 0; i < rows.length; i++) {
            mytotalVotes += rows[i].TOTAL_VOTES;
            msg += util.format("%s\t%s\t%d\n", rows[i].CONTESTANT_NAME, 
                rows[i].CONTESTANT_NUMBER, rows[i].TOTAL_VOTES);
        }
        msg += util.format("%d votes\n\n", mytotalVotes);
        console.log(msg);
        runNextLink(voteJob);
    });
}

function connectionStats() {
    client.connectionStats();
}

function voteEnd(voteJob) {
    client.connectionStats();
    console.log('voteEnd');
    process.exit();
}

function getCandidate() {
    return Math.floor(Math.random() * 6) + 1;
}

function getAreaCode() {
    return area_codes[Math.floor(Math.random() * area_codes.length)] * 10000000 
        + Math.random() * 10000000;
}

function getSteps() {
    var voltTestChain = [];
    voltTestChain.push(voteResults);
    // Not called because the query does a table scan and is not 
    // representative of VoltDB's performance
    //voltTestChain.push(voteResultsOften); 
    voltTestChain.push(voteOften);
    voltTestChain.push(voteResults);
    voltTestChain.push(voteEnd);

    return voltTestChain;
}

function voteResultsLoop(voteJob) {

    var index = 0;
    var reads = voteJob.voteCount;
    var startTime = new Date().getTime();
    var chunkTime = new Date().getTime();
    var readyToWriteCounter = 0;

    var innerResultsLoop = function() {
        var query = resultsProc.getQuery();
        if(index < voteJob.voteCount) {
            client.callProcedure(query, function displayVoteResults(event, code, results) {
                reads--;
                // results object is not always real
                if ( results.status != 1) {
                    console.log(results);
                }
                
                //console.log('reads left: ', reads);
                if(reads == 0) {
                    logVoteResultsTime(startTime, voteJob.voteCount, "Results");
                    runNextLink(voteJob);
                } else {
                   // console.log("reads ", reads);
                }
                //console.log('read done');
            }, function readyToWrite() {
                //console.log('writes left: ', voteJob.voteCount-index);
                if(index < voteJob.voteCount) {
                    if ( index % 5000 == 0 ) {
                        console.log('Executed ', index, ' queries in ', 
                            (new Date().getTime()) - chunkTime, 'ms ', 
                            util.inspect(process.memoryUsage()));
                        chunkTime = new Date().getTime();
                    }
                    index++;
                    if ( index % 20 == 0) {
                        process.nextTick(innerResultsLoop);
                    }
                } else {
                    console.log('Time to stop querying: ', index);
                }
                //console.log('write done');
            });
        } else {
            console.log(readyToWriteCounter++, 'Index is: ', index, ' and ', 
                voteJob.voteCount);
        }
    };
    process.nextTick(innerResultsLoop);
}



function voteInsertLoop(voteJob) {

    var index = 0;
    var reads = voteJob.voteCount;
    var startTime = new Date().getTime();
    var chunkTime = new Date().getTime();
    var readyToWriteCounter = 0;

    var innerLoop = function() {
        var query = voteProc.getQuery();
        if(index < voteJob.voteCount) {
            query.setParameters([getAreaCode(), getCandidate(), 200000]);
            client.callProcedure(query, function displayResults(event, code, results) {
                //console.log("reads ", reads);
                reads--;
                if(reads == 0) {
                    logVoteInsertTime(startTime, voteJob.voteCount, "Results");
                    runNextLink(voteJob);
                } else {
                   //console.log("reads ", reads);
                }
            }, function readyToWrite() {
                if( index < voteJob.voteCount ) {
                    if ( index % 5000 == 0 ) {
                        console.log('Executed ', index, ' votes in ', 
                        (new Date().getTime()) - chunkTime, 'ms '/*, 
                        util.inspect(process.memoryUsage())*/);
                        chunkTime = new Date().getTime();
                    }
                    index++;
                }
            });
        } 
        setImmediate(innerLoop);
    };
    process.nextTick(innerLoop);

}

function logVoteInsertTime(startTime, votes, typeString) {
    logTime('Voted', startTime, votes, typeString);
}

function logVoteResultsTime(startTime, votes, typeString) {
    logTime('Queried for results', startTime, votes, typeString);
}

function logTime(operation, startTime, votes, typeString) {
    var endTimeMS = new Date().getTime() - startTime;
    var endTimeSeconds = Math.floor(endTimeMS / 1000);
    endTimeMS = (endTimeMS > 0 ? endTimeMS : 1 );
    endTimeSeconds = (endTimeSeconds > 0 ? endTimeSeconds : 1 );

    console.log(util.format('%s %d times in %d milliseconds.\n'
    + '%s %d times in %d seconds.\n%d milliseconds per transaction\n'
    + '%d transactions per millisecond\n%d transactions per second\n\n',
    operation,
    votes, endTimeMS, 
    operation, votes, 
    endTimeSeconds, (endTimeMS / votes), 
    (votes / endTimeMS), (votes / endTimeSeconds)));
}

function isValidObject(object) {
    return typeof object != 'undefined' && object != null;
}

function runNextLink(voteJob) {

    if(0 < voteJob.steps.length) {
        var method = voteJob.steps.shift();
        if(isValidObject(method) == true) {
            method(voteJob);
        }
    }
}

main();
