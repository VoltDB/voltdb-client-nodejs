const Message = require("./message").Message;
const { TYPES_READ, NUMERIC_TYPES } = require("./voltconstants");
const hash = require("murmurhash-native").murmurHash128x64;

const toBytes = (type,value) => {
  switch(type){
  case "string":
    return new Buffer(value,"utf8");
  }
};

const getTokenPartition = (hashedValue, tokenCount, tokens) => {
  let min = 0;
  let max = tokenCount - 1;

  while (min <= max) {
    let mid = (min + max) >>> 1;
    let midPtr = mid * 8;
    let midval = tokens.readInt32BE(midPtr);

    if (midval < hashedValue) {
      min = mid + 1;
    } else if (midval > hashedValue) {
      max = mid - 1;
    } else {
      return midPtr;
    }
  }

  return 8*(min-1);
};

const hashinateBytes = (type, obj, tokenCount, tokens) => {
  const bytes = toBytes(type,obj);

  if (bytes === null) {
    return 0;
  }

  //Todo: const outBuffer = new Buffer(16);
  let hashedValue = hash(bytes, 0, bytes.length, 0);
  var view = new DataView( new ArrayBuffer(4));

  for(let i = 0; i < 4 ; i++){
    let byte = hashedValue.substring(i*2,i*2+2);
    view.setUint8(i, parseInt( byte, 16) );
  }

  const hashInt = view.getInt32();

  const tokenIdx = getTokenPartition(hashInt, tokenCount, tokens);

  return tokens.readInt32BE(tokenIdx+4);
};

const getPartitionForValue = ( type, value, tokenCount, mappings ) => {
  // Special cases:
  // 1) if the user supplied a string for a number column,
  // try to do the conversion. This makes it substantially easier to
  // load CSV data or other untyped inputs that match DDL without
  // requiring the loader to know precise the schema.
  // 2) For legacy hashinators, if we have a numeric column but the param is in a byte
  // array, convert the byte array back to the numeric value
  if (value !== null && !!NUMERIC_TYPES[type] ) {
    if ( typeof value === "string") {
      value = parseInt(value,10);
        
      if ( Number.isNaN(value) ) {
        throw new Error("getHashedPartitionForParameter: Unable to convert string " + 
                value + " to a numeric value target parameter");
      }
    }
    else if ( value instanceof Buffer ) {
      const parser = new Message(value);
      const readMethod = TYPES_READ[type];
      value = parser[readMethod]();
    }
  }

  return hashinateBytes(type, value, tokenCount, mappings);
};

const Hashinator = function(hashConfig, partitionKeys){
  this.tokenCount = hashConfig.readInt32BE();
  this.tokens = hashConfig.slice(4);
  this.partitionKeys = [];

  partitionKeys.forEach( ({ PARTITION_ID, PARTITION_KEY }) => this.partitionKeys[PARTITION_ID] = PARTITION_KEY );
};

Hashinator.prototype.getPartitionKeyForValue = function(type, value){
  const partitionId = getPartitionForValue(type, value, this.tokenCount, this.tokens);

  return this.partitionKeys[partitionId];
};

Hashinator.prototype.update = function(hashConfig, partitionKeys){

  if ( hashConfig ){
    this.tokenCount = hashConfig.readInt32BE();
    this.tokens = hashConfig.slice(4);
  }
    
  if ( partitionKeys ){
    this.partitionKeys = [];
  
    partitionKeys.forEach( ({ PARTITION_ID, PARTITION_KEY }) => this.partitionKeys[PARTITION_ID] = PARTITION_KEY );
  }
};

module.exports = Hashinator;