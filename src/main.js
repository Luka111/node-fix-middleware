var soapServer = require('./soapServer.js');
var soapClient = require('./soapClient.js');

var server = new soapServer('/fixMiddleware','fix.wsdl');
var client = new soapClient();

server.start();
//describe first ;)
client.Start('http://localhost:8000/fixMiddleware?wsdl');
