'use strict';

var Logger = require('./logger.js');

var df = require('dateformat');

var tcpClient = require('./tcpClient.js');

var settings = '[DEFAULT]\nReconnectInterval=60\nPersistMessages=Y\nFileStorePath=../data\nFileLogPath=../log\n\n[SESSION]\nConnectionType=initiator\nSenderCompID=NODEQUICKFIX\nTargetCompID=ELECTRONIFIE\nBeginString=FIX.4.4\nStartTime=00:00:00\nEndTime=23:59:59\nHeartBtInt=30\nSocketConnectPort=3223\nSocketConnectHost=localhost\nUseDataDictionary=Y\nDataDictionary=../node_modules/node-quickfix/quickfix/spec/FIX44.xml\nResetOnLogon=Y';

var order = {
  header: {
    8: 'FIX.4.4',
    35: 'D',
    49: 'NODEQUICKFIX',
    56: 'ELECTRONIFIE'
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

var invalidOrder = {
  header: {
    8: 'FIX.4.4',
    a35: 'D',
    49: 'ELECTRONIFIE',
    56: 'NODEQUICKFIX'
  }
};

function execOnSuccess(msg){
  Logger.log('<***> ' + msg);
}

//client options
var options = {
  port: 17000,
  host: '54.172.225.242'
};

//credentials - !
var name = 'luka';
var password = 'kp';

//starting client
var client = new tcpClient(options,name,password,settings);

client.sendFixMsg(order);
