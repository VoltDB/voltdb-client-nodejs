/**
 * Manages the "context" of a test run, which basically means how the tests interact with the outside world. This
 * includes things like whether the Volt instance being tested against is a local instance or running in a Docker 
 * container etc.
 * 
 */
!(function(global) { // eslint-disable-line no-unused-vars

  "use strict";
  
  const yargs = require("yargs");
  const dockerUtil = require("../util/docker-util");
  
  const VOLT_CONTAINER_NAME = "node1";
  
  // TODO: Should eventually go in VoltConstants. 
  const VOLT_CLIENT_PORT = 21212;
  
  const config = {
    instance: null
  };
  
  /**
   * Configures the context for a test run. Currently loads this from cli options but could be 
   * set with a file, env variables, etc.
   */
  function _setup(){

    var argv = yargs
      .alias("i", "instance")
      .demandOption(["i"])
      .describe("i", "Specify the type of VoltDB instance the tests will be run against. " +
          "Can be a local instance [local] or a local instance running in a Docker container [docker]")
      .choices("i", ["local", "docker"])
      .argv;
    
    config.instance = argv.instance;
  }
  
  
  /**
   * Based on config passed, figures out whether to use the default Volt port or 
   * look for a Docker container running Volt to run the tests against.
   */
  function _port(){
  
    var voltPort = -1;
    
    if(config.instance === "local"){
      voltPort = VOLT_CLIENT_PORT;
    }
    else if(config.instance === "docker"){
      voltPort = dockerUtil.getExposedVoltPort(VOLT_CONTAINER_NAME);
    }
    else{
      // This should be caught by arg parser, but we throw here to be cautious
      throw new Error(`Unrecognised instance mode ${config.instance}`);
    }
    
    return voltPort;
  }
  
  //Exports
  module.exports = {
    setup : _setup,
    port: _port
  };
  
}(this));