'use strict';

//event listeners on fix initiator - { eventName : callback }
function Listeners(){
  this.onCreate = null;
  this.onLogon = null;
  this.onLogout = null;
  this.onLogonAttempt = null;
  this.toAdmin = null;
  this.fromAdmin = null;
  this.fromApp = null;
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

module.exports = Listeners;
