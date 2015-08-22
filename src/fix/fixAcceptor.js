'use strict';

var events = require('events');
var quickfix = require('node-quickfix');
var path = require('path');

var quickfixAcceptor = quickfix.acceptor;

// extend prototype
function inherits (target, source) {
  for (var k in source.prototype)
    target.prototype[k] = source.prototype[k];
}

inherits(quickfixAcceptor, events.EventEmitter);

quickfixAcceptor.prototype.onCreate = function(sessionID) {
  this.emit('onCreate', { sessionID: sessionID });
};

quickfixAcceptor.prototype.onLogon = function(sessionID) {
  this.emit('onLogon', { sessionID: sessionID });
};

quickfixAcceptor.prototype.onLogout = function(sessionID) {
  this.emit('onLogout', { sessionID: sessionID });
};

quickfixAcceptor.prototype.onLogonAttempt = function(message, sessionID) {
  this.emit('onLogonAttempt', { message: message, sessionID: sessionID });
};

quickfixAcceptor.prototype.toAdmin = function(message, sessionID) {
  this.emit('toAdmin', { message: message, sessionID: sessionID });
};

quickfixAcceptor.prototype.fromAdmin = function(message, sessionID) {
  this.emit('fromAdmin', { message: message, sessionID: sessionID });
};

quickfixAcceptor.prototype.fromApp = function(message, sessionID) {
  this.emit('fromApp', { message: message, sessionID: sessionID });
};

var emitOptions = {
  onCreate: quickfixAcceptor.onLogout,
  onLogon: quickfixAcceptor.onLogon,
  onLogout: quickfixAcceptor.onLogout,
  onLogonAttempt: quickfixAcceptor.onLogonAttempt,
  toAdmin: quickfixAcceptor.toAdmin,
  fromAdmin: quickfixAcceptor.fromAdmin,
  fromApp: quickfixAcceptor.fromApp,
};

var options = {
  propertiesFile: path.join(__dirname,'acceptorProperties.properties')
};

function Acceptor(){
  this.quickfixAcceptor = new quickfixAcceptor(emitOptions, options);
  this.started = false;
  this.eventNames = ['onCreate','onLogon','onLogout','onLogonAttempt','toAdmin','fromAdmin','fromApp'];
}

Acceptor.prototype.destroy = function(){
  this.quickfixAcceptor.stop();
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
  this.eventNames.forEach(this.registerListener.bind(this));
};

Acceptor.prototype.registerListener = function(event){
  this.quickfixAcceptor.on(event, console.log.bind(null, event));
};

module.exports = Acceptor;
