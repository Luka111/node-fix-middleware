'use strict';

var Logger = require('./logger.js');

var net = require('net');
var crypto = require('crypto');

var fixInitiator = require('./fix/fixInitiator.js');
var ConnectionHandler = require('./connectionHandler.js');
var Listeners = require('./listeners.js');
var Parsers = require('./parsers.js');
var Coder = require('./codingFunctions.js');
var MethodStore = require('./methodStore.js');

function ServerMethods(){
  this.startFixInitiator = null;
  this.sendFixMsg = null;
  this.getStatistics = null;
  MethodStore.call(this);
}

ServerMethods.prototype = Object.create(MethodStore.prototype, {constructor:{
  value: ServerMethods,
  enumerable: false,
  writable: false
}});

ServerMethods.prototype.destroy = function(){
  this.getStatistics = null;
  this.sendFixMsg = null;
  this.startFixInitiator = null;
  MethodStore.prototype.destroy.call(this);
};

function tcpFixServer(){
  this.methods = new ServerMethods();
  //TODO add methods
  this.methods.startFixInitiator = this.startFixInitiator.bind(this);
  this.methods.sendFixMsg = this.sendFixMsg.bind(this);
  this.server = net.createServer(this.onConnection.bind(this));
  this.fixInitiator = null;
  this.listeners = new Listeners('INITIATOR');
  this.listeners.onLogon = this.onLogonListener.bind(this,'INITIATOR');
  this.listeners.onLogout = this.onLogoutListener.bind(this,'INITIATOR');
  this.listeners.fromApp = this.fromAppListener.bind(this,'INITIATOR');
  this.connectionHandler = null;
  this.executingMethod = false;
};

