'use strict';

var net = require('net');
var fixInitiator = require('./fix/fixInitiator.js');
var Listeners = require('./listeners.js');

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
  this.server = net.createServer(this.connectionHandler.bind(this));
  //TODO add methods
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
  this.methods.destroy();
  this.methods = null;
};

//Intern methods

tcpFixServer.prototype.start = function(port){
  this.server.listen(port,this.onListening.bind(this));
};

tcpFixServer.prototype.connectionHandler = function(socket){
  console.log('New connection - ', socket.remoteAddress);
  //Listeners
  socket.on('error',this.onError.bind(this,socket));

  socket.on('close', this.onClose.bind(this));
  socket.on('data', this.onData.bind(this));
};

tcpFixServer.prototype.startFixInitiator = function(settings){
  this.fixInitiator = new fixInitiator(settings);
  this.fixInitiator.start();
  this.fixInitiator.registerEventListeners(this.listeners);
};

//Event listeners

tcpFixServer.prototype.onListening = function(){
  console.log('Server started!');
};

tcpFixServer.prototype.onError = function(socket){
  console.log('Error with ' +  socket.remoteAddress + '\n Closing connection');
  socket.destroy();
};

tcpFixServer.prototype.onClose = function(){
  console.log('Socket closed.');
};

tcpFixServer.prototype.onData = function(buffer){
  //TODO work ;d
  console.log(buffer.toString()); //utf8
};

module.exports = tcpFixServer;
