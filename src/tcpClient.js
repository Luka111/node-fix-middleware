'use strict';

var net = require('net');
var df = require('dateformat');

var settings = '[DEFAULT]\nReconnectInterval=60\nPersistMessages=Y\nFileStorePath=../data\nFileLogPath=../log\n\n[SESSION]\nConnectionType=initiator\nSenderCompID=NODEQUICKFIX\nTargetCompID=ELECTRONIFIE\nBeginString=FIX.4.4\nStartTime=00:00:00\nEndTime=23:59:59\nHeartBtInt=30\nSocketConnectPort=3223\nSocketConnectHost=localhost\nUseDataDictionary=Y\nDataDictionary=../node_modules/node-quickfix/quickfix/spec/FIX44.xml\nResetOnLogon=Y';

var fixMsg = 'sendFixMsg' + String.fromCharCode(0) + 'header#8#FIX.4.4#35#D#49#NODEQUICKFIX#56#ELECTRONIFIE##tags#11#0E0Z86K00000#48#06051GDX4#22#1#38#200#40#2#54#1#55#BAC#218#100#60#'+df(new Date(), "yyyymmdd-HH:MM:ss.l")+'#423#6##'+ String.fromCharCode(0);

function tcpClient(options){
  this.options = options;
  this.secret = null;
  this.client = net.createConnection(options,this.connectionHandler.bind(this));
  //TODO remove, testing
  this.messages = [];
}

tcpClient.prototype.destroy = function(){
  //TODO remove, testing
  this.messages = null;
  this.secret = null;
  this.options = null;
  if (!!this.client) this.client.destroy();
  this.client = null;
};

//Intern methods

tcpClient.prototype.send = function(msg){
  console.log('writing', msg);
  this.client.write(msg);
};

//Event listeners

tcpClient.prototype.connectionHandler = function(){
  console.log('Connected to the server!');
  //Listeners
  this.client.on('error',this.onError.bind(this));
  this.client.on('close', this.onClose.bind(this));
  this.client.on('data', this.onData.bind(this));
};

tcpClient.prototype.fillMessages = function(){
  var st = 's' +  this.secret;
  for (var i=0; i<st.length; i++){
    this.messages.push(st[i]);
  }
  this.messages.push('blablabla');
};

tcpClient.prototype.sendMessagesInIntervals = function(){
  if (this.messages.length < 1){
    return;
  }
  this.send(this.messages.shift());
  setTimeout(this.sendMessagesInIntervals.bind(this), 500);
};

//TODO inherit..
tcpClient.prototype.secretConnectionHandler = function(){
  console.log('Secret Connected to the server!');
  //Listeners
  this.client.on('error',this.onError.bind(this));
  this.client.on('close', this.onClose.bind(this));
  this.client.on('data', this.onData.bind(this));
  //TODO remove, just for testing 
  var settingsMsg = 's' + this.secret + 'startFixInitiator' + String.fromCharCode(0) + settings + String.fromCharCode(0);
  this.send(settingsMsg);
  this.send(fixMsg);
  //this.fillMessages();
  //this.sendMessagesInIntervals();
};

tcpClient.prototype.onError = function(){
  console.log('Client Error!');
  this.client = net.createConnection(this.options,this.connectionHandler.bind(this));
  this.client.on('error',console.log.bind(null,'Error connecting to the server!'));
};

tcpClient.prototype.onClose = function(){
  console.log('Client Socket closed.');
};

tcpClient.prototype.onData = function(buffer){
  console.log('Recieved data from server - ' + buffer.toString());
  if (buffer.toString().indexOf('SECRET#') !== -1){
    var secret = buffer.slice(7);
    console.log('Dobio sam ovaj secret',secret,'i njegova duzina je',secret.length);
    this.secret = secret;
    this.client = net.createConnection(this.options,this.secretConnectionHandler.bind(this));
  }
};

tcpClient.prototype.registerEventListener = function(eventName, cb){
  this.client.on(eventName, cb);
};

module.exports = tcpClient;
