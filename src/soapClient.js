'use strict';

var soap = require('soap');

function soapClient(url){
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
  console.log('OVDE GA DOBIJAM SIGURNO',result.msg);
};

module.exports = soapClient;
