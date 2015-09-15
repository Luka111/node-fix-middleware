'use strict';

var Logger = require('./logger.js');

var soap = require('soap');
var http = require('http');
var fs = require('fs');
var fixInitiator = require('./fix/fixInitiator.js');
var Listeners = require('./listeners.js');
var Coder = require('./codingFunctions.js');

function soapService(){
  this.fixService = {};
  this.fixService.exec = {};
  this.fixService.exec.echo = null;
  this.fixService.exec.sendFixMsg = null;
  this.fixService.exec.recieveFixMessages = null;
  this.fixService.exec.startFixInitiator = null;
}

soapService.prototype.destroy = function(){
  this.fixService.exec.startFixInitiator = null;
  this.fixService.exec.recieveFixMessages = null;
  this.fixService.exec.sendFixMsg = null;
  this.fixService.exec.echo = null;
  this.fixService.exec = {};
  this.fixService = {};
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
  this.service.fixService.exec.recieveFixMessages = this.recieveFixMessages.bind(this);
  this.service.fixService.exec.startFixInitiator = this.startFixInitiator.bind(this);
  this.wsdl = fs.readFileSync(fileName, 'utf8');
  this.soapServer = null;
  this.fixInitiator = null;
  this.listeners = new Listeners('INITIATOR');
  //add only overriden listeners
  this.listeners.onLogon = this.onLogonListener.bind(this,'INITIATOR');
  this.listeners.onLogout = this.onLogoutListener.bind(this,'INITIATOR');
  this.listeners.fromApp = this.fromAppListener.bind(this,'INITIATOR');
  this.messageQueue = []; //TODO replace with allex
  this.messageLimit = 10000; //TODO check this limit
  this.clearMessageQueueOnNextMsg = false;
}

soapServer.prototype.destroy = function(){
  this.httpServer = null;
  this.path = null;
  this.service.destroy();
  this.service = null;
  this.wsdl = null;
  this.soapServer = null;
  if (!!this.fixInitiator){
    this.fixInitiator.destroy();
  }
  this.fixInitiator = null;
  this.listeners.destroy();
  this.listeners = null;
  //TODO when allex this.messageQueue.destroy();
  this.messageQueue = null;
  this.messageLimit = null;
  this.clearMessageQueueOnNextMsg = null;
};

//Init methods

soapServer.prototype.createServer = function(req,res){
  res.end('404: Not Found: ' + req.url);
};

soapServer.prototype.serverLogging = function(type,data){
  Logger.log(type.toUpperCase() + ': ' + data);
};

soapServer.prototype.start = function(port){
  this.httpServer.listen(port);
  this.soapServer = soap.listen(this.httpServer,this.path,this.service,this.wsdl);
  this.soapServer.log = this.serverLogging.bind(this); 
};

soapServer.prototype.startFixInitiator = function(msg){
  this.fixInitiator = new fixInitiator(msg.settings);
  this.fixInitiator.start();
  this.fixInitiator.registerEventListeners(this.listeners);
  return 'Fix initiator started';
};

//Overridden FIX listeners

soapServer.prototype.onLogonListener = function(emitter,sessionID){
  this.listeners.onLogonListener(emitter,sessionID); //super
  this.fixInitiator.setConnectionEstablished(true);
};

soapServer.prototype.onLogoutListener = function(emitter,sessionID){
  this.listeners.onLogoutListener(emitter,sessionID); //super
  this.fixInitiator.setConnectionEstablished(false);
};

soapServer.prototype.fromAppListener = function(emitter,msg,sessionID){
  this.listeners.fromAppListener(emitter,msg,sessionID); //super
  if (!!this.clearMessageQueueOnNextMsg){
    this.messageQueue = []; //TODO when allex destroy
    this.clearMessageQueueOnNextMsg = false;
  }
  if (this.messageQueue.length == this.messageLimit){
    this.messageQueue.shift(); //TODO allex data struct prob doesnt have shift method but pop
    //TODO get missing messages from database/fs
  }
  var codedMsg = Coder.codeFIXmessage(msg.message);
  if (codedMsg === undefined){
    throw new soapError('soap:Sender','rpc:InvalidHeaderTag','Decoded Header tag is not valid')
  }
  this.messageQueue.push(codedMsg);
};

//SOAP methods

soapServer.prototype.echoCallback = function(msg){
  return {'res':'Message successfully recieved!'};
};

soapServer.prototype.sendFixMsg = function(msg,cb){
  //TODO testing if fix initiator is not started
  if (!this.fixInitiator){
    throw new soapError('soap:Sender','rpc:fixInitiatorNotStarted','Fix initiator is not started!')
  }
  var decodedMsg = this.decodeMsg(msg);
  this.sendDecodedFixMsg(decodedMsg,cb);
};

soapServer.prototype.recieveFixMessages = function(){
  this.clearMessageQueueOnNextMsg = true;
  return this.messageQueue;
};

//Intern methods

soapServer.prototype.sendDecodedFixMsg = function(decodedMsg,cb){
  try{
    this.fixInitiator.send(decodedMsg); 
    cb({msg : 'Successfully sent!!!'});
  }catch(err){
    Logger.log('ERROR: ' + err);
    Logger.log('Resending msg in 5sec...');
    setTimeout(this.sendDecodedFixMsg.bind(this,decodedMsg,cb),5000);
  }
};

soapServer.prototype.decodeMsg = function(msg){
  if (!msg.hasOwnProperty('header')){
    throw new soapError('soap:Sender','rpc:InvalidMsgStructure','Message structure is not valid');
  }
  var decodedMsg = Coder.decodeFIXmessage(msg);
  if (decodedMsg === undefined){
    throw new Error('Error in decoding tags. Invalid tag.')
  }
  return decodedMsg;
};

function soapError(codevalue,subcode,reason){
  //TODO check wsdl for throwing fault
  if (!codevalue) throw new Error('Must provide codevalue to soapError constructor');
  if (typeof codevalue !== 'string') throw new Error('codevalue must be string');
  if (!subcode) throw new Error('Must provide subcode to soapError constructor');
  if (typeof subcode!== 'string') throw new Error('subcode must be string');
  if (!reason) throw new Error('Must provide reason to soapError constructor');
  if (typeof reason !== 'string') throw new Error('reason must be string');
  this.Fault = {};
  this.Fault.Code = {};
  this.Fault.Code.Value = codevalue;
  this.Fault.Code.Subcode = {};
  this.Fault.Code.Subcode.value = subcode;
  this.Fault.Reason = {};
  this.Fault.Reason.Text = reason;
}

soapError.prototype.destroy = function(){
  this.Fault.Code.Value = null;
  this.Fault.Code.Subcode.value = null;
  this.Fault.Code.Subcode = null;
  this.Fault.Code = null;
  this.Fault.Reason.Text = null;
  this.Fault.Reason = null;
  this.Fault = null;
};

module.exports = soapServer;
