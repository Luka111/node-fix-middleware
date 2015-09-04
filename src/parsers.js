'use strict';

var BufferHandler = require('./bufferHandler.js');

function IdleParser(){
  this.bufferHandler = new BufferHandler();
}

IdleParser.prototype.destroy = function(){
  this.bufferHandler.destroy();
  this.bufferHandler = null;
};

IdleParser.prototype.execute = function(bufferItem){
  throw new Error('Must implement parsing logic!');
};

IdleParser.prototype.executeByte= function(bufferItem){
  this.bufferHandler.saveToCache(bufferItem);
  this.execute(bufferItem);
};

function CredentialsParser(){
  this.zeroCnt = 0;
  this.name = '';
  this.password = '';
  IdleParser.call(this);
}

CredentialsParser.prototype = Object.create(IdleParser.prototype, {constructor:{
  value: CredentialsParser,
  enumerable: false,
  writable: false
}});

CredentialsParser.prototype.destroy = function(){
  this.password = null;
  this.name = null;
  this.zeroCnt = null;
  IdleParser.prototype.destroy.call(this);
};

CredentialsParser.prototype.execute = function(bufferItem){
  if (bufferItem === 0){
    this.zeroCnt++;
    //first zero - name
    if (this.zeroCnt === 1){
      this.name = this.bufferHandler.generateNextWord();
      console.log('EVO MI GA NAME',this.name,'LENGTH',this.name.length);
    }
    //second zero - password 
    if (this.zeroCnt === 2){
      this.password = this.bufferHandler.generateNextWord();
      console.log('EVO MI GA PASS',this.password,'LENGTH',this.password.length);
    }
  }
};

CredentialsParser.prototype.getName = function(){
  return this.name;
};

CredentialsParser.prototype.getPassword = function(){
  return this.password;
};

CredentialsParser.prototype.getZeroCnt = function(){
  return this.zeroCnt;
};

function SessionParser(){
  this.secret = new Buffer(16);
  IdleParser.call(this);
}

SessionParser.prototype = Object.create(IdleParser.prototype, {constructor:{
  value: SessionParser,
  enumerable: false,
  writable: false
}});

SessionParser.prototype.destroy = function(){
  this.secret = null;
  IdleParser.prototype.destroy.call(this);
};

SessionParser.prototype.execute = function(bufferItem){
  console.log('DO SAD JE PROCITANO',this.bufferHandler.getLastWrittenIndex(),'bajta');
  if (this.doneReading()){
    console.log('KOJI BAJT CITAM??',bufferItem);
    this.secret = this.bufferHandler.getBuffer().slice(0,16);
    console.log('PROCITANO 16 BAJTA, dobijen ovaj secret :',this.secret);
  }
};

SessionParser.prototype.doneReading = function(){
  return this.bufferHandler.getLastWrittenIndex() === 16;
};

SessionParser.prototype.getSecret = function(){
  return this.secret;
};

function RequestParser(methods){
  this.operationName = '';
  this.reqArguments = [];
  this.zeroCnt = 0;
  this.requiredZeros = 1; //dynamically changing according to the number of operation params
  this.methods = methods;
  this.byteWorker = new MethodByteWorker();
  IdleParser.call(this);
}

RequestParser.prototype = Object.create(IdleParser.prototype, {constructor:{
  value: RequestParser,
  enumerable: false,
  writable: false
}});

RequestParser.prototype.destroy = function(){
  console.log('((((( REQUEST PARSER SE UBIJA )))))');
  if (!!this.byteWorker){
    this.byteWorker.destroy();
  }
  this.byteWorker = null;
  this.methods = null;
  this.requiredZeros = null;
  this.zeroCnt = null;
  this.reqArguments = null;
  this.operationName = null; 
  IdleParser.prototype.destroy.call(this);
};

RequestParser.prototype.argumentByteWorkerFactory = function(operationName){
  var ctor = null;
  switch (operationName){
    case 'startFixInitiator':
      ctor = StringByteWorker;
      break;
    case 'sendFixMsg':
      ctor = FixMsgByteWorker;
      break;
  };
  if (!ctor){
    throw new Error('Server does not implement ' + operationName + ' method');
  }
  return new ctor;
};

