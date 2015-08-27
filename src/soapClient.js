'use strict';

var soap = require('soap');

var Coder = require('./codingFunctions.js');

function soapClient(url){
  if (!url) throw new Error('No url provided!');
  if (typeof url !== 'string') throw new Error('url must be string!');
  this.url = url;
}

soapClient.prototype.destroy = function(){
  this.url = null;
}

soapClient.prototype.LogDescribe = function(){
  soap.createClient(this.url,this.LogDescribeInit.bind(this));
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
  //if (typeof args !== 'object') throw new Error('Provided argument MUST be an object');
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
    if (err.hasOwnProperty('root')){
      var errMsg = err.root.Envelope.Body.Fault.Reason.Text;
      throw new Error(errMsg);
    }else{
      throw err;
    }
  }
  console.log('Result : ',result.msg);
};

soapClient.prototype.recieveFixMessages = function(){
  soap.createClient(this.url,this.recieveFixMessagesInit.bind(this));
};

soapClient.prototype.recieveFixMessagesInit = function(err,client){
  if (!!err){
    throw err;
  }
  client.recieveFixMessages(this.recieveFixMessagesHandler.bind(this));
};

soapClient.prototype.recieveFixMessagesHandler = function(err,result){
  if (!!err){
    throw err;
  }
  var decodedResult;
  if (result instanceof Array){
    decodedResult = [];
    result.forEach(this.decodeArray.bind(this,decodedResult));
  }else{
    decodedResult = this.decodeElement(result);
  }
  console.log('EVO DECODOVANE FIX PORUKE U NIZU',JSON.stringify(decodedResult));
  return result;
};

soapClient.prototype.decodeElement = function(codedElement){
  var decodedResult = {};
  //TODO testing for missing properties, for example no tags property
  decodedResult.header = {};
  var invalidKey = Coder.decodeObject(codedElement.header,decodedResult.header,Coder.codedTagRegexp);
  if (invalidKey !== null){
    throw new Error('Decoded Header tag ' + invalidKey + ' is not valid')
  }
  decodedResult.tags= {};
  var invalidKey = Coder.decodeObject(codedElement.tags,decodedResult.tags,Coder.codedTagRegexp);
  if (invalidKey !== null){
    throw new Error('Decoded Header tag ' + invalidKey + ' is not valid')
  }
  decodedResult.trailer= {};
  var invalidKey = Coder.decodeObject(codedElement.trailer,decodedResult.trailer,Coder.codedTagRegexp);
  if (invalidKey !== null){
    throw new Error('Decoded Header tag ' + invalidKey + ' is not valid')
  }
  return decodedResult;
};

soapClient.prototype.decodeArray = function(result,elem){
  var decodedObj = this.decodeElement(elem);
  result.push(decodedObj);
};

module.exports = soapClient;
