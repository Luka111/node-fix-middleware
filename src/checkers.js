'use strict';

function IdleCheker(){
}

IdleCheker.prototype.destroy = function(){
};

IdleCheker.prototype.check = function(args){
  if (!(typeof args ==='object' && args instanceof Array)){
    throw new Error('args must be an array');
  }
  if (args.length !== 2){
    throw new Error('LengthChecker accepts 2 params');
  }
  var bufferItem = args[0];
  if (typeof bufferItem !== 'number'){
    throw new Error('buffer item must be a number');
  }
  var currIndex = args[1];
  if (typeof currIndex !== 'number'){
    throw new Error('current index must be a number');
  }
};

function LengthChecker(maxLength){
  this.maxLength = maxLength;
  IdleCheker.call(this);
}

LengthChecker.prototype = Object.create(IdleCheker.prototype, {constructor:{
  value: LengthChecker,
  enumerable: false,
  writable: false
}});

LengthChecker.prototype.destroy = function(){
  this.maxLength = null;
  IdleCheker.prototype.destroy.call(this);
};

LengthChecker.prototype.check = function(args){
  IdleCheker.prototype.check.call(this,args);
  var currIndex = args[1];
  if (currIndex > this.maxLength){
    throw new Error('Maximum length exceeded!');
  }
  return true;
};

module.exports = {
  LengthChecker : LengthChecker
};
