'use strict';

function Coder(){
  this.decodedTagRegexp = /^[1-9][0-9]*$/;
  this.codedTagRegexp = /^t[1-9][0-9]*$/;
}

Coder.prototype.destroy = function(){
  this.decodedTagRegexp = null;
  this.codedTagRegexp = null;
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
