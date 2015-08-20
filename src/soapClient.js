'use strict';

var soap = require('soap');

function soapClient(url){
  this.url = url;
}

soapClient.prototype.Start = function(args){
  soap.createClient(this.url,this.StartInit.bind(this,args));
};

soapClient.prototype.StartInit = function(args,err,client){
  console.log('Zovem Start[RPC] with args:',args);
  client.start(args,this.StartHandler.bind(this));
}

soapClient.prototype.StartHandler = function(err,result){
  if (!!err){
    throw err;
  }
  console.log('RESULT:',result);
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
