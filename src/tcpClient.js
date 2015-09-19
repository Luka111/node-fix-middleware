'use strict';

var Logger = require('./logger.js');

var net = require('net');
var df = require('dateformat');

var Parsers = require('./parsers.js');
var ConnectionHandler = require('./connectionHandler.js');
var Coder = require('./codingFunctions.js');
var MethodStore = require('./methodStore.js');

//ServerEventHandler

function ServerEventHandler(handler){
  this.acceptFixMsg = null;
  this.connectionEstablished = null;
  this.connectionClosed = null;
  MethodStore.call(this);
}

ServerEventHandler.prototype = Object.create(MethodStore.prototype, {constructor:{
  value: ServerEventHandler,
  enumerable: false,
  writable: false
}});

ServerEventHandler.prototype.destroy = function(){
  this.connectionClosed = null;
  this.connectionEstablished = null;
  this.acceptFixMsg = null;
  MethodStore.prototype.destroy.call(this);
};

//tcp Client

function tcpClient(options,name,password,settings,cbOnSecret){
  if (!options) throw new Error('No options provided!');
  if (typeof options !== 'object') throw new Error('options must be object!');
  if (!options.hasOwnProperty('port')) throw new Error('options must have property port');
  if (!name) throw new Error('No name provided!');
  if (typeof name !== 'string') throw new Error('name must be string!');
  //it is possible for password to be an empty string
  if (typeof password !== 'string') throw new Error('password must be string!');
  if (!settings) throw new Error('No settings provided!');
  if (typeof settings !== 'string') throw new Error('settings must be string!');
  this.methods = new ServerEventHandler();
  this.methods.acceptFixMsg = this.acceptFixMsg.bind(this);
  this.methods.connectionEstablished = this.connectionEstablished.bind(this);
  this.methods.connectionClosed = this.connectionClosed.bind(this);
  this.options = options;
  this.waitingCallbacks = [];
  this.availableHandlers = new HandlerContainer();
  var socket = net.createConnection(options);
  new CarpetConnectionHandler(socket,null,this,null,name,password,settings,cbOnSecret);
  //TODO remove, testing
}

tcpClient.prototype.destroy = function(){
  this.availableHandlers.destroy();
  this.availableHandlers = null;
  this.waitingCallbacks = null;
  this.options = null;
  this.methods.destroy();
  this.methods = null;
  //TODO remove, testing
};

//methods for extern usage

tcpClient.prototype.sendFixMsg = function(secret,msg){
  this.execute(secret,this.sendFIXMessage.bind(this,msg));
};

tcpClient.prototype.callMethod = function(methodName,reqArguments){
  this.methods.callMethod(methodName,reqArguments);
}

//Event listeners from server

tcpClient.prototype.acceptFixMsg = function(args){
  if (!(typeof args ==='object' && args instanceof Array)){
    throw new Error('sendFixMsg accepts array of params');
  }
  if (args.length !== 2){
    throw new Error('sendFixMsg requires exactly 1 param');
  }
  var msg = args[0];
  if (typeof msg !== 'object'){
    throw new Error('sendFixMsg requires object as the first param! - ' + msg);
  }
  var connHandler = args[1];
  if (!(connHandler instanceof SecretConnectionHandler)){
    throw new Error('sendFixMsg requires SecretConnectionHandler as the second param! - ' + connHandler);
  }
  Logger.log('!=!=!=!=****!=!=!=! DOBIO SAM OVU FIX PORUKU SA SERVERA ' + msg);
}

tcpClient.prototype.connectionEstablished = function(args){
  if (!(typeof args ==='object' && args instanceof Array)){
    throw new Error('connectionEstablished accepts array of params');
  }
  if (args.length !== 2){
    throw new Error('connectionEstablished requires exactly 1 param');
  }
  var sessionID = args[0];
  if (typeof sessionID !== 'object'){
    throw new Error('connectionEstablished requires object as the first param! - ' + sessionID);
  }
  var connHandler = args[1];
  if (!(connHandler instanceof SecretConnectionHandler)){
    throw new Error('connectionEstablished requires SecretConnectionHandler as the second param! - ' + connHandler);
  }
  this.executeNextMethod(connHandler);
}

