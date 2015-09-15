'use strict';

var Logger = require('./logger.js');

//event listeners on fix initiator - { eventName : callback }
function Listeners(emitter){
  this.onCreate = this.onCreateListener.bind(this,emitter);
  this.onLogon = this.onLogonListener.bind(this,emitter);
  this.onLogout = this.onLogoutListener.bind(this,emitter);
  this.onLogonAttempt = this.onLogonAttemptListener.bind(this,emitter);
  this.toAdmin = this.toAdminListener.bind(this,emitter);
  this.fromAdmin = this.fromAdminListener.bind(this,emitter);
  this.fromApp = this.fromAppListener.bind(this,emitter);
}

Listeners.prototype.destroy = function(){
  this.onCreate = null;
  this.onLogon = null;
  this.onLogout = null;
  this.onLogonAttempt = null;
  this.toAdmin = null;
  this.fromAdmin = null;
  this.fromApp = null;
};

//FIX event listeners

Listeners.prototype.onCreateListener = function(emitter,sessionID){
  Logger.log(emitter + ' EVENT onCreate: got Session ID - ' + JSON.stringify(sessionID));
};

Listeners.prototype.onLogonListener = function(emitter,sessionID){
  Logger.log(emitter + ' EVENT onLogon: got Session ID - ' + JSON.stringify(sessionID));
};

Listeners.prototype.onLogoutListener = function(emitter,sessionID){
  Logger.log(emitter + ' EVENT onLogout: got Session ID - ' + JSON.stringify(sessionID));
};

Listeners.prototype.onLogonAttemptListener = function(emitter,message,sessionID){
  Logger.log(emitter + ' EVENT onLogonAttempt: got message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

Listeners.prototype.toAdminListener = function(emitter,message,sessionID){
  Logger.log(emitter + ' EVENT toAdmin: got message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

Listeners.prototype.fromAdminListener = function(emitter,message,sessionID){
  Logger.log(emitter + ' EVENT fromAdmin: got message - ' + JSON.stringify(message) + ' .Session ID - ' + JSON.stringify(sessionID));
};

Listeners.prototype.fromAppListener = function(emitter,msg, sessionID){
  Logger.log(emitter + ' EVENT fromApp: got app message - ' + JSON.stringify(msg) + ' .Session ID - ' + JSON.stringify(sessionID));
};

module.exports = Listeners;
