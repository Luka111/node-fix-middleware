'use strict';

var Logger = require('./logger.js');

function Coder(){
  this.decodedTagRegexp = /^[1-9][0-9]*$/;
  this.codedTagRegexp = /^t[1-9][0-9]*$/;
  //Struct name - header, tags, groups , trailer. TODO more?
  //TODO support groups tag
  this.fixStructNames = ['header','tags','trailer'];
  this.sessionIdStructNames = ['sessionID'];
}

Coder.prototype.destroy = function(){
  this.decodedTagRegexp = null;
  this.codedTagRegexp = null;
  this.fixStructNames = null;
  this.sessionIdStructNames = null;
};

//Getters/Setters

Coder.prototype.getDecodedTagRegexp = function(){
  return this.decodedTagRegexp;
};

Coder.prototype.getCodedTagRegexp = function(){
  return this.codedTagRegexp;
};

//Extern coding functions for creating FIX messages

Coder.prototype.decodeFIXmessage = function(codedElement){
  var decodedResult = {};
  //TODO testing for missing properties, for example no tags property
  //TODO support groups tag - forEach will not work because groups tag is different
  try{
    this.fixStructNames.forEach(this.decodeFIXstruct.bind(this,codedElement,decodedResult));
  }catch (err){
    Logger.log('Error in decoding message - ' + err);
    return undefined;
  }
  return decodedResult;
};

Coder.prototype.codeFIXmessage = function(decodedElement){
  var codedResult = {};
  //TODO testing for missing properties, for example no tags property
  //TODO support groups tag - forEach will not work because groups tag is different
  try{
    this.fixStructNames.forEach(this.codeFIXstruct.bind(this,decodedElement,codedResult));
  }catch (err){
    Logger.log('Error in decoding message - ' + err);
    return undefined;
  }
  return codedResult;
};

Coder.prototype.createZeroDelimitedSessionId = function(obj){
  return this.createZeroDelimitedString(obj,this.sessionIdStructNames);
};

Coder.prototype.createZeroDelimitedFixMsg = function(obj){
  return this.createZeroDelimitedString(obj,this.fixStructNames);
};

Coder.prototype.createZeroDelimitedString = function(obj,structNames){
  var result = {value: ''};
  structNames.forEach(this.generatePerProperty.bind(this,obj,result));
  return result.value + String.fromCharCode(0);
}

Coder.prototype.generatePerProperty = function(obj,result,structName){
  if (obj.hasOwnProperty(structName)){
    result.value += this.generateZeroDelimitedTagValue(obj[structName]);
  }
};

Coder.prototype.generateZeroDelimitedTagValue = function(obj){
  var res = '';
  if (!obj){
    return res;
  }
  if (typeof obj !== 'object'){
    return res;
  }
  for (var key in obj){
    if (obj.hasOwnProperty(key)){
      if (typeof obj[key] === 'object'){
        throw new Error('Value must be plain type (not object)');
      }
      res += (key + String.fromCharCode(0) + obj[key] + String.fromCharCode(0));
    }
  }
  return res;
};

Coder.prototype.generateZeroDelimitedTagValueFlat = function(obj){
  return this.generateZeroDelimitedTagValue(obj) + String.fromCharCode(0);
};

//Intern coding functions

Coder.prototype.codeFIXstruct = function(decodedElement,codedResult,structName){
  if (this.fixStructNames.indexOf(structName) === -1){
    throw new Error(structName + ' is invalid struct name');
  }
  if (!decodedElement.hasOwnProperty(structName)){
    return;
  }
  codedResult[structName] = {};
  var invalidKey = this.codeObject(decodedElement[structName],codedResult[structName],this.decodedTagRegexp);
  if (invalidKey !== null){
    throw new Error('Coded ' + structName + ' tag ' + invalidKey + ' is not valid')
  }
};

Coder.prototype.decodeFIXstruct = function(codedElement,decodedResult,structName){
  if (this.fixStructNames.indexOf(structName) === -1){
    throw new Error(structName + ' is invalid struct name');
  }
  if (!codedElement.hasOwnProperty(structName)){
    return;
  }
  decodedResult[structName] = {};
  var invalidKey = this.decodeObject(codedElement[structName],decodedResult[structName],this.codedTagRegexp);
  if (invalidKey !== null){
    throw new Error('Decoded ' + structName + ' tag ' + invalidKey + ' is not valid')
  }
};

Coder.prototype.decodeObject = function(nondecodedobj,decodedobj,regexp){
  for (var key in nondecodedobj){
    if (nondecodedobj.hasOwnProperty(key)){
      if(!regexp.test(key)) return key;
      var decodedKey = key.substring(1);
      decodedobj[decodedKey] = nondecodedobj[key];
    }
  }
  return null;
};

Coder.prototype.codeObject = function(noncodedobj,codedobj,regexp){
  for (var key in noncodedobj){
    if (noncodedobj.hasOwnProperty(key)){
      if(!regexp.test(key)) return key;
      var codedKey = 't' + key;
      codedobj[codedKey] = noncodedobj[key];
    }
  }
  return null;
};

module.exports = new Coder();