tcpClient.prototype.connectionClosed = function(args){
  if (!(typeof args ==='object' && args instanceof Array)){
    throw new Error('connectionClosed accepts array of params');
  }
  if (args.length !== 2){
    throw new Error('connectionClosed requires exactly 1 param');
  }
  var sessionID = args[0];
  if (typeof sessionID !== 'object'){
    throw new Error('connectionClosed requires object as the first param! - ' + sessionID);
  }
  var connHandler = args[1];
  if (!(connHandler instanceof SecretConnectionHandler)){
    throw new Error('connectionEstablished requires SecretConnectionHandler as the second param! - ' + connHandler);
  }
  Logger.log('Connection CLOSED!');
}

//Wrapper around connectionHandler executor 

tcpClient.prototype.execute = function(secret,cb){
  if (!cb){
    Logger.log('&&& Nema metode za izvrsiti!');
    return;
  }
  var handler = this.availableHandlers.getBySecret(secret);
  if (!handler){
    Logger.log('&&& Metoda se trenutno ne moze izvrsiti jer nema handlera sa ovim secretom',secret,'. Na cekanje!');
    this.waitingCallbacks.push(new CallbackSecretPair(cb,secret));
  }else{
    Logger.log('&&& Izvrsavam metodu i blokiram sve ostale pozive!');
    cb.call(this,handler);
  }
};

tcpClient.prototype.executeNextMethod = function(connectionHandler){
  this.availableHandlers.push(connectionHandler);
  Logger.log('&&& Dozvoljavam sve pozive i zovem sledecu metodu (ako je ima ;))!');
  var callbackSecretPair = this.waitingCallbacks.shift();
  if (!!callbackSecretPair){
    this.execute(callbackSecretPair.getSecret(),callbackSecretPair.getCb());
    callbackSecretPair.destroy();
  }
};

tcpClient.prototype.sendFIXMessage = function(msg, connectionHandler){
  if (!!connectionHandler && !!connectionHandler.executor){
    connectionHandler.executor.sendFIXMessage(msg);
  }
};

//CarpetConnectionHandler - accepting first byte, if r -> initiating PlainConnectionHandler

function CarpetConnectionHandler(socket,buffer,myTcpParent,parser,name,password,settings,cbOnSecret){
  this.name = name;
  this.password = password;
  this.settings = settings;
  this.cbOnSecret = cbOnSecret;
  ConnectionHandler.call(this,socket,buffer,myTcpParent,parser);
}

CarpetConnectionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: CarpetConnectionHandler,
  enumerable: false,
  writable: false
}});

CarpetConnectionHandler.prototype.destroy = function(){
  this.cbOnSecret = null;
  this.settings = null;
  this.password = null;
  this.name = null;
  ConnectionHandler.prototype.destroy.call(this);
};

CarpetConnectionHandler.prototype.onConnect = function(){
  ConnectionHandler.prototype.onConnect.call(this);
  if (!!this.executor){
    this.executor.destroy();
  }
  this.executor = new CredentialsExecutor(this);
  this.executor.sendCredentials(this.name,this.password);
};

//explicitly overriding onData
CarpetConnectionHandler.prototype.onData = function(buffer){
  if (!this.socket) return;
  if (!buffer) return;
  if (buffer[0] === 114){ //if r (result) we expect secret
    Logger.log('CARPET: Prvo slovo jeste R, instanciram PlainConnectionHandler!');
    var myTcpParent = this.myTcpParent;
    var socket = this.socket;
    var settings = this.settings;
    var cbOnSecret = this.cbOnSecret;
    this.destroy();
    new PlainConnectionHandler(socket,buffer.slice(1),myTcpParent,settings,cbOnSecret);
  }
};

CarpetConnectionHandler.prototype.socketWriteCredentials = function(name,password){
  if (!name){
    throw new Error('socketWriteCredentials: name is required!');
  }
  if (!password){
    throw new Error('socketWriteCredentials: password is required!');
  }
  if (!this.isString(name)){
    throw new Error('socketWriteCredentials: accepts buffer as argument');
  }
  if (!this.isString(password)){
    throw new Error('socketWriteCredentials: accepts buffer as argument');
  }
  this.writeBufferArray([name, password], 'c');
};


