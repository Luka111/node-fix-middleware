'use strict';

var events = require('events');
var quickfix = require('node-quickfix');

var quickfixAcceptor = quickfix.acceptor;

var emitOptions = {
  onCreate: function(sessionID) {
    fixServer.emit('onCreate', { sessionID: sessionID });
  },
  onLogon: function(sessionID) {
    fixServer.emit('onLogon', { sessionID: sessionID });
  },
  onLogout: function(sessionID) {
    fixServer.emit('onLogout', { sessionID: sessionID });
  },
  onLogonAttempt: function(message, sessionID) {
    fixServer.emit('onLogonAttempt', { message: message, sessionID: sessionID });
  },
  toAdmin: function(message, sessionID) {
    fixServer.emit('toAdmin', { message: message, sessionID: sessionID });
  },
  fromAdmin: function(message, sessionID) {
    fixServer.emit('fromAdmin', { message: message, sessionID: sessionID });
  },
  fromApp: function(message, sessionID) {
    fixServer.emit('fromApp', { message: message, sessionID: sessionID });
  }
};

var options = {
  propertiesFile: './acceptorProperties.properties'
};

// extend prototype
function inherits (target, source) {
  for (var k in source.prototype)
    target.prototype[k] = source.prototype[k];
}

inherits(quickfixAcceptor, events.EventEmitter);

function Acceptor(){
  this.quickfixAcceptor = new quickfixAcceptor(emitOptions, options);
  this.started = false;
  this.eventNames = ['onCreate','onLogon','onLogout','onLogonAttempt','toAdmin','fromAdmin','fromApp'];
}

Acceptor.prototype.destroy = function(){
  this.quickfixAcceptor = null;
  this.started = null;
};

Acceptor.prototype.start = function(cb){
  this.quickfixAcceptor.start(this.successfullyStarted.bind(this,cb));
};

Acceptor.prototype.successfullyStarted = function(cb){
	console.log('FIX Acceptor Started');
  this.started = true;
  this.registerEventListeners();
  if (!!cb){
    cb('FIX Acceptor successfully started!');
  }
};

Acceptor.prototype.registerEventListeners = function(){
  this.eventNames.forEach(function (event) {
    this.quickfixAcceptor.on(event, console.log.bind(null, event));
  });
};

module.exports = Acceptor;
