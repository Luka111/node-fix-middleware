'use strict';

var soap = require('soap');

function soapClient(url){
  this.url = url;
}

soapClient.prototype.Start = function(args){
  soap.createClient(this.url,this.StartInit.bind(null,args));
};

soapClient.prototype.StartInit = function(args,err,client){
  console.log('Zovem Start[RPC]');
  client.Start(args,this.StartHandler.bind(null));
}

soapClient.prototype.StartHandler = function(err,result){
  if (!!err){
    throw err;
  }
  console.log(result);
};

soapClient.prototype.Desribe = function(){
  soap.createClient(this.url,this.DescribeInit.bind(null));
};

soapClient.prototype.DescribeInit = function(err,client){
  if (err){
    throw err;
  }
  client.describe();
};


module.exports = soapClient;
