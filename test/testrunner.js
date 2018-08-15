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

var nodeunit = require("nodeunit");
var fs = require("fs");
require("child_process");
const path = require("path");
    
const testCasesDirectory = path.resolve(__dirname, "cases");

var TestRunner = function() {
  this.testDirectories = [testCasesDirectory];
  this.fileList = [];
};

const tr = TestRunner.prototype;

const TEST_NAME = 4;
tr.loadTests = function() {
  const testName = process.argv[TEST_NAME];
  
  for(var index = 0; index < this.testDirectories.length; index++) {
    let cases = fs.readdirSync(this.testDirectories[index]) || [];

    for(let inner = 0; inner < cases.length; inner++) {
      if ( testName && cases[inner] !== `${testName}.js` ) continue;
      this.fileList = this.fileList.concat(this.testDirectories[index] + "/" + cases[inner]);
    }
  }
};

tr.run = function() {
  if (this.fileList.length === 0) {
    console.error(`Test ${process.argv[TEST_NAME]} not found`);
    process.exit(1);
  }

  const reporter = nodeunit.reporters.default;
  reporter.run(this.fileList, null, function something() {
    process.exit(0);
  });
};
function main() {
  var runner = new TestRunner();
  runner.loadTests();
  runner.run();
}

main();