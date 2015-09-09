'use strict';

var df = require('dateformat');

var tcpServer = require('./tcpServer.js');
var tcpClient = require('./tcpClient.js');
var fixAcceptor = require('./fix/fixAcceptor.js');

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

function execOnSuccess(msg){
  console.log('***',msg);
}

//creating fixAcceptor
var acceptor = new fixAcceptor();
//starting fixAcceptor
acceptor.start(execOnSuccess);

//creating server
var server = new tcpServer();
//starting server
server.start(14000); 

//client options
var options = {
  port: 14000
};
//starting client
var client = new tcpClient(options);

function introduce(){
  var name = 'luka';
  var password = 'kp';
  this.sendCredentials(name,password);
}

function startFIXInitiator(){
  this.sendFIXInitiatorSettings(settings);
}

function sendFIXMessage(){
  this.sendFIXMessage(order);
}

client.executeCbOnEvent('plainConnection',introduce);
client.executeCbOnEvent('secretConnection',startFIXInitiator);
client.executeCbOnEvent('fixInitiatorStarted',sendFIXMessage);
