'use strict';

var Logger = require('./logger.js');

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
  this.executor = null; //TODO put server methods right here!
  this.continueAfterExecute = true;
  this.parser = parser;
  this.onData(buffer);
}

ConnectionHandler.prototype.destroy = function () {
  Logger.log('((((( CONNECTION HANDLER SE UBIJA )))))');
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
  Logger.log ('Connection established!');
};

ConnectionHandler.prototype.onError = function(){
  Logger.log('Handler:  Socket error!');
  this.destroy();
};

ConnectionHandler.prototype.onClose = function(){
  Logger.log('Handler:  Socket closed!');
  this.destroy();
};

ConnectionHandler.prototype.isString = function(thing) {
  return ('string' === typeof thing) || (thing instanceof String);
}

var _zeroBuffer = Buffer(String.fromCharCode(0));

ConnectionHandler.prototype.sendMethodBuffer = function(args,operation){
  if (!args){
    throw new Error('args is required!');
  }
  if (!this.isString(args)){
    throw new Error('first arg must be a string!');
  }
  if (!operation){
    throw new Error('operation is required!');
  }
  if (!this.isString(operation)){
    throw new Error('second arg must be string!');
  }
  this.socket.write(operation, 'utf8');
  this.socket.write(_zeroBuffer);
  this.socket.write(args, 'utf8');
  this.socket.write(_zeroBuffer);
};

ConnectionHandler.prototype.writeData = function (data, operation, addZero) {
  if (!data){
    throw new Error('data is required!');
  }
  if (!this.isString(data)){
    throw new Error('first arg must be string!');
  }
  if (!this.isString(operation)){
    throw new Error('second arg must be string!');
  }
  if (typeof operation.length > 1){
    throw new Error('operation must be a 1 letter string! - ' + operation);
  }
  if (typeof addZero !== 'boolean'){
    throw new Error('addZero must me typeof boolean!');
  }
  if (operation.length === 1) {
    this.socket.write(operation, 'utf8');
  }
  this.socket.write(data,'utf8');
  if (addZero) {
    this.socket.write(_zeroBuffer);
  }
};

ConnectionHandler.prototype.outBuf = function (data) {
  this.writeData(data, '', true);
};

ConnectionHandler.prototype.writeBufferArray = function (bufArray, opCode, addZero) {
  if (!bufArray){
    throw 'bufArray is requried!';
  }
  if (!(typeof bufArray ==='object' && bufArray instanceof Array)){
    throw 'first param has to be an array';
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
  this.socket.write(opCode, 'utf8');
  bufArray.forEach(this.outBuf.bind(this));
};

ConnectionHandler.prototype.socketWriteSecret = function(secret){
  if (!secret){
    throw new Error('socketWriteSecret: secret is required!');
  }
  if (!this.isString(secret)){
    throw new Error('socketWriteSecret accepts string as argument');
  }
  this.writeData(secret, 's', false);
};

ConnectionHandler.prototype.socketWriteError = function(msg){
  if (!msg){
    throw new Error('socketWriteError: must write something!');
  }
  if (!this.isString(msg)){
    throw new Error('socketWriteError: accepts string as argument');
  }
  this.writeData(msg, 'e', true);
  if (!!this.myTcpParent.executingMethod){
    this.myTcpParent.executingMethod = false;
  }
};

ConnectionHandler.prototype.socketWriteResult = function(msg){
  if (!msg){
    throw new Error('socketWriteResult: must write something!');
  }
  if (!this.isString(msg)){
    throw new Error('socketWriteResult: accepts string as argument');
  }
  this.writeData(msg, 'r', true);
  if (!!this.myTcpParent.executingMethod){
    this.myTcpParent.executingMethod = false;
  }
};

ConnectionHandler.prototype.socketWriteNotification = function(msg){
  if (!msg){
    throw new Error('socketWriteNotification: must write something!');
  }
  if (!this.isString(msg)){
    throw new Error('socketWriteNotification: accepts string as argument');
  }
  this.writeData(msg, 'n', true);
};

ConnectionHandler.prototype.socketWriteEvent = function(eventName,msg){
  if (!eventName){
    throw new Error('socketWriteEvent : must write something!');
  }
  if (!this.isString(eventName)){
    throw new Error('socketWriteEvent: accepts string as argument');
  }
  if (!msg){
    throw new Error('socketWriteEvent : must write something!');
  }
  if (!this.isString(msg)){
    throw new Error('socketWriteEvent: accepts string as argument');
  }
  this.writeBufferArray([eventName,msg], 'o');
};

//template method
ConnectionHandler.prototype.onData = function(buffer) {
  if (!this.socket) return;
  if (!buffer) return;
  if (buffer.length<1) return;
  Logger.log('*** Recieved buffer : ' + buffer.toString().replace(String.fromCharCode(0),'#'));
  for (var i=0; i<buffer.length; i++){
    this.parser.executeByte(buffer[i]);
    var executed = this.executeIfReadingFinished(this.executeOnReadingFinished.bind(this,buffer.slice(i+1)));
    if (!!executed && !this.continueAfterExecute){
      return;
    }
  }
};

ConnectionHandler.prototype.onDataCatch = function (buffer) {
  try{
    ConnectionHandler.prototype.onData.call(this,buffer);
  }catch (err){
    Logger.log('HANDLING REQUEST ERROR: ' + err);
    this.socketWriteError(err.toString());
    var s = this.socket;
    this.socket = null;
    s.end();
    s.destroy();
    return;
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
