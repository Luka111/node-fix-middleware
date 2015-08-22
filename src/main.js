'use strict';

var df = require('dateformat');

var soapServer = require('./soapServer.js');
var soapClient = require('./soapClient.js');
var fixAcceptor = require('./fix/fixAcceptor.js');

function execOnSoapServerStart(msg){
  console.log('***',msg);
}

function execOnFixAcceptorStart(msg){
  console.log('***',msg);
}

//creating soap server
var server = new soapServer('/fixMiddleware','fix.wsdl');
//starting soap server
server.start(8000,execOnSoapServerStart);
//creating soap client
var client = new soapClient('http://localhost:8000/fixMiddleware?wsdl');
//creating fixAcceptor
var acceptor = new fixAcceptor();
//starting fixAcceptor
acceptor.start(execOnFixAcceptorStart);

//describe
client.LogDescribe();
//echo testing msg
client.echo({'msg':'Startujem FIX!'});

//test FIX msg
var order = {
  header: {
    8: 'FIX.4.4',
    35: 'D',
    49: "NODEQUICKFIX",
    56: "ELECTRONIFIE"
  },
  tags: {
    11: "0E0Z86K00000",
    48: "06051GDX4",
    22: 1,
    38: 200,
    40: 2,
    54: 1,
    55: 'BAC',
    218: 100,
    60: df(new Date(), "yyyymmdd-HH:MM:ss.l"),
    423: 6
  }
};

//sending FIX msg
client.sendFixMsg(order);