//PlainConnectionHandler

function PlainConnectionHandler(socket,buffer,myTcpParent,settings,cbOnSecret){
  this.settings = settings;
  this.cbOnSecret = cbOnSecret;
  ConnectionHandler.call(this,socket,buffer,myTcpParent, new Parsers.SessionParser());
}

PlainConnectionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: PlainConnectionHandler,
  enumerable: false,
  writable: false
}});

PlainConnectionHandler.prototype.destroy = function(){
  this.cbOnSecret = null;
  this.settings = null;
  ConnectionHandler.prototype.destroy.call(this);
};

PlainConnectionHandler.prototype.readingFinished = function(){
  return this.parser.doneReading();
};

PlainConnectionHandler.prototype.executeOnReadingFinished = function(){
  //TODO template this procedure?
  //remember references
  var myTcpParent = this.myTcpParent;
  var options = this.myTcpParent.options;
  var socket = this.socket;
  var settings = this.settings;
  var cbOnSecret = this.cbOnSecret;
  //destroy socket + destroy handler (in closed event handler)
  socket.destroy();
  this.socket = null;
  //create new socket
  socket = net.createConnection(options);
  //create new Handler
  var secret = this.parser.getSecret();
  new SecretConnectionHandler(socket,null,myTcpParent,secret,settings,cbOnSecret);
};

//SecretConnectionHandler

function SecretConnectionHandler(socket,buffer,myTcpParent,secret,settings,cbOnSecret){
  this.secret = secret;
  this.settings = settings;
  this.cbOnSecret = cbOnSecret;
  ConnectionHandler.call(this,socket,buffer,myTcpParent,new Parsers.ApplicationParser(this));
  this.socket.write('s');
  this.socket.write(secret);
};

SecretConnectionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: SecretConnectionHandler,
  enumerable: false,
  writable: false
}});

SecretConnectionHandler.prototype.destroy = function(){
  this.cbOnSecret = null;
  this.settings = null;
  this.secret = null;
  ConnectionHandler.prototype.destroy.call(this);
};

SecretConnectionHandler.prototype.onConnect = function(){
  ConnectionHandler.prototype.onConnect.call(this);
  if (!!this.executor){
    this.executor.destroy();
  }
};

SecretConnectionHandler.prototype.readingFinished = function(){
  return this.parser.getReadZero();
};

SecretConnectionHandler.prototype.executeOnReadingFinished = function(){
  var error = this.parser.getError();
  if (!!error){
    Logger.log('CLIENT: Error ' + error);
    if (!!this.cbOnSecret){
      this.cbOnSecret(null,error);
    }
    var s = this.socket;
    s.destroy();
    this.socket = null;
    return;
  }
  var msg = this.parser.getMsg();
  switch (msg){
    case 'correct_secret':
      this.cbOnSecret(this.secret);
      this.cbOnSecret = null;
      if (!!this.executor){
        this.executor.destroy();
      }
      this.executor = new FixInitiatorExecutor(this);
      this.executor.sendFIXInitiatorSettings(this.settings);
      break;
    case 'fix_initiator_started':
      if (!!this.executor){
        this.executor.destroy();
      }
      this.executor = new FixMsgExecutor(this);
      break; 
    case 'fix_initiator_already_started':
      if (!!this.executor){
        this.executor.destroy();
      }
      this.executor = new FixMsgExecutor(this);
      Logger.log('FIX initiator already started!');
      this.myTcpParent.executeNextMethod(this);
      break; 
    case 'successfully_sent':
      Logger.log('Uspesno poslata FIX poruka!');
      this.myTcpParent.executeNextMethod(this);
      break; 
  }
  this.parser.callMethod(this);
};

//Executor

function Executor(handler){
  this.handler = handler;
}

Executor.prototype.destroy = function(){
  this.handler = null;
}

Executor.prototype.sendCredentials = function(name, password){
  throw new Error('Executor: sendCredentials not implemented');
};

