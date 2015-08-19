'use strict';

var soap = require('node-soap');

function soapClient(){
}

soapClient.prototype.Start = function(url,args){
  soap.createClient(url,this.StartInit.bind(null,args));
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


module.exports = soapClient;
