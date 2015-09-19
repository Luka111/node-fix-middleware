'use strict';

var should = require('should');

function Helper(){
}

Helper.prototype.destroy = function(){
}

Helper.prototype.generate300CharsWord = function(){
  var ret = '';
  for (var i=0; i<300; i++){
    ret += 'a';
  }
  return ret;
};

Helper.prototype.replaceOriginalUncaughtExceptionHandler = function(errMsg, done){
  var expectedError = new Error(errMsg);
  var originalExceptionListener = process.listeners('uncaughtException').pop();
  process.removeListener('uncaughtException', originalExceptionListener);
  process.once('uncaughtException',this.checkErrorAndRestoreOriginalHandler.bind(this,done,originalExceptionListener,expectedError));
};

Helper.prototype.checkErrorAndRestoreOriginalHandler = function(done,originalExceptionListener,expectedError,recievedError){
  should.equal(expectedError.message,recievedError.message);
  process.addListener('uncaughtException',originalExceptionListener);
  done();
};

module.exports = new Helper();
