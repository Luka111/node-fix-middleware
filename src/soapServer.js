'use strict';

var soap = require('soap');
var http = require('http');
var fs = require('fs');

var myService = {
  fixService: {
    exec: {
      start: function(msg){
        console.log('[START] Data received! - ' + msg);
        return {'res':'Message successfully recieved!'};
      }
    }
  }
}

function soapServer(path,fileName){
  this.server = http.createServer(this.createServer.bind(null));
  this.path = path;
  this.service = myService;
  this.wsdl = fs.readFileSync(fileName, 'utf8');
}

soapServer.prototype.createServer = function(req,res){
  res.end('404: Not Found: ' + req.url);
};

soapServer.prototype.start = function(){
  this.server.listen(8000);
  soap.listen(this.server,this.path,this.service,this.wsdl);
  console.log('SOAP server listening on localhost:8000...');
};

module.exports = soapServer;
