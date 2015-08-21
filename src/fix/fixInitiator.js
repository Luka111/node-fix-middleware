'use strict';

var df = require('dateformat');
var events = require('events');
var quickfix = require('node-quickfix');

var quickfixInitiator = quickfix.initiator;

var emitOptions = {
  onCreate: function(sessionID) {
    fixClient.emit('onCreate', { sessionID: sessionID });
  },
  onLogon: function(sessionID) {
    fixClient.emit('onLogon', { sessionID: sessionID });
  },
  onLogout: function(sessionID) {
    fixClient.emit('onLogout', { sessionID: sessionID });
  },
  onLogonAttempt: function(message, sessionID) {
    fixClient.emit('onLogonAttempt', { message: message, sessionID: sessionID });
  },
  toAdmin: function(message, sessionID) {
    fixClient.emit('toAdmin', { message: message, sessionID: sessionID });
  },
  fromAdmin: function(message, sessionID) {
    fixClient.emit('fromAdmin', { message: message, sessionID: sessionID });
  },
  fromApp: function(message, sessionID) {
    fixClient.emit('fromApp', { message: message, sessionID: sessionID });
  }
};

var options = {
  propertiesFile: './initiatorProperties.properties'
};

// extend prototype
function inherits(target, source) {
  for (var k in source.prototype){
    target.prototype[k] = source.prototype[k];
  }
}

inherits(quickfixInitiator, events.EventEmitter)

function Initiator(){
  this.quickfixInitiator = new quickfixInitiator(emitOptions,options);
  this.started = false;
}

Initiator.prototype.destroy = function(){
  this.started = null;
};

Initiator.prototype.start = function(cb){
  this.quickfixInitiator.start(this.successfullyStarted.bind(this,cb));
};

Initiator.prototype.successfullyStarted = function(cb){
	console.log('FIX Initiator Started');
  this.started = true;
  if (!!cb){
    cb('FIX Initiator successfully started!');
  }
};

Initiator.prototype.send = function(msg,cb){
  if (!this.started){
    throw new Error('FIX Initiator is not started!');
  }
  this.quickfixInitiator.send(msg,this.successfullySent.bind(this,cb));
};

Initiator.prototype.successfullySent = function(cb){
  console.log('Message successfully sent!');
  if (!!cb){
    cb('Message successfully sent!');
  }
};

Initiator.prototype.registerEventListeners = function(listeners){
  for (var eventName in listeners){
    this.quickfixInitiator.on(eventName,listeners[eventName]);
  }
};

module.exports = Initiator;
