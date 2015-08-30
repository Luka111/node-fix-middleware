'use strict';

var net = require('net');

function tcpClient(options){
  this.options = options;
  this.client = net.createConnection(options,this.connectionHandler.bind(this));
}

tcpClient.prototype.destroy = function(){
  this.client.destroy();
  this.options = null;
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

tcpClient.prototype.onError = function(){
  console.log('Client Error!');
  this.client = net.createConnection(this.options,this.connectionHandler.bind(this));
};

tcpClient.prototype.onClose = function(){
  console.log('Client Socket closed.');
};

tcpClient.prototype.onData = function(buffer){
  console.log('Recieved data from server - ' + buffer.toString());
};

module.exports = tcpClient;
