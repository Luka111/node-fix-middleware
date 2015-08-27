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

var options = {
  propertiesFile: path.join(__dirname,'initiatorProperties.properties')
};

function Initiator(){
  var initiator = new quickfixInitiator({
    onCreate: function(sessionID) {
      initiator.emit('onCreate', { sessionID: sessionID });
    },
    onLogon: function(sessionID) {
      initiator.emit('onLogon', { sessionID: sessionID });
    },
    onLogout: function(sessionID) {
      initiator.emit('onLogout', { sessionID: sessionID });
    },
    onLogonAttempt: function(message, sessionID) {
      initiator.emit('onLogonAttempt', { message: message, sessionID: sessionID });
    },
    toAdmin: function(message, sessionID) {
      initiator.emit('toAdmin', { message: message, sessionID: sessionID });
    },
    fromAdmin: function(message, sessionID) {
      initiator.emit('fromAdmin', { message: message, sessionID: sessionID });
    },
    fromApp: function(message, sessionID) {
      initiator.emit('fromApp', { message: message, sessionID: sessionID });
    }
  },options);
  this.quickfixInitiator = initiator;
  this.started = false;
}

Initiator.prototype.destroy = function(){
  this.quickfixInitiator.stop();
  this.quickfixInitiator = null;
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
  console.log('INITIATOR: Message successfully sent!');
};

Initiator.prototype.registerEventListeners = function(listeners){
  for (var eventName in listeners){
    if (listeners.hasOwnProperty(eventName)){
      this.quickfixInitiator.on(eventName,listeners[eventName]);
    }
  }
};

module.exports = Initiator;