Executor.prototype.sendSecret = function(){
  throw new Error('Executor: sendSecret not implemented');
};

Executor.prototype.sendFIXInitiatorSettings = function(settings){
  throw new Error('Executor: sendFIXInitiatorSettings not implemented');
};

Executor.prototype.sendFIXMessage = function(fixMsg){
  throw new Error('Executor: sendFIXMessage not implemented');
};

//CredentialsExecutor

function CredentialsExecutor(handler){
  Executor.call(this,handler);
}

CredentialsExecutor.prototype = Object.create(Executor.prototype, {constructor:{
  value: CredentialsExecutor,
  enumerable: false,
  writable: false
}});

CredentialsExecutor.prototype.destroy = function(){
  Executor.prototype.destroy.call(this);
};

CredentialsExecutor.prototype.sendCredentials = function(name, password){
  if (!name){
    throw new Error( 'sendCredentials: name param is required!');
  }
  if (typeof name !== 'string'){
    throw new Error( 'sendCredentials: name param must be string!');
  }
  if (!password){
    throw new Error( 'sendCredentials: password param is required!');
  }
  if (typeof password!== 'string'){
    throw new Error( 'sendCredentials: password param must be string!');
  }
  this.handler.socketWriteCredentials(name, password);
};

//FixInitiatorExecutor

function FixInitiatorExecutor(handler){
  Executor.call(this,handler);
}

FixInitiatorExecutor.prototype = Object.create(Executor.prototype, {constructor:{
  value: FixInitiatorExecutor,
  enumerable: false,
  writable: false
}});

FixInitiatorExecutor.prototype.destroy = function(){
  Executor.prototype.destroy.call(this);
};

FixInitiatorExecutor.prototype.sendFIXInitiatorSettings = function(settings){
  if (!settings){
    throw new Error('sendFIXInitiatorSettings: settings param is required');
  }
  if (typeof settings !== 'string'){
    throw new Error('sendFIXInitiatorSettings: settings param type must be string');
  }
  this.handler.sendMethodBuffer(settings, 'startFixInitiator');
};

//FixMsgExecutor

function FixMsgExecutor(handler){
  Executor.call(this,handler);
}

FixMsgExecutor.prototype = Object.create(Executor.prototype, {constructor:{
  value: FixMsgExecutor,
  enumerable: false,
  writable: false
}});

FixMsgExecutor.prototype.destroy = function(){
  Executor.prototype.destroy.call(this);
};

FixMsgExecutor.prototype.sendFIXMessage = function(fixMsg){
  if (!fixMsg){
    throw new Error('sendFixMsg: fixMsg param is required');
  };
  if (typeof fixMsg !== 'object'){
    throw new Error('sendFIXMessage: fixMsg param type must be object');
  }
  if (!fixMsg.hasOwnProperty('header')){
    throw new Error('sendFIXMessage: fixMsg param must contain property header');
  }
  var codedFixMsg = Coder.createZeroDelimitedFixMsg(fixMsg);
  console.log('EVO PRIMER FIX PORUKE',codedFixMsg.replace(String.fromCharCode(0),'#'));
  this.handler.sendMethodBuffer(codedFixMsg, 'sendFixMsg');
};

function HandlerContainer(){
  this.handlers = [];
}

HandlerContainer.prototype.destroy = function(){
  this.handlers = null;
};

HandlerContainer.prototype.push = function(handler){
  this.handlers.push(handler);
};

HandlerContainer.prototype.getBySecret = function(secret){
  for (var i=0; i<this.handlers.length; i++){
    if (this.handlers[i].secret === secret){
      return this.handlers[i];
    }
  }
  return null;
};

function CallbackSecretPair(cb,secret){
  this.cb = cb;
  this.secret = secret;
}

CallbackSecretPair.prototype.destroy = function(){
  this.cb = null;
  this.secret = null;
};

CallbackSecretPair.prototype.getSecret = function(){
  return this.secret;
};

CallbackSecretPair.prototype.getCb = function(){
  return this.cb;
};

module.exports = tcpClient;
