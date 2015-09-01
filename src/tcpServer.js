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
  this.methods.startFixInitiator = this.startFixInitiator.bind(this);
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

//RMI

tcpFixServer.prototype.startFixInitiator = function(args){
  if (!(args instanceof Array)){
    throw 'startFixInitiator accepts array of params';
  }
  if (args.length !== 1){
    throw 'startFixInitiator requires exactly 1 param';
  }
  var settings = args[0];
  if (typeof settings !== 'string'){
    throw 'startFixInitiator requires string as the first param!';
  }
  //TODO ovde mora ozbiljan sanity check za ovaj string, jer quickfix puca ako se da los settings string
  this.fixInitiator = new fixInitiator(settings);
  this.fixInitiator.start();
  this.fixInitiator.registerEventListeners(this.listeners);
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
  new ctor(socket, buffer.slice(1), this);
};

//Static methods

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


function ConnectionHandler(socket, buffer, myTcpFixServer) {
  socket.removeAllListeners();
  socket.on('error', this.onSocketError.bind(this));
  socket.on('close', this.onSocketClosed.bind(this));
  socket.on('data', this.onData.bind(this));
  this.socket = socket;
  this.myTcpFixServer = myTcpFixServer;
  this.cache = null; //will become buffer if necessery
  this.lastWrittenIndex = 0;
  this.initialCacheSize = 1024; //TODO test why doesnt work for 1
  this.lastWrittenWordIndex = 0;
  this.onData(buffer);
}

//Abstract Handler

ConnectionHandler.prototype.destroy = function () {
  this.lastWrittenWordIndex = null;
  this.initialCacheSize = null;
  this.lastWrittenIndex = null;
  this.cache = null;
  this.myTcpFixServer = null;
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
  console.log('*** Recieved buffer :',buffer.toString());
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

ConnectionHandler.prototype.generateNextWord = function(buffer,i){
  var word = this.cache.toString().substring(this.lastWrittenWordIndex, this.lastWrittenIndex - buffer.length + i);
  console.log('IZGENERISAO SAM OVU REC',word,'ovo je bio wordindex',this.lastWrittenWordIndex);
  this.lastWrittenWordIndex += word.length + 1;
  console.log('A posle ovo wordindex',this.lastWrittenWordIndex);
  return word;
};

//Credentials Handler - chekcing user credentials after 'c'

function CredentialsHandler(socket, buffer, myTcpFixServer) {
  console.log('new CredentialsHandler', socket.remoteAddress, buffer, '.');
  this.zeroCnt = 0;
  this.name = '';
  this.password = '';
  ConnectionHandler.call(this, socket, buffer, myTcpFixServer);
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
      this.name = this.generateNextWord(buffer,i);
    }
    //second zero - password 
    if (this.zeroCnt === 2){
      this.password = this.generateNextWord(buffer,i);
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

function SessionHandler(socket, buffer, myTcpFixServer) {
  console.log('new SessionHandler');
  this.secret = '';
  this.bytesRead = 0;
  ConnectionHandler.call(this, socket, buffer, myTcpFixServer);
}

SessionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: SessionHandler,
  enumerable: false,
  writable: false
}});

SessionHandler.prototype.destroy = function(){
  this.bytesRead = null;
  this.secret = null;
  ConnectionHandler.prototype.destroy.call(this);
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
    var myTcpFixServer = this.myTcpFixServer;
    this.destroy();
    new RequestHandler(s,bufferLeftover,myTcpFixServer);
  }else{
    console.log('--LOS SECRET!--');
    this.socket.write('Incorrect secret!');
    this.socket.destroy();
  }
};

SessionHandler.prototype.executeOnEveryByte = function(buffer,i){
  this.bytesRead++;
  console.log('DO SAD JE PROCITANO',this.bytesRead,'bajta');
  if (this.bytesRead === 16){
    this.secret = this.cache.toString().substring(0,16);
    console.log('PROCITANO 16 BAJTA, dobijen ovaj secret :',this.secret);
  }
};

//Request Handler - parsing user request -> <operation name>0<param0>0<param1>0...<paramN>0

function RequestHandler(socket, buffer, myTcpFixServer) {
  console.log('new Request handler');
  this.operationName = '';
  this.reqArguments = [];
  this.zeroCnt = 0;
  this.requiredZeros = 1; //dynamically changing according to the number of operation params
  ConnectionHandler.call(this, socket, buffer, myTcpFixServer);
}

RequestHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: RequestHandler,
  enumerable: false,
  writable: false
}});

RequestHandler.prototype.destroy = function(){
  console.log('(((( REQUEST HANDLER: UBIJAM SE ))))');
  this.requiredZeros = null;
  this.zeroCnt = null;
  this.reqArguments = null;
  this.operationName = null; 
  if (!!this.socket){
    this.socket.destroy();
  }
  ConnectionHandler.prototype.destroy.call(this);
};

RequestHandler.prototype.readingFinished = function(){
  return this.zeroCnt === this.requiredZeros;
};

RequestHandler.prototype.executeOnReadingFinished = function(buffer){
  console.log('FINISHED reading arguments for',this.operationName,'method. Calling it...');
  this.myTcpFixServer.methods[this.operationName].call(this.myTcpFixServer,this.reqArguments);
};

RequestHandler.prototype.executeOnEveryByte = function(buffer, i){
  if (buffer[i] === 0){
    this.zeroCnt++;
    if (this.zeroCnt === 1){
      this.operationName = this.generateNextWord(buffer,i);
      if (this.myTcpFixServer.methods.hasOwnProperty(this.operationName)){
        console.log('METHOD',this.operationName,'exists and requires',this.myTcpFixServer.methods[this.operationName].length,'params');
        this.requiredZeros += this.myTcpFixServer.methods[this.operationName].length;
      }else{
        this.requiredZeros = undefined;
        var s = this.socket;
        this.socket = null;
        s.destroy();
        console.log('Sever does not implement',this.operationName,'method.');
      }
    }
    if (this.zeroCnt > 1){
      var argument = this.generateNextWord(buffer,i);
      console.log('GENERISAO SAM OVU REC',argument);
      this.processArgument(argument);
      this.reqArguments.push(argument);
      console.log('EVO SU TRENUTNI ARGUMENTI',this.reqArguments);
    }
  }
};

RequestHandler.prototype.processArgument = function(arg){

};

module.exports = tcpFixServer;
