'use strict';

var events = require('events');
var quickfix = require('node-quickfix');
var path = require('path');
var Listeners = require('../listeners.js');

var quickfixAcceptor = quickfix.acceptor;

// extend prototype
function inherits (target, source) {
  for (var k in source.prototype)
    target.prototype[k] = source.prototype[k];
}

inherits(quickfixAcceptor, events.EventEmitter);

var options = {
  propertiesFile: path.join(__dirname,'acceptorProperties.properties')
};

function Acceptor(){
  var acceptor = new quickfixAcceptor({
    onCreate: function(sessionID) {
      acceptor.emit('onCreate', { sessionID: sessionID });
    },
    onLogon: function(sessionID) {
      acceptor.emit('onLogon', { sessionID: sessionID });
    },
    onLogout: function(sessionID) {
      acceptor.emit('onLogout', { sessionID: sessionID });
    },
    onLogonAttempt: function(message, sessionID) {
      acceptor.emit('onLogonAttempt', { message: message, sessionID: sessionID });
    },
    toAdmin: function(message, sessionID) {
      acceptor.emit('toAdmin', { message: message, sessionID: sessionID });
    },
    fromAdmin: function(message, sessionID) {
      acceptor.emit('fromAdmin', { message: message, sessionID: sessionID });
    },
    fromApp: function(message, sessionID) {
      acceptor.emit('fromApp', { message: message, sessionID: sessionID });
    }
  }, options);
  this.quickfixAcceptor = acceptor;
  this.listeners = new Listeners('ACCEPTOR');
  this.started = false;
}

Acceptor.prototype.destroy = function(){
  this.quickfixAcceptor.stop();
  this.quickfixAcceptor = null;
  this.started = null;
};

Acceptor.prototype.start = function(cb){
  if (typeof cb !== 'function' && cb !== null){
    throw new Error('start accepts function or null as the first param!');
  }
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

Acceptor.prototype.send = function(msg){
  if (!this.started){
    console.log('FIX Acceptor is not started, resending in 5sec...');
    setTimeout(this.send.bind(this,msg),5000);
  }else{
    this.quickfixAcceptor.send(msg,this.successfullySent.bind(this));
  }
};

Acceptor.prototype.successfullySent = function(){
  console.log('ACCEPTOR: Message successfully sent!');
};

Acceptor.prototype.registerEventListeners = function(){
  for (var eventName in this.listeners){
    if (this.listeners.hasOwnProperty(eventName)){
      this.quickfixAcceptor.on(eventName,this.listeners[eventName]);
    }
  }
};

Acceptor.prototype.registerListener = function(event){
  this.quickfixAcceptor.on(event, console.log.bind(null, event));
};

module.exports = Acceptor;
