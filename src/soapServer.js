'use strict';

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
}

soapService.prototype.destroy = function(){
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
  this.wsdl = fs.readFileSync(fileName, 'utf8');
  this.soapServer = null;
  this.fixInitiator = new fixInitiator();
  this.listeners = new Listeners();
  this.listeners.onCreate = this.onCreateListener.bind(this);
  this.listeners.onLogon = this.onLogonListener.bind(this);
  this.listeners.onLogout = this.onLogoutListener.bind(this);
  this.listeners.onLogonAttempt = this.onLogonAttemptListener.bind(this);
  this.listeners.toAdmin = this.toAdminListener.bind(this);
  this.listeners.fromAdmin = this.fromAdminListener.bind(this);
  this.listeners.fromApp = this.fromAppListener.bind(this);
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
  this.fixInitiator.destroy();
  this.fixInitiator = null;
  this.listeners.destroy();
  this.listeners = null;
  //TODO when allex this.messageQueue.destroy();
  this.messageQueue = null;
  this.clearMessageQueueOnNextMsg = null;
};

//Init methods

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
  this.registerEventListeners();
};

//FIX event listeners

soapServer.prototype.onCreateListener = function(sessionID){
  console.log('INITIATOR EVENT onCreate: got Session ID - ' + JSON.stringify(sessionID));
};

soapServer.prototype.onLogonListener = function(sessionID){
  console.log('INITIATOR EVENT onLogon: got Session ID - ' + JSON.stringify(sessionID));
};

soapServer.prototype.onLogoutListener = function(sessionID){
  console.log('INITIATOR EVENT onLogout: got Session ID - ' + JSON.stringify(sessionID));
};

soapServer.prototype.onLogonAttemptListener = function(message,sessionID){
  console.log('INITIATOR EVENT onLogonAttempt: got message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

soapServer.prototype.toAdminListener = function(message,sessionID){
  console.log('INITIATOR EVENT toAdmin: got message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

soapServer.prototype.fromAdminListener = function(message,sessionID){
  console.log('INITIATOR EVENT fromAdmin: got message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

soapServer.prototype.fromAppListener = function(msg, sessionID){
  console.log('INITIATOR EVENT fromApp: got app message - ' + JSON.stringify(msg) + ' .Session ID - ' + JSON.stringify(sessionID));
  if (!!this.clearMessageQueueOnNextMsg){
    this.messageQueue = []; //TODO when allex destroy
    this.clearMessageQueueOnNextMsg = false;
  }
  if (this.messageQueue.length == this.messageLimit){
    this.messageQueue.shift(); //TODO allex data struct prob doesnt have shift method but pop
    //TODO get missing messages from database/fs
  }
  var codedMsg = {};
  codedMsg.header = {};
  var invalidKey = Coder.codeObject(msg.message.header,codedMsg.header,Coder.decodedTagRegexp);
  if (invalidKey !== null){
    throw new soapError('soap:Sender','rpc:InvalidHeaderTag','Decoded Header tag ' + invalidKey + ' is not valid')
  }
  codedMsg.tags = {};
  invalidKey = Coder.codeObject(msg.message.tags,codedMsg.tags,Coder.decodedTagRegexp);
  if (invalidKey !== null){
    throw new soapError('soap:Sender','rpc:InvalidHeaderTag','Decoded Header tag ' + invalidKey + ' is not valid')
  }
  codedMsg.trailer = {};
  invalidKey = Coder.codeObject(msg.message.trailer,codedMsg.trailer,Coder.decodedTagRegexp);
  if (invalidKey !== null){
    throw new soapError('soap:Sender','rpc:InvalidHeaderTag','Decoded Header tag ' + invalidKey + ' is not valid')
  }
  this.messageQueue.push(codedMsg);
};

//SOAP methods

soapServer.prototype.echoCallback = function(msg){
  return {'res':'Message successfully recieved!'};
};

soapServer.prototype.sendFixMsg = function(msg,cb){
  var decodedMsg = this.decodeMsg(msg);
  console.log('DEKODIRANA PORUKA',decodedMsg);
  try{
    this.fixInitiator.send(decodedMsg); 
    cb({msg : 'Successfully sent!!!'});
  }catch(err){
    console.log('ERROR: ',err);
    console.log('Resending msg in 5sec...');
    setTimeout(this.sendFixMsg.bind(this,decodedMsg,cb),5000);
  }
};

soapServer.prototype.recieveFixMessages = function(){
  this.clearMessageQueueOnNextMsg = true;
  return this.messageQueue;
};

//Intern methods

soapServer.prototype.decodeMsg = function(msg){
  if (!msg.hasOwnProperty('header')){
    throw new soapError('soap:Sender','rpc:InvalidMsgStructure','Message structure is not valid');
  }
  var decodedMsg = {};
  decodedMsg.header = {};
  var invalidKey = Coder.decodeObject(msg.header,decodedMsg.header,Coder.codedTagRegexp);
  if (invalidKey !== null){
    throw new soapError('soap:Sender','rpc:InvalidHeaderTag','Coded Header tag ' + invalidKey + ' is not valid')
  }
  if (!msg.hasOwnProperty('tags')){
    return decodedMsg;
  }
  decodedMsg.tags = {};
  invalidKey = Coder.decodeObject(msg.tags,decodedMsg.tags,Coder.codedTagRegexp);
  if (invalidKey !== null){
    throw new soapError('soap:Sender','rpc:InvalidHeaderTag','Coded Header tag ' + invalidKey + ' is not valid')
  }
  //TODO support groups tag
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
