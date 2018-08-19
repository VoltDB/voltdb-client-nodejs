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

const { TYPES_NUMBERS, TYPES_SIZES, TYPES_STRINGS, TYPES_READ } = require("./voltconstants");

const bufferSize = str => str !== null ? 4 + str.length : 4;

const arrayEquals = (a,b) => {
  if ( !a && !b ) return true;

  if ( !!a !== !!b || a.length !== b.length ) return false;
  
  return a.reduce( (result, aItem, aIdx) => result && aItem === b[aIdx] , true);
};

const bigNumberEquals = (a,b) => {
  const trimZeroRegex = /^0+|0+$/gm;
  return a.toString().replace(trimZeroRegex,"") === b.toString().replace(trimZeroRegex,"");
};

const sizeRow = (vt,i) => {
  let size = 0;

  vt.columnTypes.forEach( (col, j) => {
    switch(col){
    case "string":
    case "varbinary":
      size += bufferSize(vt.data[i][vt.columnNames[j]]);
      break;
    default:
      size += TYPES_SIZES[col];
    }
  });

  return size;
};

function VoltTable(){
  this.data = [];
  this.status = null;
  this.columnNames = [];
  this.columnTypes = [];

  this.addColumn = this.addColumn.bind(this);
  this.addRow = this.addRow.bind(this);
  this.writeToBuffer = this.writeToBuffer.bind(this);
  this.readFromBuffer = this.readFromBuffer.bind(this);
  this.length = 0;
}

VoltTable.prototype.addColumn = function(name, type, defaultValue = null){
  type = type.toLowerCase();

  if ( !TYPES_NUMBERS[type] )
    throw new Error(type + " is not a valid type. Valid types: " + JSON.stringify(Object.keys(TYPES_NUMBERS)));

  type = type === "tinyint" ? "byte" : type;
  type = type === "smallint" ? "short" : type;
  type = type === "integer" ? "int" : type;
  type = type === "bigint" ? "long" : type;
  type = type === "float" ? "double" : type;
  type = type === "timestamp" ? "date" : type;

  name = name.toUpperCase();
  this.columnNames.push(name);
  this.columnTypes.push(type.toLowerCase());

  this.data.forEach( row => row[name] = defaultValue );
};

VoltTable.prototype.addRow = function(...args){
  if (args.length === this.columnNames.length){
    throw new Error( JSON.stringify(args) + " does not match table schema: " + JSON.stringify(this.columnTypes) );
  }

  let idx = this.data.length;
  this.data[idx] = {};

  this.columnNames.forEach((name,i) => this.data[idx][name] = args[i] || null);
};

VoltTable.prototype.writeToBuffer = function(parser){
  const { status, columnNames: names, columnTypes: types } = this;

  //status + colCount + typesLength
  let headerSize = 1 + 2 + names.length;

  //+names.length
  names.forEach( name => {
    headerSize += bufferSize(name);
  });
  
  //rowCount
  let dataSize = 4;

  //+rows.length
  const rowSizes = [];
  this.data.forEach( (row, i) => {
    rowSizes[i] = sizeRow(this,i);
    dataSize += 4 + rowSizes[i];
  });
    
  //headerSize + header + data
  const tableSize = 4 + headerSize + dataSize;
  
  parser.writeInt(tableSize);
  parser.writeInt(headerSize);
  parser.writeByte(status);
  parser.writeShort(types.length);
  
  for( let i = 0 ; i < types.length ; i++){
    const type = TYPES_NUMBERS[types[i]];
    parser.writeByte(type);
  }
  
  for( let i = 0 ; i < names.length ; i++){
    parser.writeString(names[i]);
  }
  
  parser.writeInt(this.data.length);

  for(let i = 0 ; i < this.data.length ; i++){
    let size = rowSizes[i];
    parser.writeInt(size);
  
    for(let j = 0; j < names.length; j++){
      parser.write(this.data[i][names[j]], types[j]);
    }
  }   
};

VoltTable.prototype.readFromBuffer = function(parser){
  parser.readInt();   //Volttable Length
  parser.readInt();   //Column Header length
  
  this.status = parser.readByte();
  const columnCount = parser.readShort();

  this.columnNames = new Array(columnCount);
  for(let i = 0; i < columnCount; i++) {
    let typeByte = parser.readByte();
    this.columnTypes[i] = TYPES_STRINGS[typeByte];
  }
  
  this.columnNames = new Array(columnCount);
  for(let i = 0; i < columnCount; i++) {
    this.columnNames[i] = parser.readString();
  }

  this.data = new Array(parser.readInt());

  // data
  for(let i = 0; i < this.data.length; i++) {
    parser.readInt(); //Row Length
    

    let row = {};

    for(let j = 0; j < columnCount; j++) {
      let read = TYPES_READ[this.columnTypes[j]];
      row[this.columnNames[j]] = parser[read]();
    }

    this.data[i] = row;
  }
};

VoltTable.prototype.equals = function(volttable){
  if (! arrayEquals(this.columnNames, volttable.columnNames) ) return false;
  if (! arrayEquals(this.columnTypes, volttable.columnTypes) ) return false;

  if ( this.data.length !== volttable.data.length ) return false;

  const names = this.columnNames;

  for(let i = 0; i < this.data.length; i++){
    for(let j = 0; j < names.length; j++){

      let a = this.data[i][names[j]];
      let b = volttable.data[i][names[j]];

      switch(this.columnTypes[j]){
      case "string":
      case "double":
      case "float":
      case "byte":
      case "tiny":
      case "smallint":
      case "short":
      case "integer":
      case "int":
        if ( a !== b ) return false;
        break;
      case "date":
      case "timestamp":
        if ( a.getTime() !== b.getTime()) return false;
        break;
      case "bigint":
      case "long":
      case "decimal":
        if ( !bigNumberEquals(a, b) ) return false;
        break;
      case "varbinary":
        if ( !a.equals(b) ) return false;
      }
    }
    
  }

  return true;
};

module.exports = VoltTable;