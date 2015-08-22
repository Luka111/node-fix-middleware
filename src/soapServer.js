'use strict';

var soap = require('soap');
var http = require('http');
var fs = require('fs');
var fixInitiator = require('./fix/fixInitiator.js');

function soapService(){
  this.fixService = {};
  this.fixService.exec = {};
  this.fixService.exec.echo = null;
  this.fixService.exec.sendFixMsg = null;
}

soapService.prototype.destroy = function(){
  this.fixService.exec.sendFixMsg = null;
  this.fixService.exec.echo = null;
  this.fixService.exec = {};
  this.fixService = {};
};

//event listeners on fix initiator - { eventName : callback }
function Listeners(){
  //example*
  //this.onCreate = null;
}

Listeners.prototype.destroy = function(){
  //example**
  //this.onCreate = null;
};

function soapServer(path,fileName){
  if (!path) throw new Error('No path provided!');
  if (typeof path !== 'string') throw new Error('Path must be string!');
  if (!fileName) throw new Error('No fileName provided!');
  if (typeof fileName !== 'string') throw new Error('fileName must be string!');
  this.httpServer = http.createServer(this.createServer.bind(this));
  this.path = path;
  this.service = new soapService();
  this.service.fixService.exec.echo = this.echoCallback.bind(this);
  this.service.fixService.exec.sendFixMsg = this.sendFixMsg.bind(this);
  this.wsdl = fs.readFileSync(fileName, 'utf8');
  this.soapServer = null;
  this.fixInitiator = new fixInitiator();
  this.listeners = new Listeners();
  //example***
  //this.listeners.onCreate = this.someEventListener.bind(this);
}

soapServer.prototype.destroy = function(){
  this.httpServer = null;
  this.path = null;
  this.service.destroy();
  this.service = null;
  this.wsdl = null;
  this.soapServer = null;
  this.fixInitiator.destroy();
  this.fixInitiator = null;
  this.listeners.destroy();
  this.listeners = null;
};

soapServer.prototype.echoCallback = function(msg){
  return {'res':'Message successfully recieved!'};
};

soapServer.prototype.createServer = function(req,res){
  res.end('404: Not Found: ' + req.url);
};

soapServer.prototype.serverLogging = function(type,data){
  console.log(type.toUpperCase() + ': ' + data);
};

soapServer.prototype.registerEventListeners = function(){
  this.fixInitiator.registerEventListeners(this.listeners);
};

soapServer.prototype.start = function(port,cb){
  this.httpServer.listen(port);
  this.soapServer = soap.listen(this.httpServer,this.path,this.service,this.wsdl);
  this.soapServer.log = this.serverLogging.bind(this); 
  this.fixInitiator.start(cb);
  this.registerEventListeners(this.listeners);
};

soapServer.prototype.sendFixMsg = function(msg,cb){
  var isValid = this.checkFIXMessageStructure(msg);
  if (!isValid) throw new Error('Message structure not valid!');
  try{
    this.fixInitiator.send(msg); 
    cb({msg : 'Successfully sent!!!'});
  }catch(err){
    console.log('ERROR: ',err);
    console.log('Resending msg in 5sec...');
    setTimeout(this.sendFixMsg.bind(this,msg,cb),5000);
  }
};

soapServer.prototype.checkFIXMessageStructure = function(msg){
  //TODO check FIX message structure
  if (!msg.hasOwnProperty('header')){
    return false;
  }
  return true;
};

module.exports = soapServer;
