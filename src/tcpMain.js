'use strict';

var tcpServer = require('./tcpServer.js');

var server = new tcpServer();

server.start(14000); 
