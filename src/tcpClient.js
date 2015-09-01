'use strict';

var net = require('net');

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
  this.fillMessages();
  this.sendMessagesInIntervals();
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
