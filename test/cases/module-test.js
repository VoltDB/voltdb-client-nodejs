!(function(global) { // eslint-disable-line no-unused-vars

  "use strict";

  require("nodeunit");
  const debug = require("debug")("voltdb-client-nodejs:ModuleTest");

  // Exports
  module.exports = {
    setUp : function(callback) {
      callback();
    },
    tearDown : function(callback) {
      callback();
    },
    requireTest : function(test) {

      /**
       * Just test if the expected members are there and that they are in fact
       * what they should be.
       */

      debug("requireTest");
      
      test.expect(18);

      /*
       * Module tests
       */
      const voltdb = require("../../lib/");
      test.notEqual(typeof voltdb.VoltClient, "undefined",
        "VoltClient member not present");
      test.equal(typeof voltdb.VoltClient, "function",
        "VoltClient is present but not a function");

      test.notEqual(typeof voltdb.VoltConfiguration, "undefined",
        "VoltClient function not present");
      test.equal(typeof voltdb.VoltConfiguration, "function",
        "VoltConfiguration is present but not a function");

      test.notEqual(typeof voltdb.VoltConstants, "undefined",
        "VoltClient function not present");
      test.equal(typeof voltdb.VoltConstants, "object",
        "VoltConstants is present but not an object");

      test.notEqual(typeof voltdb.VoltProcedure, "undefined",
        "VoltClient function not present");
      test.equal(typeof voltdb.VoltProcedure, "function",
        "VoltProcedure is present but not a function");

      /*
       * VoltClient
       */
      const voltClient = new voltdb.VoltClient();
      test.notEqual(typeof voltClient.connect, "undefined",
        "VoltClient.connect member not present");
      test.equal(typeof voltClient.connect, "function",
        "VoltClient.connect is present but not a function");

      /*
       * VoltConfiguration
       */
      const voltConfiguration = new voltdb.VoltConfiguration();
      test.notEqual(typeof voltConfiguration.host, "undefined",
        "VoltConfiguration.host member not present");
      test.equal(typeof voltConfiguration.host, "string",
        "VoltConfiguration.host is present but not a string");

      /*
       * VoltConstants
       */
      const voltConstants = voltdb.VoltConstants;
      test.notEqual(typeof voltConstants.STATUS_CODES, "undefined",
        "VoltConstants.STATUS_CODES member not present");
      test.equal(typeof voltConstants.STATUS_CODES, "object",
        "VoltConstants.STATUS_CODES is present but not an object");
      test.notEqual(typeof voltConstants.STATUS_CODES.SUCCESS, "undefined",
        "VoltConstants.STATUS_CODES.SUCCESS member not present");
      test.equal(voltConstants.STATUS_CODES.SUCCESS, null,
        "VoltConstants.STATUS_CODES.SUCCESS is present but not null");

      /*
       * VoltProcedure
       */
      const voltProcedure = new voltdb.VoltProcedure();
      test.notEqual(typeof voltProcedure.getQuery, "undefined",
        "VoltProcedure.getQuery member not present");
      test.equals(typeof voltProcedure.getQuery, "function",
        "VoltProcedure.getQuery is present but not a function");

      test.done();
    }
  };
})();