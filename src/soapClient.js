'use strict';

var soap = require('soap');

function soapClient(url){
  if (!url) throw new Error('No url provided!');
  if (typeof url !== 'string') throw new Error('url must be string!');
  this.url = url;
}

soapClient.prototype.destroy = function(){
  this.url = null;
}

soapClient.prototype.LogDescribe = function(){
  soap.createClient(this.url,this.LogDescribeInit.bind(null));
};

soapClient.prototype.LogDescribeInit = function(err,client){
  if (err){
    throw err;
  }
  console.log('DESCRIBE:',client.describe());
};

soapClient.prototype.echo = function(args){
  if (!args) throw new Error('Argument MUST be provided!');
  //TODO instead of object make a strict message structure in wsdl file
  if (typeof args !== 'object') throw new Error('Provided argument MUST be an object');
  soap.createClient(this.url,this.EchoInit.bind(this,args));
};

soapClient.prototype.EchoInit = function(args,err,client){
  if (!!err){
    throw err;
  }
  client.echo(args,this.EchoHandler.bind(this));
};

soapClient.prototype.EchoHandler = function(err,result){
  if (!!err){
    throw err;
  }
};

soapClient.prototype.sendFixMsg = function(args){
  if (!args) throw new Error('Argument MUST be provided!');
  //TODO instead of object make a strict message structure in wsdl file
  if (typeof args !== 'object') throw new Error('Provided argument MUST be an object');
  if (!args.hasOwnProperty('header')) throw new Error('Argument object must have property header');
  soap.createClient(this.url,this.sendFixMsgInit.bind(this,args));
};

soapClient.prototype.sendFixMsgInit = function(args,err,client){
  if (!!err){
    throw err;
  }
  client.sendFixMsg(args,this.sendFixMsgHandler.bind(this));
};

soapClient.prototype.sendFixMsgHandler = function(err,result){
  if (!!err){
    throw err;
  }
  console.log('Result : ',result.msg);
};

module.exports = soapClient;
