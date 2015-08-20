'use strict';

var soap = require('soap');
var http = require('http');
var fs = require('fs');
var fixInitiator = require('./fix/fixInitiator.js');

var myService = {
  fixService: {
    exec: {
      start: function(msg){
        return {'res':'Message successfully recieved!'};
      }
    }
  }
}

var listeners = {}; //event listeners on fix initiator - { eventName : callback }

function soapServer(path,fileName){
  this.httpServer = http.createServer(this.createServer.bind(this));
  this.path = path;
  this.service = myService;
  this.wsdl = fs.readFileSync(fileName, 'utf8');
  this.soapServer = null;
  this.fixInitiator = new fixInitiator();
  this.start();
}

soapServer.prototype.destroy = function(){
  this.httpServer = null;
  this.path = null;
  this.service = null;
  this.wsdl = null;
  this.soapServer = null;
  this.fixInitiator = null;
};

soapServer.prototype.createServer = function(req,res){
  res.end('404: Not Found: ' + req.url);
};

soapServer.prototype.serverLogging = function(type,data){
  console.log(type.toUpperCase() + ': ' + data);
};

soapServer.prototype.registerEventListeners = function(listeners){
  this.fixInitiator.registerEventLiseners(listeners);
};

soapServer.prototype.start = function(){
  this.httpServer.listen(8000);
  this.soapServer = soap.listen(this.httpServer,this.path,this.service,this.wsdl);
  this.soapServer.log = this.serverLogging.bind(this); 
  this.registerEventListeners(listeners);
};

module.exports = soapServer;
