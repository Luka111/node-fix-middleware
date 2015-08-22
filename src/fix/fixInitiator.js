'use strict';

var df = require('dateformat');
var events = require('events');
var quickfix = require('node-quickfix');
var path = require('path');

var quickfixInitiator = quickfix.initiator;

// extend prototype
function inherits(target, source) {
  for (var k in source.prototype){
    target.prototype[k] = source.prototype[k];
  }
}

inherits(quickfixInitiator, events.EventEmitter)

quickfixInitiator.prototype.onCreate = function(sessionID) {
  this.emit('onCreate', { sessionID: sessionID });
};

quickfixInitiator.prototype.onLogon = function(sessionID) {
  this.emit('onLogon', { sessionID: sessionID });
};

quickfixInitiator.prototype.onLogout = function(sessionID) {
  this.emit('onLogout', { sessionID: sessionID });
};

quickfixInitiator.prototype.onLogonAttempt = function(message, sessionID) {
  this.emit('onLogonAttempt', { message: message, sessionID: sessionID });
};

quickfixInitiator.prototype.toAdmin = function(message, sessionID) {
  this.emit('toAdmin', { message: message, sessionID: sessionID });
};

quickfixInitiator.prototype.fromAdmin = function(message, sessionID) {
  this.emit('fromAdmin', { message: message, sessionID: sessionID });
};

quickfixInitiator.prototype.fromApp = function(message, sessionID) {
  this.emit('fromApp', { message: message, sessionID: sessionID });
};

var emitOptions = {
  onCreate: quickfixInitiator.onLogout,
  onLogon: quickfixInitiator.onLogon,
  onLogout: quickfixInitiator.onLogout,
  onLogonAttempt: quickfixInitiator.onLogonAttempt,
  toAdmin: quickfixInitiator.toAdmin,
  fromAdmin: quickfixInitiator.fromAdmin,
  fromApp: quickfixInitiator.fromApp,
};

var options = {
  propertiesFile: path.join(__dirname,'initiatorProperties.properties')
};

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

Initiator.prototype.send = function(msg){
  if (!this.started){
    throw new Error('FIX Initiator is not started!');
  }
  this.quickfixInitiator.send(msg,this.successfullySent.bind(this));
};

Initiator.prototype.successfullySent = function(){
  console.log('Message successfully sent!');
};

Initiator.prototype.registerEventListeners = function(listeners){
  for (var eventName in listeners){
    this.quickfixInitiator.on(eventName,listeners[eventName]);
  }
};

module.exports = Initiator;
