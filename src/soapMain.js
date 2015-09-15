'use strict';

var Logger = require('./logger.js');

var df = require('dateformat');

var soapServer = require('./soapServer.js');
var soapClient = require('./soapClient.js');
var fixAcceptor = require('./fix/fixAcceptor.js');

function execOnSuccess(msg){
  Logger.log('***+() ' + msg);
}

var settings = '[DEFAULT]\nReconnectInterval=60\nPersistMessages=Y\nFileStorePath=../data\nFileLogPath=../log\n\n[SESSION]\nConnectionType=initiator\nSenderCompID=NODEQUICKFIX\nTargetCompID=ELECTRONIFIE\nBeginString=FIX.4.4\nStartTime=00:00:00\nEndTime=23:59:59\nHeartBtInt=30\nSocketConnectPort=3223\nSocketConnectHost=localhost\nUseDataDictionary=Y\nDataDictionary=../node_modules/node-quickfix/quickfix/spec/FIX44.xml\nResetOnLogon=Y';

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
//creating fixAcceptor
var acceptor = new fixAcceptor();
//starting fixAcceptor
acceptor.start(execOnSuccess);
//creating soap client
var client = new soapClient('http://localhost:8000/fixMiddleware?wsdl');
//creating soap server
var server = new soapServer('/fixMiddleware','fix.wsdl');
//starting soap server
server.start(8000);
//starting fix initiator
client.startFixInitiator({settings : settings});

//describe
//client.LogDescribe();
//echo testing msg
//client.echo({'msg':'Startujem FIX!'});

//test FIX msg

//sending FIX msg
setTimeout(function(){
  //acceptor.send(order);
  acceptor.send(order);
  client.sendFixMsg(order5);
  client.recieveFixMessages();
},10000);
