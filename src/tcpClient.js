'use strict';

var net = require('net');
var df = require('dateformat');
var events = require('events');

var Parsers = require('./parsers.js');
var ConnectionHandler = require('./connectionHandler.js');
var Coder = require('./codingFunctions.js');

//tcp Client

function tcpClient(options){
  this.events = new events.EventEmitter();
  this.options = options;
  var socket = net.createConnection(options);
  new CarpetConnectionHandler(socket,null,this);
  //TODO remove, testing
}

tcpClient.prototype.destroy = function(){
  if (!!this.connectionHandler){
    this.connectionHandler.destroy();
  }
  this.options = null;
  this.connectionHandler = null;
  this.events.destroy();
  this.events = null;
  //TODO remove, testing
};

//Wrapper around connectionHandler executor 

tcpClient.prototype.executeCbOnEvent = function(eventName, cb){
  this.events.on(eventName,cb.bind(this));
};

tcpClient.prototype.sendCredentials = function(name,password){
  if (!!this.connectionHandler.executor){
    this.connectionHandler.executor.sendCredentials(name,password);
  }
};

tcpClient.prototype.sendFIXInitiatorSettings = function(settings){
  if (!!this.connectionHandler.executor){
    this.connectionHandler.executor.sendFIXInitiatorSettings(settings);
  }else{
    console.log('NEMAM EXECUTORA BRE',this.connectionHandler.constructor);
  }
};

tcpClient.prototype.sendFIXMessage = function(msg){
  if (!!this.connectionHandler.executor){
    this.connectionHandler.executor.sendFIXMessage(msg);
  }
};

//CarpetConnectionHandler - accepting first byte, if r -> initiating PlainConnectionHandler

function CarpetConnectionHandler(socket,buffer,myTcpParent,parser){
  myTcpParent.connectionHandler = this;
  ConnectionHandler.call(this,socket,buffer,myTcpParent,parser);
}

CarpetConnectionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: CarpetConnectionHandler,
  enumerable: false,
  writable: false
}});

CarpetConnectionHandler.prototype.destroy = function(){
  ConnectionHandler.prototype.destroy.call(this);
};

CarpetConnectionHandler.prototype.onConnect = function(){
  ConnectionHandler.prototype.onConnect.call(this);
  if (!!this.executor){
    this.executor.destroy();
  }
  this.executor = new CredentialsExecutor(this);
  this.myTcpParent.events.emit('plainConnection');
};

//explicitly overriding onData
CarpetConnectionHandler.prototype.onData = function(buffer){
  if (!this.socket) return;
  if (!buffer) return;
  if (buffer[0] === 114){ //if r (result) we expect secret
    console.log('CARPET: Prvo slovo jeste R, instanciram PlainConnectionHandler!');
    var myTcpParent = this.myTcpParent;
    var socket = this.socket;
    this.destroy();
    new PlainConnectionHandler(socket,buffer.slice(1),myTcpParent);
  }
};

CarpetConnectionHandler.prototype.socketWriteCredentials = function(name,password){
  if (!name){
    throw new Error('socketWriteCredentials: name is required!');
  }
  if (!password){
    throw new Error('socketWriteCredentials: password is required!');
  }
  if (!Buffer.isBuffer(name)){
    throw new Error('socketWriteCredentials: accepts buffer as argument');
  }
  if (!Buffer.isBuffer(password)){
    throw new Error('socketWriteCredentials: accepts buffer as argument');
  }
  var msg1 = this.makeWriteBuffer(name,'c',true);
  var msg2 = this.makeWriteBuffer(password,'',true);
  var msg = Buffer.concat([msg1,msg2]);
  console.log('==== STA JE MSG POSLE CONCAT?',msg);
  this.socket.write(msg);
};


//PlainConnectionHandler

function PlainConnectionHandler(socket,buffer,myTcpParent){
  ConnectionHandler.call(this,socket,buffer,myTcpParent, new Parsers.SessionParser());
}

PlainConnectionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: PlainConnectionHandler,
  enumerable: false,
  writable: false
}});

PlainConnectionHandler.prototype.destroy = function(){
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
  //destroy socket + destroy handler (in closed event handler)
  socket.destroy();
  this.socket = null;
  //create new socket
  socket = net.createConnection(options);
  //create new Handler
  var secret = this.parser.getSecret();
  new SecretConnectionHandler(socket,null,myTcpParent,secret);
};

//SecretConnectionHandler

function SecretConnectionHandler(socket,buffer,myTcpParent,secret){
  ConnectionHandler.call(this,socket,buffer,myTcpParent,new Parsers.ApplicationParser());
  this.socketWriteSecret(secret);
};

SecretConnectionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: SecretConnectionHandler,
  enumerable: false,
  writable: false
}});

SecretConnectionHandler.prototype.destroy = function(){
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
  console.log('STA JE ERROR',error);
  if (!!error){
    console.log('CLIENT: Error',error);
    var c = this.socket;
    c.destroy();
    this.socket = null;
    return;
  }
  var msg = this.parser.getMsg();
  switch (msg){
    case 'correct_secret':
      if (!!this.executor){
        this.executor.destroy();
      }
      this.executor = new FixInitiatorExecutor(this);
      this.myTcpParent.events.emit('secretConnection');
      break;
    case 'fix_initiator_started':
      if (!!this.executor){
        this.executor.destroy();
      }
      this.executor = new FixSenderExecutor(this);
      this.myTcpParent.events.emit('fixInitiatorStarted');
      break; 
  }
  this.parser.reset();
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
  this.handler.socketWriteCredentials(new Buffer(name), new Buffer(password));
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
  this.handler.sendMethodBuffer(new Buffer(settings),new Buffer('startFixInitiator'));
};

//FixSenderExecutor

function FixSenderExecutor(handler){
  Executor.call(this,handler);
}

FixSenderExecutor.prototype = Object.create(Executor.prototype, {constructor:{
  value: FixSenderExecutor,
  enumerable: false,
  writable: false
}});

FixSenderExecutor.prototype.destroy = function(){
  Executor.prototype.destroy.call(this);
};

FixSenderExecutor.prototype.sendFIXMessage = function(fixMsg){
  if (!fixMsg){
    throw new Error('sendFixMsg: fixMsg param is required');
  };
  if (typeof fixMsg !== 'object'){
    throw new Error('sendFIXMessage: fixMsg param type must be object');
  }
  if (!fixMsg.hasOwnProperty('header')){
    throw new Error('sendFIXMessage: fixMsg param must contain property header');
  }
  var header = this.generateZeroDelimitedTagValue(fixMsg.header);
  var tags = '';
  if (fixMsg.hasOwnProperty('tags')){
    tags = this.generateZeroDelimitedTagValue(fixMsg.tags);
  }
  var codedFixMsg = Coder.createZeroDelimitedString(fixMsg);
  this.handler.sendMethodBuffer(new Buffer(codedFixMsg),new Buffer('sendFixMsg'));
};

FixSenderExecutor.prototype.generateZeroDelimitedTagValue = function(obj){
  var res = '';
  if (!obj){
    return res;
  }
  if (typeof obj !== 'object'){
    return res;
  }
  for (var key in obj){
    if (obj.hasOwnProperty(key)){
      res += (key + String.fromCharCode(0) + obj[key] + String.fromCharCode(0));
    }
  }
  res += String.fromCharCode(0);
  return res;
};

module.exports = tcpClient;
