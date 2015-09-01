'use strict';

var tcpServer = require('./tcpServer.js');
var tcpClient = require('./tcpClient.js');

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

//test writing
//var msg = 'cIdemoo..';
var msg0 = 'c'
var msg1 = 'luk';
var msg2 = 'a' + String.fromCharCode(0);
var msg3 = 'kp';
var msg4 = String.fromCharCode(0);

function sendMsg(client,msg){
  client.send(msg);
  //setTimeout(sendMsg.bind(null,client,msg),5000);
}

function sendMessages(client, msgs){
  if(msgs.length<1){
    return;
  }
  //sendMsg(client,msgs.pop());
  client.send(msgs.shift());
  setTimeout(sendMessages.bind(null, client, msgs), 1000);
}

//sendMessages(client, [msg0, msg4, msg4, msg4, msg0, msg1, msg3, msg1, msg4, msg3, msg4, msg2, msg0, msg1, msg2, msg3, msg4]);
sendMessages(client, [msg0, msg1, msg2, msg3, msg4]);