tcpFixServer.prototype.destroy = function(){
  this.executingMethod = null;
  this.connectionHandler = null;
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

tcpFixServer.prototype.callMethod = function(methodName,reqArguments){
  if (this.executingMethod){
    this.connectionHandler.socketWriteError('executing_method');
    return;
  }
  Logger.log('^^^^^ METODA JE U TOKU');
  this.executingMethod = true;
  this.methods.callMethod(methodName,reqArguments);
}

//RMI

tcpFixServer.prototype.startFixInitiator = function(args){
  if (!(args instanceof Array)){
    throw 'startFixInitiator accepts array of params';
  }
  if (args.length !== 2){
    throw 'startFixInitiator requires exactly 2 params - cb and settings';
  }
  var cb = args[0];
  if (typeof cb !== 'function'){
    throw 'startFixInitiator requires function as the first param!';
  }
  var settings = args[1];
  if (typeof settings !== 'string'){
    throw 'startFixInitiator requires string as the second param!';
  }
  //TODO ovde mora ozbiljan sanity check za ovaj string, jer quickfix puca ako se da los settings string
  /*
  if (!!this.fixInitiator){
    this.fixInitiator.destroy();
    this.fixInitiator = null;
  }
  */
  if (!this.fixInitiator){
    this.fixInitiator = new fixInitiator(settings);
    this.fixInitiator.start(cb);
    this.fixInitiator.registerEventListeners(this.listeners);
  }else{
    this.connectionHandler.socketWriteResult('fix_initiator_already_started');
  }
};

tcpFixServer.prototype.sendFixMsg = function(args){
  if (!(args instanceof Array)){
    throw new Error('sendFixMsg accepts array of params');
  }
  if (args.length !== 2){
    throw new Error('sendFixMsg requires exactly 2 params - cb and fixMsg');
  }
  var cb = args[0];
  if (typeof cb !== 'function'){
    throw 'sendFixMsg requires function as the first param!';
  }
  var msg = args[1];
  if (typeof msg !== 'object'){
    throw new Error('sendFixMsg requires object as the second param! - ' + msg);
  }
  //TODO ovde mora ozbiljan sanity check za fix msg, jer quickfix puca ako se da losa poruka 
  if (!this.fixInitiator){
    throw new Error('FIX initiator is not started!');
  }
  this.sendCheckedMsg(cb,msg);
};

tcpFixServer.prototype.sendCheckedMsg = function(cb,msg){
  try{
    this.fixInitiator.send(cb,msg);
  }catch(err){
    Logger.log('ERROR from FIX initiator: ' + err);
    Logger.log('Resending msg in 5sec... ' + JSON.stringify(msg));
    setTimeout(this.sendCheckedMsg.bind(this,cb,msg),5000);
  }
};

//Overridden FIX listeners

tcpFixServer.prototype.onLogonListener = function(emitter,sessionID){
  this.listeners.onLogonListener(emitter,sessionID); //super
  this.fixInitiator.setConnectionEstablished(true);
  Logger.log('@@@@@@@@@ SESSIONID ' + sessionID);
  var codedSessionId = Coder.createZeroDelimitedSessionId(sessionID);
  Logger.log('@@@@@@@@@ CODED SESSIONID ' + codedSessionId);
  this.connectionHandler.socketWriteEvent('connectionEstablished',codedSessionId);
};

tcpFixServer.prototype.onLogoutListener = function(emitter,sessionID){
  this.listeners.onLogoutListener(emitter,sessionID); //super
  this.fixInitiator.setConnectionEstablished(false);
  Logger.log('****** SESSIONID ' + sessionID);
  var codedSessionId = Coder.createZeroDelimitedSessionId(sessionID);
  Logger.log('****** CODED SESSIONID ' + codedSessionId);
  this.connectionHandler.socketWriteEvent('connectionClosed',codedSessionId);
};

tcpFixServer.prototype.fromAppListener = function(emitter,msg,sessionID){
  this.listeners.fromAppListener(emitter,msg,sessionID); //super
  Logger.log('$$$$$$$$ DOBIO PORUKU OD ACCEPTORA ' + msg);
  var codedFixMsg = Coder.createZeroDelimitedFixMsg(msg.message);
  Logger.log('< $$$ KODOVANA ' + codedFixMsg);
  //connection handler must exists because fixInitiator exists
  this.connectionHandler.socketWriteEvent('acceptFixMsg',codedFixMsg);
};

//Intern methods

tcpFixServer.prototype.start = function(port){
  if (!port) throw new Error ('No port provided!');
  if (typeof port !== 'number') throw new Error('Port must be a number!');
  this.server.listen(port,this.onListening.bind(this));
};

//Event listeners

tcpFixServer.prototype.onConnection = function(socket){
  Logger.log('New connection - ' + socket.remoteAddress);
  //Listeners
  socket.on('error',this.onError.bind(this,socket));
  socket.on('close', this.onClose.bind(this));
  socket.on('data', this.onData.bind(this, socket));
};

tcpFixServer.prototype.onListening = function(){
  Logger.log('Server started!');
};

tcpFixServer.prototype.onError = function(socket){
  Logger.log('Error with ' +  socket.remoteAddress + '\n Closing connection');
  this.destroy();
};

tcpFixServer.prototype.onClose = function(){
  Logger.log('Socket closed.');
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
    Logger.log('no ctor while reading ' +  buffer + ', socket will be destroyed');
    socket.destroy();
    return;
  }
  if (!!this.connectionHandler){
    this.connectionHandler.destroy();
  }
  new ctor(socket, buffer.slice(1), this);
};

//Static methods - TODO will become session hive class

tcpFixServer.checkCredentials = function(name, password){
  var correct = ((name === 'luka') && (password === 'kp'));
  Logger.log('For testing only: ' + name + ' : ' + password + ' - ' + correct + ' credentials!');
  return correct;
  //TODO real DB checking
};

//TODO remove, just for testing
tcpFixServer.validSecret = null;

tcpFixServer.checkSecret = function(secret){
  Logger.log(tcpFixServer.validSecret + ' === ' + secret);
  if (tcpFixServer.validSecret.equals(secret)){
    return true;
  }else{
    return false;
  }
  //TODO real DB checking
};

tcpFixServer.generateSecret = function(){
  var rand16 = crypto.randomBytes(16);
  tcpFixServer.validSecret = rand16;
  Logger.log('=-=-= IZGENERISANI SECRET =-=-= ' + rand16);
  return rand16;
};


//Credentials Handler - chekcing user credentials after 'c'

