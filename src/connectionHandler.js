'use strict';

//Abstract Handler
//TODO check if i give every ConnectionHandler buffer leftover in constr..?
function ConnectionHandler(socket, buffer, myTcpParent, parser) {
  socket.removeAllListeners();
  socket.on('connect', this.onConnect.bind(this));
  socket.on('error', this.onError.bind(this));
  socket.on('close', this.onClose.bind(this));
  socket.on('data', this.onData.bind(this));
  this.socket = socket;
  this.myTcpParent = myTcpParent;
  this.myTcpParent.connectionHandler = this;
  this.executor = null; //TODO put server methods right here!
  this.continueAfterExecute = true;
  this.parser = parser;
  this.onData(buffer);
}

ConnectionHandler.prototype.destroy = function () {
  console.log('((((( CONNECTION HANDLER SE UBIJA )))))');
  if (!!this.parser){
    this.parser.destroy();
  }
  this.parser = null;
  this.continueAfterExecute = null;
  if (!!this.executor){
    this.executor.destroy();
  }
  this.executor = null;
  this.myTcpParent = null;
  this.socket = null;
};

ConnectionHandler.prototype.onConnect = function(){
  console.log ('Connection established!');
};

ConnectionHandler.prototype.onError = function(){
  console.log('Handler:  Socket error!');
  this.destroy();
};

ConnectionHandler.prototype.onClose = function(){
  console.log('Handler:  Socket closed!');
  this.destroy();
};

ConnectionHandler.prototype.sendMethodBuffer = function(buffer,operation){
  if (!buffer){
    throw new Error('buffer is required!');
  }
  if (!Buffer.isBuffer(buffer)){
    throw new Error('first arg must be buffer!');
  }
  if (!operation){
    throw new Error('operation is required!');
  }
  if (!Buffer.isBuffer(operation)){
    throw new Error('second arg must be buffer!');
  }
  var newBuffer = new Buffer(operation.length + 1 + buffer.length + 1);
  operation.copy(newBuffer);
  newBuffer[operation.length] = 0;
  buffer.copy(newBuffer,operation.length+1);
  newBuffer[newBuffer.length - 1] = 0;
  this.socket.write(newBuffer);
};

ConnectionHandler.prototype.makeWriteBuffer = function(buffer,operation,addZero){
  if (!buffer){
    throw new Error('buffer is required!');
  }
  if (!Buffer.isBuffer(buffer)){
    throw new Error('first arg must be buffer!');
  }
  if (typeof operation !== 'string'){
    throw new Error('second arg must be string!');
  }
  if (typeof operation.length > 1){
    throw new Error('operation must be 1 letter string! - ' + operation);
  }
  if (typeof addZero !== 'boolean'){
    throw new Error('addZero must me typeof boolean!');
  }
  var newBuffer = new Buffer(buffer.length + (!!addZero ? 1 : 0) + operation.length);
  if (operation.length === 1){
    newBuffer[0] = operation.charCodeAt(0);
  }
  buffer.copy(newBuffer,operation.length);
  if (!!addZero){
    newBuffer[newBuffer.length - 1] = 0;
  }
  return newBuffer;
};

ConnectionHandler.prototype.makeWriteBufferArray = function(bufArray,opCode){
  if (!bufArray){
    throw 'bufArray is requried!';
  }
  if (!(bufArray instanceof Array)){
    throw 'makeWriteBufferArray accepts array of params';
  }
  if (bufArray.length === 0){
    throw 'array is empty';
  }
  if (!opCode){
    throw 'opCode is requried!';
  }
  if (typeof opCode !== 'string'){
    throw 'opCode must be string!';
  }
  if (typeof opCode.length > 1){
    throw 'opCode must be length 1!';
  }
  var concatArray = [];
  concatArray.push(this.makeWriteBuffer(bufArray[0],opCode,true));
  for (var i=1; i<bufArray.length; i++){
    concatArray.push(this.makeWriteBuffer(bufArray[i],'',true));
  }
  return Buffer.concat(concatArray);
};

ConnectionHandler.prototype.socketWriteSecret = function(secret){
  if (!secret){
    throw new Error('socketWriteSecret: secret is required!');
  }
  if (!Buffer.isBuffer(secret)){
    throw new Error('socketWriteSecret accepts buffer as argument');
  }
  this.socket.write(this.makeWriteBuffer(secret,'s',false));
};

ConnectionHandler.prototype.socketWriteError = function(msg){
  if (!msg){
    throw new Error('socketWriteError: must write something!');
  }
  if (!Buffer.isBuffer(msg)){
    throw new Error('socketWriteError: accepts buffer as argument');
  }
  this.socket.write(this.makeWriteBuffer(msg,'e',true));
  if (!!this.myTcpParent.executingMethod){
    this.myTcpParent.executingMethod = false;
  }
};

ConnectionHandler.prototype.socketWriteResult = function(msg){
  if (!msg){
    throw new Error('socketWriteResult: must write something!');
  }
  if (!Buffer.isBuffer(msg)){
    throw new Error('socketWriteResult: accepts buffer as argument');
  }
  this.socket.write(this.makeWriteBuffer(msg,'r',true));
  if (!!this.myTcpParent.executingMethod){
    this.myTcpParent.executingMethod = false;
  }
};

ConnectionHandler.prototype.socketWriteNotification = function(msg){
  if (!msg){
    throw new Error('socketWriteNotification: must write something!');
  }
  if (!Buffer.isBuffer(msg)){
    throw new Error('socketWriteNotification: accepts buffer as argument');
  }
  this.socket.write(this.makeWriteBuffer(msg,'n',true));
};

ConnectionHandler.prototype.socketWriteEvent = function(eventName,msg){
  if (!eventName){
    throw new Error('socketWriteEvent : must write something!');
  }
  if (!Buffer.isBuffer(eventName)){
    throw new Error('socketWriteEvent: accepts buffer as argument');
  }
  if (!msg){
    throw new Error('socketWriteEvent : must write something!');
  }
  if (!Buffer.isBuffer(msg)){
    throw new Error('socketWriteEvent: accepts buffer as argument');
  }
  var buffer = this.makeWriteBufferArray([eventName,msg],'o');
  this.socket.write(buffer);
};

//template method
ConnectionHandler.prototype.onData = function (buffer) {
  if (!this.socket) return;
  if (!buffer) return;
  console.log('*** Recieved buffer :',buffer.toString());
  for (var i=0; i<buffer.length; i++){
    this.parser.executeByte(buffer[i]);
    var executed = this.executeIfReadingFinished(this.executeOnReadingFinished.bind(this,buffer));
    if (!!executed && !this.continueAfterExecute){
      return;
    }
  }
};

//abstract
ConnectionHandler.prototype.readingFinished = function(){
  throw new Error('readingFinished not implemented');
};

ConnectionHandler.prototype.executeIfReadingFinished = function(cb){
  if (this.readingFinished()){
    cb();
    return true;
  }
  return false;
};

//abstract
ConnectionHandler.prototype.executeOnReadingFinished = function(){
  throw new Error('executeOnReadingFinished not implemented');
};

module.exports = ConnectionHandler;
