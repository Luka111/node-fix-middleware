'use strict';

var Logger = require('./logger.js');

function BufferHandler(){
  this.cache = null; //will become buffer if necessery
  this.lastWrittenIndex = 0;
  this.initialCacheSize = 1024; //TODO test why doesnt work for 1
  this.lastWrittenWordIndex = 0;
}

BufferHandler.prototype.destroy = function(){
  this.lastWrittenWordIndex = null;
  this.initialCacheSize = null;
  this.lastWrittenIndex = null;
  this.cache = null;
};

BufferHandler.prototype.getLastWrittenIndex = function(){
  return this.lastWrittenIndex;
};

BufferHandler.prototype.getBuffer = function(){
  return this.cache;
};

BufferHandler.prototype.generateNextWord = function(){
  while (this.cache[this.lastWrittenWordIndex] === 0) this.lastWrittenWordIndex++; //always generate words without zeros at the beginning
  var word = this.cache.slice(this.lastWrittenWordIndex, this.lastWrittenIndex - 1);
  this.lastWrittenWordIndex = this.lastWrittenIndex;
  return word.toString();
};

BufferHandler.prototype.getSlicedBuffer = function(start,end){
  return this.cache.slice(start,end);
};

BufferHandler.prototype.saveToCache = function(bufferItem){
  this.checkCache();
  this.cache[this.lastWrittenIndex] = bufferItem;
  this.lastWrittenIndex++;
};

BufferHandler.prototype.checkCache = function(buffer){
  if (!this.cache){
    this.cache = new Buffer(this.initialCacheSize);
  }
  if(this.cache.length == this.lastWrittenIndex){ //full
    //TODO test doubling cache
    Logger.log('CACHE TOO SMALL, SIZE: ' + this.cache.length);
    var newCache = new Buffer(2 * this.cache.length);
    this.cache.copy(newCache);
    this.cache = newCache;
    Logger.log('CACHE DOUBLED, SIZE: ' + this.cache.length);
  }
}

BufferHandler.prototype.clearCache = function(){
  this.cache = new Buffer(this.initialCacheSize);
  this.lastWrittenIndex = 0;
  this.lastWrittenWordIndex = 0;
};

BufferHandler.prototype.skipByteOnNextWord = function(){
  this.lastWrittenWordIndex++;
};

module.exports = BufferHandler;
