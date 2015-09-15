'use strict';

var Logger = require('./logger.js');

var df = require('dateformat');

var fixAcceptor = require('./fix/fixAcceptor.js');

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
  Logger.log('(((***))) ' + msg);
}

//creating fixAcceptor
var acceptor = new fixAcceptor();
//starting fixAcceptor
acceptor.start(execOnSuccess);

setTimeout(function(){
  acceptor.send(order);
},20000);

function workSomething(){
  Logger.log('alive!');
  setTimeout(workSomething,5000);
};

workSomething();
