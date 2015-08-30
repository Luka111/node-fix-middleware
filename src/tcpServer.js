'use strict';

var net = require('net');
var fixInitiator = require('./fix/fixInitiator.js');
var Listeners = require('./listeners.js');

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

tcpFixServer.generateSecret = function(){
  var nestoOd16Bita = 'blabla';
  //TODO real secret generator
  return nestoOd16Bita;
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
  this.initialCacheSize = 1024;
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
  this.destroy();
};

ConnectionHandler.prototype.onSocketClosed = function () {
  this.destroy();
};

ConnectionHandler.prototype.onData = function (buffer) {
  throw Error('onData not implemented');
};

ConnectionHandler.prototype.readingFinished = function(){
  return true; //reading byte by byte
};

ConnectionHandler.prototype.executeIfReadingFinished = function(cb){
  if (this.readingFinished()){
    cb();
    return true;
  }
  return false;
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
  this.socket.destroy();
  ConnectionHandler.prototype.destroy.call(this);
};

CredentialsHandler.prototype.readingFinished = function(){
  return this.zeroCnt === 2; //reading until 2 zeros
};

CredentialsHandler.prototype.onSocketError = function () {
  console.log('Credentials handler: Socket error!');
};

CredentialsHandler.prototype.onSocketClosed = function () {
  console.log('Credentials handler:  Socket closed!');
};

CredentialsHandler.prototype.onData = function(buffer) {
  console.log('*************', buffer);
  this.saveToCache(buffer);
  console.log('*************', this.cache);
  for (var i=0; i<buffer.length; i++){
    if (buffer[i] === 0){
      this.zeroCnt++;
      //first zero - name
      if (this.zeroCnt === 1){
        this.name = this.cache.toString().substring(0,this.lastWrittenIndex - buffer.length + i);
      }
      if (this.zeroCnt === 2){
        this.password = this.cache.toString().substring(this.name.length + 1,this.lastWrittenIndex - buffer.length + i);
      }
      var executed = this.executeIfReadingFinished(this.executeOnReadingFinished.bind(this));
      if (!!executed) return;
    }
  }
};

CredentialsHandler.prototype.executeOnReadingFinished = function(){
  if (tcpFixServer.checkCredentials(this.name,this.password)){
    var secret = tcpFixServer.generateSecret();
    this.socket.write(secret);
  }else{
    this.socket.write('Invalid username/password');
  }
  this.destroy();
  //TODO maybe check if there is anything after second zero, error?
};

//Session Handler - checking Secret (first 16 bytes) after 's'

function SessionHandler(socket, buffer) {
  console.log('new SessionHandler', arguments);
  ConnectionHandler.call(this, socket, buffer);
}

SessionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: SessionHandler,
  enumerable: false,
  writable: false
}});

SessionHandler.prototype.onData = function(buffer) {
};


module.exports = tcpFixServer;
