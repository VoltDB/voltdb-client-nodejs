!(function (global) { // eslint-disable-line no-unused-vars
  
  'use strict';
  
  const VoltClient = require('../../lib/client');
    
  require('nodeunit');
  const testContext = require('../util/test-context');
  const debug = require('debug')('voltdb-client-nodejs:ClientAffinityTest');
  
  //Setup context
  testContext.setup();
    
  /**
    * A "good" client config that points to a volt instance on localhost
    */
  function configs() {   
    return require('../config');
  }

  function waitForHashinator(client){
    
    return new Promise( (resolve, reject) => {
      let iterations = 0;

      const checkHandle = setInterval( () => {
        iterations++;
        if ( client._hashinator ){
          clearInterval(checkHandle);
          resolve(true);
        } else if ( iterations === 10 ){
          clearInterval(checkHandle);
          reject(false);
        }
      }, 300);
    });
  }
  
  // Exports
  module.exports = {
    setUp : function(callback){
      callback();
    },
    tearDown : function(callback){
      callback();
    },
    getPartitionForValue : function(test){
      
      //Cases for 8 partitions
      const cases = [
        { value: 'b', type: 'string', expected: '1' },
        { value: 'd', type: 'string', expected: '2' },
        { value: 'j', type: 'string', expected: '3' },
        { value: 'g', type: 'string', expected: '0' },
        { value: 'i', type: 'string', expected: '5' },
        { value: 'w', type: 'string', expected: '6' },
        { value: 'f', type: 'string', expected: '16' },
        { value: 'test', type: 'string', expected: '26' },

        { value: 7, type: 'int', expected: '0' },
        { value: -2, type: 'int', expected: '1' },
        { value: -1, type: 'int', expected: '2' },
        { value: -4, type: 'int', expected: '3' },
        { value: 0, type: 'int', expected: '5' },
        { value: 2, type: 'int', expected: '6' },
        { value: 11, type: 'int', expected: '16' },
        { value: 1, type: 'int', expected: '26' },

        { value: Buffer.from([0x05]), type: 'varbinary', expected: '0' },
        { value: Buffer.from([0x01]), type: 'varbinary', expected: '1' },
        { value: Buffer.from([0x00]), type: 'varbinary', expected: '2' },
        { value: Buffer.from([0x0C]), type: 'varbinary', expected: '3' },
        { value: Buffer.from([0x06]), type: 'varbinary', expected: '5' },
        { value: Buffer.from([0x04]), type: 'varbinary', expected: '6' },
        { value: Buffer.from([0X0B]), type: 'varbinary', expected: '16' },
        { value: Buffer.from([0x0E]), type: 'varbinary', expected: '26' },
      ];
      
      debug('getPartitionForValue');
      test.expect(cases.length);
  
      const client = new VoltClient(configs());
      debug('Connecting');
      
      return client.connect()
        .then( () => waitForHashinator(client) )
        .then( () => {

          cases.forEach( testCase => {
            const actual = client._hashinator.getPartitionKeyForValue(testCase.type, testCase.value);

            test.equals(actual, testCase.expected, `Partition key for ${JSON.stringify(testCase.value)} should be ${testCase.expected}`);

          });

          test.done();
        })
        .catch(function(value){
          //debug("Test Failed | Results: %O", value);
          debug(value);
          client.exit();
          test.ok(false, 'Test failed, see previous messages');
          test.done();
        });
    }
  };
  
}(this));
  