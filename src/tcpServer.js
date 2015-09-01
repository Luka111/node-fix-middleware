'use strict';

var net = require('net');
var fixInitiator = require('./fix/fixInitiator.js');
var Listeners = require('./listeners.js');
var crypto = require('crypto');

function ServerMethods(){
  this.startFixInitiator = null;
  this.sendFixMsg = null;
  this.getStatistics = null;
}

ServerMethods.prototype.destroy = function(){
  this.getStatistics = null;
  this.sendFixMsg = null;
  this.startFixInitiator = null;
};

function tcpFixServer(){
  this.methods = new ServerMethods();
  //TODO add methods
  this.server = net.createServer(this.onConnection.bind(this));
  this.fixInitiator = null;
  this.listeners = new Listeners('INITIATOR');
};

tcpFixServer.prototype.destroy = function(){
  this.listeners.destroy();
  this.listeners = null;
  if (!!this.fixInitiator){
    this.fixInitiator.destroy();
  }
  this.fixInitiator = null;
  this.server.close();
  this.server = null;
  this.methods.destroy();
  this.methods = null;
};

//Intern methods

tcpFixServer.prototype.start = function(port){
  this.server.listen(port,this.onListening.bind(this));
};

tcpFixServer.prototype.startFixInitiator = function(settings){
  this.fixInitiator = new fixInitiator(settings);
  this.fixInitiator.start();
  this.fixInitiator.registerEventListeners(this.listeners);
};

tcpFixServer.checkCredentials = function(name, password){
  var correct = ((name === 'luka') && (password === 'kp'));
  console.log('For testing only: ' + name + ' : ' + password + ' - ' + correct + ' credentials!');
  return correct;
  //TODO real DB checking
};

//TODO remove, just for testing
tcpFixServer.validSecrets = [];

tcpFixServer.checkSecret = function(secret){
  if (tcpFixServer.validSecrets.indexOf(secret) !== -1){
    return true;
  }else{
    return false;
  }
  //TODO real DB checking
};

tcpFixServer.generateSecret = function(){
  //TODO real secret generator
  var rand16 = crypto.randomBytes(8).toString('hex');
  tcpFixServer.validSecrets.push(rand16);
  return rand16;
};

//Event listeners

tcpFixServer.prototype.onConnection = function(socket){
  console.log('New connection - ', socket.remoteAddress);
  //Listeners
  socket.on('error',this.onError.bind(this,socket));
  socket.on('close', this.onClose.bind(this));
  socket.on('data', this.onData.bind(this, socket));
};

tcpFixServer.prototype.onListening = function(){
  console.log('Server started!');
};

tcpFixServer.prototype.onError = function(socket){
  console.log('Error with ' +  socket.remoteAddress + '\n Closing connection');
  this.destroy();
};

tcpFixServer.prototype.onClose = function(){
  console.log('Socket closed.');
  this.destroy();
};

tcpFixServer.prototype.onData = function(socket, buffer){
  var ctor = null;
  switch(buffer[0]) { 
    case 99:
      ctor = CredentialsHandler;
      break;
    case 115:
      ctor = SessionHandler;
      break;
  }
  if (!ctor) {
    console.log('no ctor while reading', buffer, ', socket will be destroyed');
    socket.destroy();
    return;
  }
  new ctor(socket, buffer.slice(1));
};


function ConnectionHandler(socket, buffer) {
  socket.removeAllListeners();
  socket.on('error', this.onSocketError.bind(this));
  socket.on('close', this.onSocketClosed.bind(this));
  socket.on('data', this.onData.bind(this));
  this.socket = socket;
  this.cache = null; //will become buffer if necessery
  this.lastWrittenIndex = 0;
  this.initialCacheSize = 1024; //TODO test why doesnt work for 1
  this.onData(buffer);
}

//Abstract Handler

ConnectionHandler.prototype.destroy = function () {
  this.initialCacheSize = null;
  this.lastWrittenIndex = null;
  this.cache = null;
  this.socket = null;
};

ConnectionHandler.prototype.onSocketError = function () {
  console.log('Handler:  Socket error!');
  this.destroy();
};

ConnectionHandler.prototype.onSocketClosed = function () {
  console.log('Handler:  Socket closed!');
  this.destroy();
};

//template method
ConnectionHandler.prototype.onData = function (buffer) {
  console.log('*** Recieved buffer :',buffer);
  this.saveToCache(buffer);
  for (var i=0; i<buffer.length; i++){
    this.executeOnEveryByte(buffer,i);
    var executed = this.executeIfReadingFinished(this.executeOnReadingFinished.bind(this,buffer));
    if (!!executed) return;
  }
};

