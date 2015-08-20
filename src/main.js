var soapServer = require('./soapServer.js');
var soapClient = require('./soapClient.js');

var server = new soapServer('/fixMiddleware','fix.wsdl');
var client = new soapClient('http://localhost:8000/fixService?wsdl');

server.start();
console.log(client.Desribe());
//client.Start({msg:'Startujem FIX!'});
