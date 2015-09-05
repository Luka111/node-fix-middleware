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
var name = 'luka';
var password = 'kp';

client.sendCredentials(name,password);