function CredentialsHandler(socket, buffer, myTcpParent) {
  Logger.log('new CredentialsHandler ' +  socket.remoteAddress + ' ' + buffer + ' .');
  ConnectionHandler.call(this, socket, buffer, myTcpParent, new Parsers.CredentialsParser);
  this.continueAfterExecute = false;
}

CredentialsHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: CredentialsHandler,
  enumerable: false,
  writable: false
}});

CredentialsHandler.prototype.destroy = function(){
  Logger.log('((((( CREDENTIALS HANDLER SE UBIJA )))))');
  this.continueAfterExecute = null;
  if (!!this.socket){
    this.socket.destroy();
  }
  ConnectionHandler.prototype.destroy.call(this);
};

//override, adding catch functionallity
CredentialsHandler.prototype.onData = ConnectionHandler.prototype.onDataCatch;

CredentialsHandler.prototype.readingFinished = function(){
  return this.parser.getZeroCnt() === 2; //reading until 2 zeros
};

var _zeroBuffer = new Buffer(1);
_zeroBuffer[0] = 0;

CredentialsHandler.prototype.executeOnReadingFinished = function(){
  if (tcpFixServer.checkCredentials(this.parser.getName(),this.parser.getPassword())){
    var secret = tcpFixServer.generateSecret();
    //this.socketWriteResult(secret.toString());
    this.socket.write('r');
    this.socket.write(secret);
    this.socket.write(_zeroBuffer);
  }else{
    this.socketWriteError('Incorrect username/password!');
  }
  var s = this.socket;
  this.socket = null;
  s.destroy();
  //TODO maybe check if there is anything after second zero, error? - got buffer but not needed atm
};

//Session Handler - checking Secret (first 16 bytes) after 's'

function SessionHandler(socket, buffer, myTcpParent) {
  Logger.log('new SessionHandler');
  ConnectionHandler.call(this, socket, buffer, myTcpParent, new Parsers.SessionParser);
  this.continueAfterExecute = false;
}

SessionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: SessionHandler,
  enumerable: false,
  writable: false
}});

SessionHandler.prototype.destroy = function(){
  Logger.log('(((( SESSION HANDLER: UBIJAM SE ))))');
  this.continueAfterExecute = null;
  ConnectionHandler.prototype.destroy.call(this);
};

//override, adding catch functionallity
SessionHandler.prototype.onData = ConnectionHandler.prototype.onDataCatch;

SessionHandler.prototype.readingFinished = function(){
  return this.parser.doneReading();
};

SessionHandler.prototype.executeOnReadingFinished = function(bufferLeftover){
  var s = this.socket;
  if (tcpFixServer.checkSecret(this.parser.getSecret())){
    Logger.log('++DOBAR SECRET!++');
    this.socketWriteResult('correct_secret');
    var myTcpParent = this.myTcpParent;
    this.destroy();
    new RequestHandler(s,bufferLeftover,myTcpParent);
  }else{
    Logger.log('--LOS SECRET!--');
    this.socketWriteError('Incorrect secret!');
    var s = this.socket;
    this.socket = null;
    s.destroy();
  }
};

//Request Handler - parsing user request -> <operation name>0<param0>0<param1>0...<paramN>0

function RequestHandler(socket, buffer, myTcpParent) {
  Logger.log('new Request handler');
  ConnectionHandler.call(this, socket, buffer, myTcpParent, new Parsers.RequestParser(myTcpParent));
}

RequestHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: RequestHandler,
  enumerable: false,
  writable: false
}});

RequestHandler.prototype.destroy = function(){
  Logger.log('(((( REQUEST HANDLER: UBIJAM SE ))))');
  if (!!this.socket){
    this.socket.destroy();
  }
  ConnectionHandler.prototype.destroy.call(this);
};

//override, adding catch functionallity
RequestHandler.prototype.onData = ConnectionHandler.prototype.onDataCatch;

RequestHandler.prototype.readingFinished = function(){
  return this.parser.zeroCntEqualsRequiredZeros();
};

RequestHandler.prototype.executeOnReadingFinished = function(){
  this.parser.callMethod(this.myTcpParent);
};

module.exports = tcpFixServer;