RequestParser.prototype.execute = function(bufferItem){
  this.byteWorker.eatByte(bufferItem,this);
};

RequestParser.prototype.getOperationName = function(){
  return this.operationName;
};

RequestParser.prototype.getReqArguments = function(){
  return this.reqArguments;
};

RequestParser.prototype.zeroCntEqualsRequiredZeros = function(){
  return this.zeroCnt === this.requiredZeros;
};

RequestParser.prototype.callMethod = function(tcpFixServer){
  console.log('FINISHED reading arguments for',this.operationName,'method. Calling it...',this.reqArguments);
  this.methods[this.operationName].call(tcpFixServer,this.reqArguments);
  this.byteWorker.destroy();
  this.byteWorker = new MethodByteWorker();
  this.zeroCnt = 0;
  this.requiredZeros = 1;
  this.reqArguments = [];
  this.operationName = '';
  this.bufferHandler.clearCache();
};

//Byte workers...

function ByteWorker(){
}

ByteWorker.prototype.destroy = function(){
};

ByteWorker.prototype.eatByte = function(bufferItem){
  throw new Error('eatByte is not implemented');
};

function MethodByteWorker(){
  ByteWorker.call(this);
}

MethodByteWorker.prototype = Object.create(ByteWorker.prototype, {constructor:{
  value: MethodByteWorker,
  enumerable: false,
  writable: false
}});

MethodByteWorker.prototype.destroy = function(){
  ByteWorker.prototype.destroy.call(this);
};

MethodByteWorker.prototype.eatByte = function(bufferItem,parser){
  if (bufferItem === 0){
    parser.zeroCnt++;
    parser.operationName = parser.bufferHandler.generateNextWord();
    if (parser.methods.hasOwnProperty(parser.operationName)){
      console.log('METHOD',parser.operationName,'exists and requires',parser.methods[parser.operationName].length,'params');
      parser.requiredZeros += parser.methods[parser.operationName].length;
      parser.byteWorker.destroy();
      parser.byteWorker = parser.argumentByteWorkerFactory(parser.operationName);
    }else{
      parser.requiredZeros = undefined;
      console.log('STA BRE',parser.operationName);
      throw new Error('Sever does not implement',parser.operationName,'method.');
    }
  }
};

function StringByteWorker(){
  ByteWorker.call(this);
}

StringByteWorker.prototype = Object.create(ByteWorker.prototype, {constructor:{
  value: StringByteWorker,
  enumerable: false,
  writable: false
}});

StringByteWorker.prototype.destroy = function(){
  ByteWorker.prototype.destroy.call(this);
};

StringByteWorker.prototype.eatByte = function(bufferItem,parser){
  if (bufferItem === 0){
    parser.zeroCnt++;
    var argument = parser.bufferHandler.generateNextWord();
    console.log('GENERISAO SAM OVU REC',argument);
    parser.reqArguments.push(argument);
    console.log('EVO SU TRENUTNI ARGUMENTI',parser.reqArguments);
  }
};

function FixMsgByteWorker(){
  this.byteWorker = new TagByteWorker();
  this.tag = null;
  this.value = null;
  this.fixmsg = new FIXMessage();
  this.zeroCnt = 0;
  this.fixTags = ['header','tags']; //TODO groups
  this.fixTagsCnt = 0;
  ByteWorker.call(this);
  console.log('NAPRAVLJEN FixMsgByteWorker!!!');
}

FixMsgByteWorker.prototype = Object.create(ByteWorker.prototype, {constructor:{
  value: FixMsgByteWorker,
  enumerable: false,
  writable: false
}});

FixMsgByteWorker.prototype.destroy = function(){
  console.log('((((( FixMsgByteWorker SE UBIJA )))))');
  this.fixTagsCnt = null;
  this.fixTags = null;
  this.zeroCnt = null
  this.fixmsg.destroy();
  this.fixmsg = null;
  this.value = null;
  this.tag = null;
  if (!!this.byteWorker){
    this.byteWorker.destroy();
  }
  this.byteWorker = null;
  ByteWorker.prototype.destroy.call(this);
};

FixMsgByteWorker.prototype.reset = function(){
  this.tag = '';
  this.value = '';
  this.fixmsg = new FIXMessage();
  this.zeroCnt = 0;
  this.fixTagsCnt = 0;
};

