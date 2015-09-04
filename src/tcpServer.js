'use strict';

var net = require('net');
var fixInitiator = require('./fix/fixInitiator.js');
var Listeners = require('./listeners.js');
var Parsers = require('./parsers.js');
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
  this.methods.sendFixMsg = this.sendFixMsg.bind(this);
  this.server = net.createServer(this.onConnection.bind(this));
  this.fixInitiator = null;
  this.listeners = new Listeners('INITIATOR');
  this.dataDelimiter = '#';
};

tcpFixServer.prototype.destroy = function(){
  this.dataDelimiter = null;
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

tcpFixServer.prototype.sendFixMsg = function(args){
  if (!(args instanceof Array)){
    throw new Error('sendFixMsg accepts array of params');
  }
  if (args.length !== 1){
    throw new Error('sendFixMsg requires exactly 1 param');
  }
  var msg = args[0];
  console.log('STA SALJES BRE??',msg);
  if (typeof msg !== 'object'){
    throw new Error('sendFixMsg requires object as the first param! - ' + msg);
  }
  //TODO ovde mora ozbiljan sanity check za fix msg, jer quickfix puca ako se da losa poruka 
  if (!this.fixInitiator){
    throw new Error('FIX initiator is not started!');
  }
  this.sendCheckedMsg(msg);
};

tcpFixServer.prototype.sendCheckedMsg = function(msg){
  try{
    this.fixInitiator.send(msg);
  }catch(err){
    console.log('ERROR from FIX initiator:',err);
    console.log('Resending msg in 5sec...',msg);
    setTimeout(this.sendCheckedMsg.bind(this,msg),5000);
  }
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

//Static methods - TODO will become session hive class

tcpFixServer.checkCredentials = function(name, password){
  var correct = ((name === 'luka') && (password === 'kp'));
  console.log('For testing only: ' + name + ' : ' + password + ' - ' + correct + ' credentials!');
  return correct;
  //TODO real DB checking
};

//TODO remove, just for testing, not working
tcpFixServer.validSecret = null;

tcpFixServer.checkSecret = function(secret){
  console.log(tcpFixServer.validSecret,' === ',secret);
  if (tcpFixServer.validSecret.equals(secret)){
    return true;
  }else{
    return false;
  }
  //TODO real DB checking
};

tcpFixServer.generateSecret = function(){
  //TODO real secret generator
  var rand16 = crypto.randomBytes(16);
  tcpFixServer.validSecret = rand16;
  console.log('=-=-= IZGENERISANI SECRET =-=-=',rand16);
  return rand16;
};


function ConnectionHandler(socket, buffer, myTcpFixServer, parser) {
  socket.removeAllListeners();
  socket.on('error', this.onSocketError.bind(this));
  socket.on('close', this.onSocketClosed.bind(this));
  socket.on('data', this.onData.bind(this));
  this.socket = socket;
  this.myTcpFixServer = myTcpFixServer;
  this.continueAfterExecute = true;
  this.parser = parser;
  this.onData(buffer);
}

//Abstract Handler

ConnectionHandler.prototype.destroy = function () {
  this.parser.destroy();
  this.parser = null;
  this.continueAfterExecute = null;
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
  for (var i=0; i<buffer.length; i++){
    //TODO remove comments, SHOULD catch
    //try{
      this.parser.executeByte(buffer[i]);
    //}catch (err){
      //console.log('ERROR in parsing bytes: ',err);
      //var s = this.socket;
      //this.socket = null;
      //s.destroy();
    //}
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

//Credentials Handler - chekcing user credentials after 'c'

function CredentialsHandler(socket, buffer, myTcpFixServer) {
  console.log('new CredentialsHandler', socket.remoteAddress, buffer, '.');
  ConnectionHandler.call(this, socket, buffer, myTcpFixServer, new Parsers.CredentialsParser);
  this.continueAfterExecute = false;
}

CredentialsHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: CredentialsHandler,
  enumerable: false,
  writable: false
}});

CredentialsHandler.prototype.destroy = function(){
  this.continueAfterExecute = null;
  if (!!this.socket){
    this.socket.destroy();
  }
  ConnectionHandler.prototype.destroy.call(this);
};

CredentialsHandler.prototype.readingFinished = function(){
  return this.parser.getZeroCnt() === 2; //reading until 2 zeros
};

CredentialsHandler.prototype.executeOnReadingFinished = function(buffer){
  if (tcpFixServer.checkCredentials(this.parser.getName(),this.parser.getPassword())){
    var secret = tcpFixServer.generateSecret();
    var secretBuffer = new Buffer(17);
    secretBuffer[0] = 0;
    secret.copy(secretBuffer,1);
    this.socket.write(secretBuffer);
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
  ConnectionHandler.call(this, socket, buffer, myTcpFixServer, new Parsers.SessionParser);
  this.continueAfterExecute = false;
}

SessionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: SessionHandler,
  enumerable: false,
  writable: false
}});

SessionHandler.prototype.destroy = function(){
  console.log('(((( SESSION HANDLER: UBIJAM SE ))))');
  this.continueAfterExecute = null;
  ConnectionHandler.prototype.destroy.call(this);
};

SessionHandler.prototype.readingFinished = function(){
  return this.parser.doneReading();
};

SessionHandler.prototype.executeOnReadingFinished = function(buffer){
  var bufferLeftover = buffer.slice(16);
  var s = this.socket;
  if (tcpFixServer.checkSecret(this.parser.getSecret())){
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

//Request Handler - parsing user request -> <operation name>0<param0>0<param1>0...<paramN>0

function RequestHandler(socket, buffer, myTcpFixServer) {
  console.log('new Request handler');
  ConnectionHandler.call(this, socket, buffer, myTcpFixServer, new Parsers.RequestParser(myTcpFixServer.methods));
}

RequestHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: RequestHandler,
  enumerable: false,
  writable: false
}});

RequestHandler.prototype.destroy = function(){
  console.log('(((( REQUEST HANDLER: UBIJAM SE ))))');
  if (!!this.socket){
    this.socket.destroy();
  }
  ConnectionHandler.prototype.destroy.call(this);
};

RequestHandler.prototype.readingFinished = function(){
  return this.parser.zeroCntEqualsRequiredZeros();
};

RequestHandler.prototype.executeOnReadingFinished = function(buffer){
  this.parser.callMethod(this.myTcpFixServer);
};

module.exports = tcpFixServer;
