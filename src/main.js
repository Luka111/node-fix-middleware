var soapServer = require('./soapServer.js');
var soapClient = require('./soapClient.js');

var server = new soapServer('/fixMiddleware','fix.wsdl');
var client = new soapClient('http://localhost:8000/fixMiddleware?wsdl');

server.start();
client.LogDescribe();
client.Start({'msg':'Startujem FIX!'});