FixMsgByteWorker.prototype.eatByte = function(bufferItem,parser){
  this.byteWorker.eatByte(bufferItem,parser,this);
};

function TagByteWorker(){
  ByteWorker.call(this);
}

TagByteWorker.prototype = Object.create(ByteWorker.prototype, {constructor:{
  value: TagByteWorker,
  enumerable: false,
  writable: false
}});

TagByteWorker.prototype.destroy = function(){
  console.log('((((( TagByteWorker SE UBIJA )))))');
  ByteWorker.prototype.destroy.call(this);
};

TagByteWorker.prototype.eatByte = function(bufferItem,parser,parentByteWorker){
  if (bufferItem === 0){
    if (parentByteWorker.zeroCnt === 0){
      parentByteWorker.tag = parser.bufferHandler.generateNextWord();
      //TODO sanity check.. throw!
      if (!FIXMessage.fixTagRegexp.test(parentByteWorker.tag)){
        throw new Error('Invalid FIX message structure: tag value ' + parentByteWorker.tag + ' is incorrect');
      }
      console.log('TagByteWorker zavrsio posao i napravio',parentByteWorker.tag,'predaje stafetu ValueByteWorker');
      parentByteWorker.byteWorker.destroy();
      parentByteWorker.byteWorker = new ValueByteWorker(); 
    }else if (parentByteWorker.zeroCnt === 1){
      console.log('Procitao nulu za kraj fix taga!',parentByteWorker.fixTagsCnt,'prelazi se na sledeci tag',parentByteWorker.fixTagsCnt);
      parentByteWorker.zeroCnt++;
      parentByteWorker.fixTagsCnt++;
    }else if (parentByteWorker.zeroCnt === 2){
      console.log('Procitao nulu za kraj celog argumenta, prelazi se na sledeci');
      console.log('OVO CU DA GURNEM U ARGUMENTE',parentByteWorker.fixmsg);
      parser.reqArguments.push(parentByteWorker.fixmsg);
      parser.zeroCnt++;
      parser.byteWorker.reset(); 
    }
  }else{
    parentByteWorker.zeroCnt = 0;
  }
};

function ValueByteWorker(){
  ByteWorker.call(this);
}

ValueByteWorker.prototype = Object.create(ByteWorker.prototype, {constructor:{
  value: ValueByteWorker,
  enumerable: false,
  writable: false
}});

ValueByteWorker.prototype.destroy = function(){
  ByteWorker.prototype.destroy.call(this);
};

ValueByteWorker.prototype.eatByte = function(bufferItem,parser,parentByteWorker){
  if (bufferItem === 0){
    parentByteWorker.zeroCnt++;
    //TODO sanity check.. throw!
    parentByteWorker.value = parser.bufferHandler.generateNextWord();
    if (!parentByteWorker.value){
      throw new Error('Invalid FIX message structure: Empty values are not allowed!');
    }
    if (!parentByteWorker.fixmsg[parentByteWorker.fixTags[parentByteWorker.fixTagsCnt]]){
      throw new Error('Invalid FIX message structure: end of request expected, instead got tag/value - { ' + parentByteWorker.tag + ':' + parentByteWorker.value + ' } ');
    }
    parentByteWorker.fixmsg[parentByteWorker.fixTags[parentByteWorker.fixTagsCnt]][parentByteWorker.tag] = parentByteWorker.value;
    console.log('ValueByteWorker zavrsio posao i napravio',parentByteWorker.value,'prepusta stefetu TagByteWorker');
    console.log('=== Takodje je napravio ovo =',parentByteWorker.fixmsg);
    parentByteWorker.tag = '';
    parentByteWorker.value = '';
    parentByteWorker.byteWorker.destroy();
    parentByteWorker.byteWorker = new TagByteWorker(); 
  }
};

function FIXMessage(){
  this.header = {};
  this.tags = {};
  //TODO groups
};

FIXMessage.fixTagRegexp = /^[1-9][0-9]*$/;

FIXMessage.prototype.destroy = function(){
  this.tags = null;
  this.header = null;
};

module.exports = {
  CredentialsParser : CredentialsParser,
  SessionParser : SessionParser,
  RequestParser : RequestParser
};
