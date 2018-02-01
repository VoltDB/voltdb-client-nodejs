!(function(global) { // eslint-disable-line no-unused-vars

  "use strict";

  const VoltClient = require("./client");
  const VoltConfiguration = require("./configuration");
  const VoltConstants = require("./voltconstants");

  /*
   * AFAICT VoltQuery used to be exported from query.js but is deprecated and
   * now query exports VoltProcedure which should be used instead.
   */
  const VoltProcedure = require("./query");

  module.exports = {
    VoltClient : VoltClient,
    VoltConfiguration : VoltConfiguration,
    VoltConstants : VoltConstants,
    VoltProcedure : VoltProcedure
  };

})();