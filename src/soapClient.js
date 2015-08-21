'use strict';

var soap = require('soap');

function soapClient(url){
  this.url = url;
}

soapClient.prototype.destroy = function(){
  this.url = null;
}

soapClient.prototype.echo = function(args){
  soap.createClient(this.url,this.EchoInit.bind(this,args));
};

soapClient.prototype.EchoInit = function(args,err,client){
  client.echo(args,this.EchoHandler.bind(this));
}

soapClient.prototype.EchoHandler = function(err,result){
  if (!!err){
    throw err;
  }
};

soapClient.prototype.LogDescribe = function(){
  soap.createClient(this.url,this.LogDescribeInit.bind(null));
};

soapClient.prototype.LogDescribeInit = function(err,client){
  if (err){
    throw err;
  }
  console.log('DESCRIBE:',client.describe());
};


module.exports = soapClient;
