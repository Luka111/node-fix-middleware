'use strict';

var df = require('dateformat');

var soapServer = require('./soapServer.js');
var soapClient = require('./soapClient.js');
var fixAcceptor = require('./fix/fixAcceptor.js');

function execOnSuccess(msg){
  console.log('***',msg);
}

//creating fixAcceptor
var acceptor = new fixAcceptor();
//starting fixAcceptor
acceptor.start(execOnSuccess);
//creating soap server
var server = new soapServer('/fixMiddleware','fix.wsdl');
//starting soap server
server.start(8000,execOnSuccess);
//creating soap client
var client = new soapClient('http://localhost:8000/fixMiddleware?wsdl');

//describe
//client.LogDescribe();
//echo testing msg
//client.echo({'msg':'Startujem FIX!'});

//test FIX msg
var order = {
  header: {
    8: 'FIX.4.4',
    35: 'D',
    49: 'ELECTRONIFIE',
    56: 'NODEQUICKFIX'
  },
  tags: {
    11: '0E0Z86K00000',
    48: '06051GDX4',
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

var order1 = {
  header: {
    nesto: 'FIX.4.4'
  }
}

var order5 = {
  header: {
    t8: 'FIX.4.4',
    t35: 'D',
    t49: 'NODEQUICKFIX',
    t56: 'ELECTRONIFIE'
  },
  tags: {
    t11: '0E0Z86K00000',
    t48: '06051GDX4',
    t22: 1,
    t38: 200,
    t40: 2,
    t54: 1,
    t55: 'BAC',
    t218: 100,
    t60: df(new Date(), "yyyymmdd-HH:MM:ss.l"),
    t423: 6
  }
};

//sending FIX msg
acceptor.send(order)
client.sendFixMsg(order5);
setTimeout(function(){
  //acceptor.send(order)
  //acceptor.send(order)
  client.recieveFixMessages();
},10000);