//abstract
ConnectionHandler.prototype.readingFinished = function(){
  throw Error('readingFinished not implemented');
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
  throw Error('executeOnReadingFinished not implemented');
};

//abstract
ConnectionHandler.prototype.executeOnEveryByte = function(){
  throw Error('executeOnEveryByte not implemented');
};

ConnectionHandler.prototype.saveToCache = function(buffer){
  this.checkCache(buffer);
  this.cache.write(buffer.toString(),this.lastWrittenIndex);
  this.lastWrittenIndex += buffer.length;
};

ConnectionHandler.prototype.checkCache = function(buffer){
  if (!this.cache){
    this.cache = new Buffer(this.initialCacheSize * (Math.floor(buffer.length / this.initialCacheSize) + 1));
  }
  if(this.cache.length < this.lastWrittenIndex + buffer.length){
    //TODO test doubling cache
    console.log('CACHE TOO SMALL, SIZE: ' + this.cache.length);
    var newCache = new Buffer(2 * this.cache.length);
    newCache.write(this.cache.toString());
    this.cache = newCache;
    console.log('CACHE DOUBLED, SIZE: ' + this.cache.length);
  }
}

//Credentials Handler - chekcing user credentials after 'c'

function CredentialsHandler(socket, buffer) {
  console.log('new CredentialsHandler', socket.remoteAddress, buffer, '.');
  this.zeroCnt = 0;
  this.name = '';
  this.password = '';
  ConnectionHandler.call(this, socket, buffer);
}

CredentialsHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: CredentialsHandler,
  enumerable: false,
  writable: false
}});

CredentialsHandler.prototype.destroy = function(){
  this.password = null;
  this.name = null;
  this.zeroCnt = null;
  if (!!this.socket){
    this.socket.destroy();
  }
  ConnectionHandler.prototype.destroy.call(this);
};

CredentialsHandler.prototype.readingFinished = function(){
  return this.zeroCnt === 2; //reading until 2 zeros
};

CredentialsHandler.prototype.executeOnEveryByte = function(buffer,i){
  if (buffer[i] === 0){
    this.zeroCnt++;
    //first zero - name
    if (this.zeroCnt === 1){
      this.name = this.cache.toString().substring(0,this.lastWrittenIndex - buffer.length + i);
    }
    //second zero - password 
    if (this.zeroCnt === 2){
      this.password = this.cache.toString().substring(this.name.length + 1,this.lastWrittenIndex - buffer.length + i);
    }
  }
};

CredentialsHandler.prototype.executeOnReadingFinished = function(buffer){
  if (tcpFixServer.checkCredentials(this.name,this.password)){
    var secret = tcpFixServer.generateSecret();
    this.socket.write('SECRET#' + secret);
  }else{
    this.socket.write('Incorrect username/password!');
  }
  var s = this.socket;
  this.socket = null;
  s.destroy();
  //TODO maybe check if there is anything after second zero, error? - got buffer but not needed atm
};

//Session Handler - checking Secret (first 16 bytes) after 's'

function SessionHandler(socket, buffer) {
  console.log('new SessionHandler');
  this.secret = '';
  this.bytesRead = 0;
  ConnectionHandler.call(this, socket, buffer);
}

SessionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: SessionHandler,
  enumerable: false,
  writable: false
}});

SessionHandler.prototype.destroy = function(){
  this.bytesRead = null;
  this.secret = null;
};

SessionHandler.prototype.readingFinished = function(){
  return this.bytesRead === 16;
};

SessionHandler.prototype.executeOnReadingFinished = function(buffer){
  var bufferLeftover = buffer.slice(16);
  var s = this.socket;
  if (tcpFixServer.checkSecret(this.secret)){
    console.log('++DOBAR SECRET!++');
    this.socket.write('Correct secret, your request will be processed');
    this.destroy();
    new RequestHandler(s,bufferLeftover);
  }else{
    console.log('--LOS SECRET!--');
    this.socket.write('Incorrect secret!');
    this.socket.destroy();
  }
};

SessionHandler.prototype.executeOnEveryByte = function(){
  this.bytesRead++;
  console.log('DO SAD JE PROCITANO',this.bytesRead,'bajta');
  if (this.bytesRead === 16){
    this.secret = this.cache.toString().substring(0,16);
    console.log('PROCITANO 16 BAJTA, dobijen ovaj secret :',this.secret);
  }
};

//Request Handler - parsing user request -> <operation name>0<param0>0<param1>0...<paramN>0

function RequestHandler(socket, buffer) {
  console.log('new Request handler');
  ConnectionHandler.call(this, socket, buffer);
}

RequestHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: RequestHandler,
  enumerable: false,
  writable: false
}});

RequestHandler.prototype.destroy = function(){
};

module.exports = tcpFixServer;
