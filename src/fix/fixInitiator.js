'use strict';

var Logger = require('../logger.js');

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

function Initiator(settings){
  if (!!settings){
    delete options.propertiesFile;
    options.settings = settings;
  }
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
  this.connectionEstablished = false;
}

Initiator.prototype.destroy = function(){
  this.quickfixInitiator.stop();
  //TODO maybe wait for logout event and then destroy everything?
  this.quickfixInitiator.removeAllListeners();
  this.quickfixInitiator = null;
  this.started = null;
  this.connectionEstablished = null;
};

Initiator.prototype.start = function(cb){
  this.quickfixInitiator.start(this.successfullyStarted.bind(this,cb));
};

Initiator.prototype.successfullyStarted = function(cb){
  Logger.log('FIX Initiator Started');
  this.started = true;
  cb();
};

//Getters/setters

Initiator.prototype.setConnectionEstablished = function(val){
  if (typeof val !== 'boolean'){
    throw new Error('Parametar: ' + val + ' .setConnectionEstablished accepts boolean as a parameter.');
  }
  this.connectionEstablished = val;
};

Initiator.prototype.getConnectionEstablished = function(val){
  return this.connectionEstablished;
};

Initiator.prototype.send = function(cb,msg){
  if (!this.started){
    throw new Error('FIX Initiator is not started!');
  }
  if (!this.connectionEstablished){
    throw new Error('Connection to FIX Acceptor is not established!');
  }
  this.quickfixInitiator.send(msg,this.successfullySent.bind(this,cb));
};

Initiator.prototype.successfullySent = function(cb){
  Logger.log('INITIATOR: Message successfully sent!');
  cb();
};

Initiator.prototype.registerEventListeners = function(listeners){
  for (var eventName in listeners){
    if (listeners.hasOwnProperty(eventName)){
      this.quickfixInitiator.on(eventName,listeners[eventName]);
    }
  }
};

module.exports = Initiator;
