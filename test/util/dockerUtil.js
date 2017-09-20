!(function(global) {

  "use strict";

  const childProcess = require('child_process');
  const debug = require("debug")("voltdb-client-nodejs:DockerUtil");
  
  /*
   * TODO: Should eventually go in VoltConstants. 
   */
  const VOLT_CLIENT_PORT = 21212;

  /*
   * Looks for a docker container with the given name on the local machine and finds
   * which port the container's 21212 port has been exposed on. Intended to be used 
   * with the localhostcluster docker containers defined in the main volt repository.
   */
  function _getExposedVoltPort(containerName) {
    
    var clientPort = VOLT_CLIENT_PORT;
    
    /*
     * "docker port node1 21212" will return something like this "0.0.0.0:33164". Just parse out the port at the end.
     */
    const command = `docker port ${containerName} ${VOLT_CLIENT_PORT}`;
    const dockerPortResponseString = childProcess.execSync(command).toString();
    const dockerPortResponseArray = dockerPortResponseString.replace("\n", "").replace("\r", "").split(":");
    if(dockerPortResponseArray.length === 2){
      clientPort = parseInt(dockerPortResponseArray[1]);
    }
    else{
      throw new Error(`Docker Error | Docker port query for container '${containerName}' and port '${VOLT_CLIENT_PORT}' returned unrecognised response '${dockerPortResponseString}'`);
    }
    
    debug("Container Found | Name: %o, Client Port: %o, Exposed Client Port: %o ", containerName, VOLT_CLIENT_PORT, clientPort);

    return clientPort;
  }

  // Exports
  module.exports = {
    getExposedVoltPort : _getExposedVoltPort
  };

}(this));
