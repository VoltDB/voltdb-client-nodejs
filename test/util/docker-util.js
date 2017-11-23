!(function(global) { // eslint-disable-line no-unused-vars

  "use strict";

  const childProcess = require("child_process");
  const debug = require("debug")("voltdb-client-nodejs:DockerUtil");
  const os = require('os');
  
  /*
   * TODO: Should eventually go in VoltConstants. 
   */
  const VOLT_CLIENT_PORT = 21212;

  /*
   * Looks for a docker container with the given name on the local machine and finds
   * which port the container's 21212 port has been exposed on. Intended to be used 
   * with the localhostcluster docker containers defined in the main volt repository.
   * 
   * NOTE: This won't fail if no exposed port can be found, either because of a command
   * failure or if there is no docker container running Volt, it will just print a warning
   * and return the default Volt client port.
   */
  function _getExposedVoltPort(containerName) {
    
    var clientPort = VOLT_CLIENT_PORT;
    
    /*
     * "docker port node1 21212" will return something like this "0.0.0.0:33164". Just parse out the port at the end.
     */
    const command = "docker";
    const args = ["port", containerName, VOLT_CLIENT_PORT];
    const dockerPortResponse = childProcess.spawnSync(command, args);
    if(dockerPortResponse.status !== 0){
      // Failure, log a warning and just fall through, returning the default port
      console.warn(`Docker port query failure | Will return default port '${VOLT_CLIENT_PORT}'. \
Docker port query for container '${containerName}' and port '${VOLT_CLIENT_PORT}' failed, error was:${os.EOL} \ 
${dockerPortResponse.stderr.toString()}`);
    }
    else{
      // Success
      const dockerPortResponseString = dockerPortResponse.stdout.toString();
      const dockerPortResponseArray = dockerPortResponseString.replace("\n", "").replace("\r", "").split(":");
      if(dockerPortResponseArray.length === 2){
        debug("Container Found | Name: %o, Client Port: %o, Exposed Client Port: %o ", containerName, VOLT_CLIENT_PORT, clientPort);
        clientPort = parseInt(dockerPortResponseArray[1]);
      }
      else{
        // Failure, log a warning and just fall through, returning the default port
        console.warn(`Docker port query failure | Will return default port '${VOLT_CLIENT_PORT}'. \
Docker port query for container '${containerName}' and port '${VOLT_CLIENT_PORT}' returned unrecognised response, response was:${os.EOL} \
${dockerPortResponseString}`);
      }
    }

    return clientPort;
  }

  // Exports
  module.exports = {
    getExposedVoltPort : _getExposedVoltPort
  };

}(this));
