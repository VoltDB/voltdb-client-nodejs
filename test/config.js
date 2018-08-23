const configs = [];
const VoltConfiguration = require("../lib/configuration");
const testContext = require("./util/test-context");

let config = null;
config = new VoltConfiguration();
config.host = "192.168.0.51";
config.username = "operator";
config.password = "mech";
config.hashAlgorithm = "sha1";
config.port = testContext.port();

configs.push(config);

module.exports = configs;