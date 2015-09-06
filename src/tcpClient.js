'use strict';

var net = require('net');
var df = require('dateformat');

function ClientEvents(){
  this.reset();
}

ClientEvents.prototype.destroy = function(){
  this.plainConnection = null;
  this.secretConnection = null;
  this.fixInitiatorStarted = null;
}

ClientEvents.prototype.reset = function(){
  this.plainConnection = [];
  this.secretConnection = [];
  this.fixInitiatorStarted = [];
}

ClientEvents.prototype.addEventsToSocket = function(socket){
  for (var event in this){
    if (this.hasOwnProperty(event)){
      for (var i=0; i<this[event].length; i++){
        socket.on(event,this[event][i]);
      }
    }
  }
  this.reset();
};

ClientEvents.prototype.recieveEventsFromSocket = function(socket){
  for (var event in this){
    if (this.hasOwnProperty(event)){
      this[event] = socket.listeners(event);
    }
  }
};

//tcp Client

function tcpClient(options){
  this.events = new ClientEvents();
  this.connectionHandler = null;
  new PlainConnectionHandler(options,this);
  //TODO remove, testing
}

tcpClient.prototype.destroy = function(){
  if (!!this.connectionHandler){
    this.connectionHandler.destroy();
  }
  this.connectionHandler = null;
  this.events.destroy();
  this.events = null;
  //TODO remove, testing
};

//Wrapper around connectionHandler executor 

tcpClient.prototype.executeCbOnEvent = function(eventName, cb){
  this.connectionHandler.registerCbOnEvent(eventName,cb.bind(this));
};

tcpClient.prototype.sendCredentials = function(name,password){
  this.connectionHandler.sendCredentials(name,password);
};

tcpClient.prototype.sendFIXInitiatorSettings = function(settings){
  this.connectionHandler.sendFIXInitiatorSettings(settings);
};

tcpClient.prototype.sendFIXMessage = function(msg){
  this.connectionHandler.sendFIXMessage(msg);
};

//Connection Handler - Abstract

function ConnectionHandler(options,myTcpClient){
  this.client = net.createConnection(options,this.onConnect.bind(this));
  this.client.on('error',this.onError.bind(this));
  this.client.on('close',this.onClose.bind(this));
  this.client.on('data',this.onData.bind(this));
  this.myTcpClient = myTcpClient;
  console.log('STA JE OVO',this.myTcpClient.events);
  this.myTcpClient.events.addEventsToSocket(this.client);
  this.executor = null;
  this.myTcpClient.connectionHandler = this;
  this.options = options;
}

ConnectionHandler.prototype.destroy = function(){
  this.options = null;
  if (!!this.executor){
    this.executor.destroy();
  }
  this.executor = null;
  this.myTcpClient = null;
  if (!!this.client){
    this.client.destroy();
  }
  this.client = null;
};

//Wrapper around executor

ConnectionHandler.prototype.registerCbOnEvent = function(eventName, cb){
  console.log('Registrovao na ovaj event',eventName,'ovaj cb',cb);
  this.client.on(eventName,cb);
};

ConnectionHandler.prototype.sendCredentials = function(name,password){
  if (!this.executor){
    throw new Error('No executor instantiated!');
  }
  this.executor.sendCredentials(name,password);
};

ConnectionHandler.prototype.sendFIXInitiatorSettings = function(settings){
  if (!this.executor){
    throw new Error('No executor instantiated!');
  }
  this.executor.sendFIXInitiatorSettings(settings);
};

ConnectionHandler.prototype.sendFIXMessage = function(msg){
  if (!this.executor){
    throw new Error('No executor instantiated!');
  }
  this.executor.sendFIXMessage(msg);
};

//Event Listeners

ConnectionHandler.prototype.onConnect = function(){
  console.log('CLIENT: Connected to the server!');
};

ConnectionHandler.prototype.onError = function(){
  console.log('CLIENT: Socket error. Default behavior: Destroying...');
  this.destroy();
};

ConnectionHandler.prototype.onClose = function(){
  console.log('CLIENT: Socket closed. Default behavior: Destroying...');
  this.destroy();
};

ConnectionHandler.prototype.onData = function(){
  throw new Error('onData not implemented!');
};

//PlainConnectionHandler

function PlainConnectionHandler(options,myTcpClient){
  ConnectionHandler.call(this,options,myTcpClient);
}

PlainConnectionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: PlainConnectionHandler,
  enumerable: false,
  writable: false
}});

PlainConnectionHandler.prototype.destroy = function(){
  ConnectionHandler.prototype.destroy.call(this);
};

PlainConnectionHandler.prototype.onConnect = function(){
  ConnectionHandler.prototype.onConnect.call(this);
  if (!!this.executor){
    this.executor.destroy();
  }
  this.executor = new CredentialsExecutor(this.client);
  this.client.emit('plainConnection');
};

PlainConnectionHandler.prototype.onData = function(buffer){
  if (buffer[0] === 114){ //if r (result) we expect secret
    var secret = buffer.slice(1,17);
    console.log('Dobio sam ovaj secret',secret,'i njegova duzina je',secret.length);
    var myTcpClient = this.myTcpClient;
    var options = this.options;
    var client = this.client;
    myTcpClient.events.recieveEventsFromSocket(client);
    client.destroy();
    this.client = null;
    new SecretConnectionHandler(options,myTcpClient,secret);
  }
};

//SecretConnectionHandler

function SecretConnectionHandler(options,myTcpClient,secret){
  this.secret = secret;
  ConnectionHandler.call(this,options,myTcpClient);
};

SecretConnectionHandler.prototype = Object.create(ConnectionHandler.prototype, {constructor:{
  value: SecretConnectionHandler,
  enumerable: false,
  writable: false
}});

SecretConnectionHandler.prototype.destroy = function(){
  this.secret = null;
  ConnectionHandler.prototype.destroy.call(this);
};

SecretConnectionHandler.prototype.onConnect = function(){
  ConnectionHandler.prototype.onConnect.call(this);
  if (!!this.executor){
    this.executor.destroy();
  }
  this.executor = new SecretExecutor(this.client,this.secret);
};

SecretConnectionHandler.prototype.onData = function(buffer){
  var opType = buffer[0];
  var msg = buffer.slice(1,buffer.length - 1).toString(); //this removes 0 at the end, TODO add reading in chunks
  if (opType === 114){ //r = result
    if (msg === 'correct_secret'){
      if (!!this.executor){
        this.executor.destroy();
      }
      this.executor = new FixInitiatorExecutor(this.client);
      this.client.emit('secretConnection');
    }
    if (msg === 'fix_initiator_started'){
      if (!!this.executor){
        this.executor.destroy();
      }
      this.executor = new FixSenderExecutor(this.client);
      this.client.emit('fixInitiatorStarted');
    }
  }
  if (opType === 101){ //e = error
    console.log('CLIENT: Error',msg);
    var c = this.client;
    c.destroy();
    this.client = null;
  }
};

//Executor

function Executor(client){
  this.client = client;
}

Executor.prototype.destroy = function(){
  this.client = null;
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

function CredentialsExecutor(client){
  Executor.call(this,client);
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
  var credentialsMsg = 'c' + name + String.fromCharCode(0) + password + String.fromCharCode(0);
  this.client.write(credentialsMsg);
};

//SecretExecutor

function SecretExecutor(client, secret){
  this.secret = secret;
  Executor.call(this,client);
  this.sendSecret();
}

SecretExecutor.prototype = Object.create(Executor.prototype, {constructor:{
  value: SecretExecutor,
  enumerable: false,
  writable: false
}});

SecretExecutor.prototype.destroy = function(){
  this.sendSecret = null;
  Executor.prototype.destroy.call(this);
};

SecretExecutor.prototype.sendSecret = function(){
  if (!this.secret){
    throw new Error('sendSecret: There is no secret recieved!');
  }
  var secret = new Buffer(17);
  secret[0] = 115; //ascii - s for secret
  this.secret.copy(secret,1);
  this.client.write(secret);
};

//FixInitiatorExecutor

function FixInitiatorExecutor(client){
  Executor.call(this,client);
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
  var settingsMsg = 'startFixInitiator' + String.fromCharCode(0) + settings + String.fromCharCode(0);
  this.client.write(settingsMsg);
};

//FixSenderExecutor

function FixSenderExecutor(client){
  Executor.call(this,client);
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
  var fixMsg = 'sendFixMsg' + String.fromCharCode(0) + header + tags + String.fromCharCode(0);
  this.client.write(fixMsg);
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
