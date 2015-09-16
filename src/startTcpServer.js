'use strict';

var tcpServer = require('./tcpServer.js');

//creating server
var server = new tcpServer();
//starting server
server.start(17000); 
