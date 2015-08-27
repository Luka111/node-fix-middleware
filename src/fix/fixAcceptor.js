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
  this.listeners = new Listeners();
  this.listeners.onCreate = this.onCreateListener.bind(this);
  this.listeners.onLogon = this.onLogonListener.bind(this);
  this.listeners.onLogout = this.onLogoutListener.bind(this);
  this.listeners.onLogonAttempt = this.onLogonAttemptListener.bind(this);
  this.listeners.toAdmin = this.toAdminListener.bind(this);
  this.listeners.fromAdmin = this.fromAdminListener.bind(this);
  this.listeners.fromApp = this.fromAppListener.bind(this);
  this.started = false;
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

Acceptor.prototype.onCreateListener = function(sessionID){
  console.log('ACCEPTOR EVENT onCreate: got Session ID - ' + JSON.stringify(sessionID));
};

Acceptor.prototype.onLogonListener = function(sessionID){
  console.log('ACCEPTOR EVENT onLogon: got Session ID - ' + JSON.stringify(sessionID));
};

Acceptor.prototype.onLogoutListener = function(sessionID){
  console.log('ACCEPTOR EVENT onLogout: got Session ID - ' + JSON.stringify(sessionID));
};

Acceptor.prototype.onLogonAttemptListener = function(message,sessionID){
  console.log('ACCEPTOR EVENT onLogonAttempt: got message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

Acceptor.prototype.toAdminListener = function(message,sessionID){
  console.log('ACCEPTOR EVENT toAdmin: got message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

Acceptor.prototype.fromAdminListener = function(message,sessionID){
  console.log('ACCEPTOR EVENT fromAdmin: got message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

Acceptor.prototype.fromAppListener = function(message, sessionID){
  console.log('ACCEPTOR EVENT fromApp: got app message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

module.exports = Acceptor;
