/* This file is part of VoltDB.
 * Copyright (C) 2008-2018 VoltDB Inc.
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
const VoltTable = require("./volttable");

var BigInteger = require("bignumber").BigInteger,
  ctype = require("./ctype"),
  endian = "big";

var NullValueOf = {
  byte: -128,
  short: -32768,
  int: -2147483648,
  long: new BigInteger("-9223372036854775808"),
  double: -1.7E+308,
  decimal: "-170141183460469231731687303715884105728"
};

const {
  TYPES_STRINGS,
  TYPES_NUMBERS,
  TYPES_READ,
  TYPES_WRITE,
  NUMERIC_TYPES,
  STRING_TYPES,
  BIGINT_TYPES
} = require("./voltconstants");

function Parser(buffer) {
  this.buffer = buffer || [];
  this.position = 0;
}

Parser.prototype.write = function(value, type){
  if ( !TYPES_WRITE[type] )
    throw new Error("No writer for type: ", type);

  this[TYPES_WRITE[type]](value);
};

Parser.prototype.readBinary = function(length) {
  return this.buffer.slice(this.position, this.position += length);
};
Parser.prototype.writeBinary = function(buffer) {
  for(var i = 0, l = buffer.length, pos = this.position; i < l; i++) {
    this.buffer[pos + i] = buffer[i];
  }
  this.position += l;
};

Parser.prototype.readByte = function() {
  var res = ctype.rsint8(this.buffer, endian, this.position++);
  if (res === NullValueOf["byte"]) {
    return null;
  } else {
    return res;
  }
};
Parser.prototype.writeByte = function(value) {
  if (value == null) {
    value = NullValueOf["byte"];
  }
  ctype.wsint8(value, endian, this.buffer, this.position++);
};

Parser.prototype.readShort = function() {
  var res = ctype.rsint16(this.buffer, endian, (this.position += 2) - 2);
  if (res === NullValueOf["short"]) {
    return null;
  } else {
    return res;
  }
};
Parser.prototype.writeShort = function(value) {
  if (value == null) {
    value = NullValueOf["short"];
  }
  ctype.wsint16(value, endian, this.buffer, (this.position += 2) - 2);
};

Parser.prototype.readInt = function() {
  var res = ctype.rsint32(this.buffer, endian, (this.position += 4) - 4);
  if (res === NullValueOf["int"]) {
    return null;
  } else {
    return res;
  }
};
Parser.prototype.writeInt = function(value) {
  if (value == null) {
    value = NullValueOf["int"];
  }
  ctype.wsint32(value, endian, this.buffer, (this.position += 4) - 4);
};

Parser.prototype.readDouble = function() {
  var res = ctype.rdouble(this.buffer, endian, (this.position += 8) - 8);
  if (res === NullValueOf["double"]) {
    return null;
  } else {
    return res;
  }
};
Parser.prototype.writeDouble = function(value) {
  if (value == null) {
    value = NullValueOf["double"];
  }
  ctype.wdouble(value, endian, this.buffer, (this.position += 8) - 8);
};

Parser.prototype.readLongBytes = function() {
  var bytes = [], numBytes = 8;
  for(var i = 0; i < numBytes; i++) {
    bytes.push(ctype.ruint8(this.buffer, endian, this.position + i));
  }
  this.position += numBytes;
  return (new BigInteger(bytes));
};

Parser.prototype.readLong = function() {
  var res = this.readLongBytes();
  if (res.equals(NullValueOf["long"])) {
    return null;
  } else {
    return res;
  }
};
Parser.prototype.writeLong = function(value) {
  if (value == null) {
    value = NullValueOf["long"];
  }
  var bytes, numBytes = 8;
  if( typeof value === "number")
    value = new BigInteger(value.toString());
  if(!( value instanceof BigInteger))
    throw new Error("Long type must be a BigInteger or Number");
  bytes = value.toByteArray();
  if (bytes[0] >= 0) {
    while (bytes.length < numBytes) {
      bytes.unshift(0);
    }
  } else {
    while (bytes.length < numBytes) {
      bytes.unshift(-1);
    }
  }

  for(var i = 0; i < numBytes; i++)
    ctype.wsint8(bytes[i], endian, this.buffer, this.position + i);
  this.position += numBytes;
};

Parser.prototype.readString = function() {
  var length = this.readInt();
  if (length < 0) return null;
  return this.buffer.toString("utf8", this.position, this.position += length);
};
Parser.prototype.writeString = function(value) {
  var length;
  if (value == null) {
    length = -1;
  } else {
    var strBuf = new Buffer(value, "utf8");
    length = strBuf.length;
  }
  this.writeInt(length);

  for(var i = 0, pos = this.position; i < length; i++) {
    this.buffer[pos + i] = strBuf[i];
  }
  this.position += Math.max(0, length);
};

Parser.prototype.readDate = function() {
  var bigInt = this.readLongBytes();
  if (bigInt.toString() === NullValueOf["long"]) {
    return null;
  } else {
    var intStr = bigInt.divide(thousand).toString();
    return new Date(parseInt(intStr));
  }
};

Parser.prototype.writeDate = function(value) {
  if (value == null) {
    this.writeLong(null);
  } else {
    var bigInt;
    if (value instanceof Date)
      value = value.getTime();
    else if (typeof value !== "number")
      throw new Error("Date type must be a Date or number");
    bigInt = new BigInteger(value.toString());

    this.writeLong(bigInt.multiply(thousand));
  }
};

Parser.prototype.readDecimal = function() {
  var bytes = [], bigInt, numBytes = 16, decimalPlaces = 12;
  for(var i = 0; i < numBytes; i++)
    bytes.push(ctype.ruint8(this.buffer, endian, this.position + i));
  this.position += numBytes;
  bigInt = new BigInteger(bytes);
  var val = bigInt.toString();

  // handle the null value case
  if(val === NullValueOf["decimal"]) {
    val = null;
  } else if(val.length <= 12) {
    // add leading zeros (e.g. 123 to 0.000000000123)
    val = zeros(decimalPlaces - val.length).join("") + val;
    val = "0." + val;
  } else {
    // put the decimal in the right place
    val = val.slice(0, -decimalPlaces) + "." + val.slice(-decimalPlaces);
  }
  return val;
};
Parser.prototype.writeDecimal = function(value) {
  var bytes, bigInt, numBytes = 16;
  if(value == null) {
    bigInt = new BigInteger(NullValueOf["decimal"]);
  } else {
    if (typeof value === "number")
      value = value.toString();
    if (typeof value != "string" || !(/^-?\d*\.?\d*$/).test(value))
      throw new Error("Decimal type must be a numerical string or Number:" + value);

    // add decimal and missing zeros
    if (value.startsWith(".")) {
      value = "0" + value;
    }
    bigInt = new BigInteger(sanitizeDecimal(value));
  }
  bytes = bigInt.toByteArray();
  if (bytes[0] >= 0) {
    while (bytes.length < numBytes) {
      bytes.unshift(0);
    }
  } else {
    while (bytes.length < numBytes) {
      bytes.unshift(-1);
    }
  }

  for(var i = 0; i < numBytes; i++)
    ctype.wsint8(bytes[i], endian, this.buffer, this.position + i);
  this.position += numBytes;
};

Parser.prototype.readVarbinary = function() {
  var length = this.readInt();
  if (length == -1) {
    return null;
  } else {
    var binary = this.buffer.slice(this.position, this.position + length);
    this.position += length;
    return binary;
  }
};

Parser.prototype.writeVarbinary = function(value) {
  if (value == null) {
    this.writeInt(-1);
  } else {
    this.writeInt(value.length);
    this.writeBinary(value);
  }
};

Parser.prototype.readNull = function() {
  // a no-op, no reading
  return null;
};
Parser.prototype.writeNull = function() {
  // a no-op, no writing
};

Parser.prototype.readArray = function(type, value) {
  type = TYPES_STRINGS[this.readByte()];
  if(type == undefined)
    throw new Error("Unsupported type, update driver");

  var length = (type == "byte" ? this.readInt() : this.readShort());
  var method = TYPES_READ[type];
  value = new Array(length);
  for(var i = 0; i < length; i++) {
    value[i] = this[method]();
  }
  return value;
};

Parser.prototype.writeArray = function(type, value) {
  if(type.slice(0, 5) != "array" && !TYPES_NUMBERS.hasOwnProperty(type))
    throw new Error("Type must be one of: array, null tinyint, smallint," + " integer, bigint, float, string, timestamp, decimal");

  if(!( value instanceof Array))
    throw new Error(("Array value must be an Array"));

  const length = value.length;
  let i = 0;
  let match = null;

  match = type.match(arrExp);

  // if it's a subarray (e.g. type = array[string])
  if( match ) {
    this.writeByte(TYPES_NUMBERS.array);
    // write type 'array' -99
    this.writeShort(length);
    var arrType = match[1];

    // write sub-array values
    for( i = 0; i < length; i++) {
      this.writeArray(arrType, value[i]);
    }
  } else {
    this.writeByte(TYPES_NUMBERS[type]);
    // write type
    // write length
    type == "byte" ? this.writeInt(length) : this.writeShort(length);
    var method = TYPES_WRITE[type];

    // write values
    for( i = 0; i < length; i++) {
      this[method](value[i]);
    }
  }
};

Parser.prototype.readVoltTable = function() {
  const volttable = new VoltTable();

  volttable.readFromBuffer(this);
  
  return volttable;
};

Parser.prototype.writeVoltTable = function(vt) {
  vt.writeToBuffer(this);
};

Parser.prototype.readException = function(length) {
  if(length == 0)
    new Error("An exception has occurred");
  var ordinal = this.readByte();
  // they don't have a spec for exceptions at this time, just skip it.
  this.readBinary(length - 1);
  switch(ordinal){
  case 1: 
    return new Error("EEException");
  case 2: 
    return new Error("SQLException");
  case 3: 
    return new Error("ConstraintFailureException");
  default: 
    return new Error("An exception has occurred");
  }
};

Parser.prototype.writeParameterSet = function(types, values) {

  if(types.length != values.length)
    throw new Error("The number of parameters do not match the number of " + "types defined in the definition.");

  const length = values.length;
  this.writeShort(length);

  for(var i = 0; i < length; i++) {
    var type = types[i];
    var value = values[i];

    checkType(type, value);

    // handle the array type
    let match = type.match(arrExp);
    if( match ) {
      var arrType = match[1];
      this.writeByte(TYPES_NUMBERS.array);
      this.writeArray(arrType, value);
    } else {
      this.writeByte(TYPES_NUMBERS[type]);
      var method = TYPES_WRITE[type];
      this[method](value);
    }
  }
};
// for getting lengths from incoming data
Parser.readInt = function(buffer, offset) {
  if(offset == undefined)
    offset = 0;
  return ctype.rsint32(buffer, endian, offset);
};

exports.Parser = Parser;

var arrExp = /array\[(.*)\]/;



var thousand = new BigInteger("1000");

function zeros(num) {
  var arr = new Array(num);
  for(var i = 0; i < num; i++)
    arr[i] = 0;
  return arr;
}

//it this used??
function ones(num) {
  var arr = new Array(num);
  for(var i = 0; i < num; i++)
    arr[i] = 1;
  return arr;
}
ones(1); //for linter

function checkType(type, value) {
  if(type == "array")
    throw new Error("Type array must have a subtype. E.g. array[string]");

  if(type.slice(0, 5) != "array" && !TYPES_NUMBERS.hasOwnProperty(type))
    throw new Error("Type must be one of: array, null tinyint, smallint, " + "integer, bigint, float, string, timestamp, decimal");

  if( typeof value === "number" && !NUMERIC_TYPES[type])
    throw new Error("Providing a numeric type for a non-numeric field. " + value + " can not be a " + type);

  if( typeof value === "string" && !STRING_TYPES[type])
    throw new Error("Providing a string type for a non-string field. " + value + " can not be a " + type);

  if( value instanceof VoltTable && type !== "volttable" )
    throw new Error("Providing a VoltTable type for a non-VoltTable field. " + value + " can not be a " + type);

  if( !(value instanceof VoltTable) && type == "volttable" )
    throw new Error("Providing a non-VoltTable type for a VoltTable field. " + value + " can not be a " + type);

  if( typeof value === "object" && !( value instanceof Array) && !( value instanceof Uint8Array) && (value != null && !(value instanceof VoltTable)))
    throw new Error("Cannot provide custom objects as procedure parameters");

  if( value instanceof Array && type.slice(0, 5) != "array")
    throw new Error("Providing an array type for a non-array field. " + value + " can not be a " + type);

  if(type.slice(0, 5) == "array" && !( value instanceof Array))
    throw new Error("Providing a non-array value for an array field. " + value + " can not be a " + type);

  if( value instanceof BigInteger && !BIGINT_TYPES[type])
    throw new Error("Providing a BigInteger type for a non-bigint field. " + value + " can not be a " + type);
}

function sanitizeDecimal(value) {
  var MAX_INT_DIGIT = 26, MAX_FRAC_DIGIT = 12;

  var sign = "";
  if (value.startsWith("-")) {
    sign = "-";
    value = value.slice(1);
  }
  
  var parts = value.split(".");
  // first check if the given value is legal
  if (parts[0].length > MAX_INT_DIGIT) {
    throw new Error("The integer part should not have more than" + MAX_INT_DIGIT + "digits.");
  }
  if (parts.length == 2 && parts[1].length > MAX_FRAC_DIGIT) {
    throw new Error("The fractional part should not have more than" + MAX_FRAC_DIGIT + "digits.");
  }

  // add trailing zeros
  if (parts.length == 1) {
    return sign + parts[0] + zeros(MAX_FRAC_DIGIT).join("");
  } else {
    return sign + parts[0] + parts[1] + zeros(MAX_FRAC_DIGIT - parts[1].length).join("");
  }
}