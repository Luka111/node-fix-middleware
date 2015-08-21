var soapServer = require('./soapServer.js');
var soapClient = require('./soapClient.js');

function execOnStart(msg){
}

//creating soap server
var server = new soapServer('/fixMiddleware','fix.wsdl');
//starting soap server
server.start(8000,execOnStart);
//starting soap client
var client = new soapClient('http://localhost:8000/fixMiddleware?wsdl');

//describe
client.LogDescribe();
//echo testing msg
client.echo({'msg':'Startujem FIX!'});
