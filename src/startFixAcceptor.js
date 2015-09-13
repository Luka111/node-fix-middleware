'use strict';

var fixAcceptor = require('./fix/fixAcceptor.js');

function execOnSuccess(msg){
  console.log('(((***)))',msg);
}

//creating fixAcceptor
var acceptor = new fixAcceptor();
//starting fixAcceptor
acceptor.start(execOnSuccess);

function workSomething(){
  console.log('alive!');
  setTimeout(workSomething,5000);
};

workSomething();
