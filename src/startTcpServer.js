'use strict';

var tcpServer = require('./tcpTestServer.js');

//creating server
var server = new tcpServer();
//starting server
server.start(17000); 
