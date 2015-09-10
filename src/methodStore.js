'use strict';

function MethodStore(){
}

MethodStore.prototype.destroy = function(){
};

MethodStore.prototype.callMethod = function(methodName,reqArguments){
  if (!this.isImplemented(methodName)){
    throw new Error('Method ' + methodName + ' is not implemented!');
  }
  this[methodName](reqArguments);
};

MethodStore.prototype.isImplemented = function(methodName){
  return this.hasOwnProperty(methodName);
};

MethodStore.prototype.getParamCnt = function(methodName){
  if (!this.isImplemented(methodName)){
    throw new Error('Method ' + methodName + ' is not implemented!');
  }
  return this[methodName].length;
};

module.exports = MethodStore;
