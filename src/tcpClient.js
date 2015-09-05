'use strict';

var net = require('net');
var df = require('dateformat');

var settings = '[DEFAULT]\nReconnectInterval=60\nPersistMessages=Y\nFileStorePath=../data\nFileLogPath=../log\n\n[SESSION]\nConnectionType=initiator\nSenderCompID=NODEQUICKFIX\nTargetCompID=ELECTRONIFIE\nBeginString=FIX.4.4\nStartTime=00:00:00\nEndTime=23:59:59\nHeartBtInt=30\nSocketConnectPort=3223\nSocketConnectHost=localhost\nUseDataDictionary=Y\nDataDictionary=../node_modules/node-quickfix/quickfix/spec/FIX44.xml\nResetOnLogon=Y';

var order = {
  header: {
    8: 'FIX.4.4',
    35: 'D',
    49: 'ELECTRONIFIE',
    56: 'NODEQUICKFIX'
  },
  tags: {
    11: '0E0Z86K00000',
    48: '06051GDX4',
    22: 1,
    38: 200,
    40: 2,
    54: 1,
    55: 'BAC',
    218: 100,
    60: df(new Date(), "yyyymmdd-HH:MM:ss.l"),
    423: 6
  }
};

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

tcpClient.prototype.generateZeroDelimitedTagValue = function(obj){
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

//Public methods

tcpClient.prototype.sendCredentials = function(name, password){
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
  console.log('writing', credentialsMsg);
  this.client.write(credentialsMsg);
};

tcpClient.prototype.sendSecret = function(){
  if (!this.secret){
    throw new Error('sendSecret: There is no secret recieved!');
  }
  var secret = new Buffer(17);
  secret[0] = 115; //ascii - s for secret
  this.secret.copy(secret,1);
  this.client.write(secret);
};

tcpClient.prototype.sendFIXInitiatorSettings = function(settings){
  if (!settings){
    throw new Error('sendFIXInitiatorSettings: settings param is required');
  }
  if (typeof settings !== 'string'){
    throw new Error('sendFIXInitiatorSettings: settings param type must be string');
  }
  var settingsMsg = 'startFixInitiator' + String.fromCharCode(0) + settings + String.fromCharCode(0);
  this.client.write(settingsMsg);
};

tcpClient.prototype.sendFIXMessage = function(fixMsg){
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

//Event listeners

tcpClient.prototype.connectionHandler = function(){
  console.log('Connected to the server!');
  //Listeners
  this.client.on('error',this.onError.bind(this));
  this.client.on('close', this.onClose.bind(this));
  this.client.on('data', this.onData.bind(this));
};

//TODO inherit..
tcpClient.prototype.secretConnectionHandler = function(){
  console.log('Secret Connected to the server!');
  //Listeners
  this.client.on('error',this.onError.bind(this));
  this.client.on('close', this.onClose.bind(this));
  this.client.on('data', this.onData.bind(this));
  //TODO remove, just for testing 
  this.sendSecret();
  this.sendFIXInitiatorSettings(settings);
  this.sendFIXMessage(order);
};

tcpClient.prototype.onError = function(){
  console.log('Client Error!');
};

tcpClient.prototype.onClose = function(){
  console.log('Client Socket closed.');
  this.client = net.createConnection(this.options,this.connectionHandler.bind(this));
  this.client.on('error',console.log.bind(null,'Error connecting to the server!'));
};

tcpClient.prototype.onData = function(buffer){
  console.log('Recieved data from server - ' + buffer);
  if (buffer[0] === 114){
    var secret = buffer.slice(1,17);
    console.log('Dobio sam ovaj secret',secret,'i njegova duzina je',secret.length);
    this.secret = secret;
    this.client = net.createConnection(this.options,this.secretConnectionHandler.bind(this));
  }
};

module.exports = tcpClient;
