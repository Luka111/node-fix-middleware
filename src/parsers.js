'use strict';

var Logger = require('./logger.js');

var BufferHandler = require('./bufferHandler.js');
var Checkers = require('./checkers.js');

function IdleParser(maxBufferLength){
  this.bufferHandler = new BufferHandler();
  if (!maxBufferLength) maxBufferLength = 1024; //default
  this.maxBufferLength = maxBufferLength;
  this.checkers = [new Checkers.LengthChecker(this.maxBufferLength)];
}

IdleParser.prototype.destroy = function(){
  this.maxBufferLength = null; //default
  if (!!this.bufferHandler){
    Logger.log('______ SPREMAM SE DA UNISTIM PARSERA, DO OVDE JE STIGO BUFHANDLER ' + this.bufferHandler.getLastWrittenIndex());
    this.bufferHandler.clearCache();
  }
  this.bufferHandler.destroy();
  this.bufferHandler = null;
};

IdleParser.prototype.execute = function(bufferItem){
  throw new Error('execute logic is not implemented!');
};

IdleParser.prototype.doCheck = function(args,checker){
  checker.check(args);
};

IdleParser.prototype.executeByte= function(bufferItem){
  this.bufferHandler.saveToCache(bufferItem);
  this.checkers.forEach(this.doCheck.bind(this,[bufferItem,this.bufferHandler.getLastWrittenIndex()]));
  this.execute(bufferItem);
};

function CredentialsParser(){
  IdleParser.call(this,128);
  this.zeroCnt = 0;
  this.name = '';
  this.password = '';
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
      Logger.log('EVO MI GA NAME ' + this.name + ' LENGTH ' + this.name.length);
    }
    //second zero - password 
    if (this.zeroCnt === 2){
      this.password = this.bufferHandler.generateNextWord();
      Logger.log('EVO MI GA PASS ' + this.password + ' LENGTH ' + this.password.length);
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
  Logger.log('DO SAD JE PROCITANO ' + this.bufferHandler.getLastWrittenIndex() + ' bajta');
  if (this.doneReading()){
    Logger.log('KOJI BAJT CITAM?? ' + bufferItem);
    this.secret = this.bufferHandler.getBuffer().slice(0,16);
    Logger.log('PROCITANO 16 BAJTA, dobijen ovaj secret : ' + this.secret);
  }
};

SessionParser.prototype.doneReading = function(){
  return this.bufferHandler.getLastWrittenIndex() === 16;
};

SessionParser.prototype.getSecret = function(){
  return this.secret;
};

function RequestParser(connectionHandler){ // Connection handler is needed for notifying client
  this.myConnectionHandler = connectionHandler;
  this.reset();
  IdleParser.call(this,2048);
}

RequestParser.prototype = Object.create(IdleParser.prototype, {constructor:{
  value: RequestParser,
  enumerable: false,
  writable: false
}});

//TODO check ALL destructors if they match constructor properties
RequestParser.prototype.destroy = function(){
  Logger.log('((((( REQUEST PARSER SE UBIJA )))))');
  if (!!this.byteWorker){
    this.byteWorker.destroy();
  }
  this.byteWorker = null;
  this.requiredZeros = null;
  this.zeroCnt = null;
  this.reqArguments = null;
  this.operationName = null; 
  this.myConnectionHandler = null;
  IdleParser.prototype.destroy.call(this);
};

RequestParser.prototype.reset = function(){
  this.zeroCnt = 0;
  this.requiredZeros = 1;
  this.reqArguments = [];
  this.operationName = '';
  if (!!this.byteWorker){
    this.byteWorker.destroy();
  }
  this.byteWorker = new MethodByteWorker();
  if (!!this.bufferHandler){
    Logger.log('______ SPREMAM SE DA RESETUJEM PARSERA, DO OVDE JE STIGO BUFHANDLER ' + this.bufferHandler.getLastWrittenIndex());
    this.bufferHandler.clearCache();
  }
};

RequestParser.prototype.argumentByteWorkerFactory = function(operationName){
  switch (operationName){
    case 'startFixInitiator':
      this.reqArguments.push(this.fixInitiatorSuccessfullyStarted.bind(this));
      return new StringByteWorker();
    case 'sendFixMsg':
      this.reqArguments.push(this.fixMsgSuccessfullySent.bind(this));
      return new TagValueByteWorker(FIXMessage);
  };
  throw new Error('Server does not implement ' + operationName + ' method');
};

RequestParser.prototype.fixMsgSuccessfullySent = function(){
  Logger.log('%%%%% FIX poruka je uspesno poslata i obavestavam clienta o tome!');
  this.myConnectionHandler.socketWriteResult('successfully_sent');
};

RequestParser.prototype.fixInitiatorSuccessfullyStarted = function(){
  Logger.log('%%%%% FIX initiator se startovao i obavestio clienta o tome!');
  this.myConnectionHandler.socketWriteResult('fix_initiator_started');
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

RequestParser.prototype.callMethod = function(){
  if (!!this.operationName){
    Logger.log('FINISHED reading arguments for ' + this.operationName + ' method. Calling it... ' + this.reqArguments);
    this.reqArguments.push(this.myConnectionHandler);
    this.myConnectionHandler.myTcpParent.callMethod(this.operationName,this.reqArguments);
  }
  this.reset();
};

//Application parser for TCP client

function ApplicationParser(connectionHandler){
  RequestParser.call(this,connectionHandler);
}

ApplicationParser.prototype = Object.create(RequestParser.prototype, {constructor:{
  value: ApplicationParser,
  enumerable: false,
  writable: false
}});

ApplicationParser.prototype.destroy = function(){
  Logger.log('((((( APPLICATION PARSER SE UBIJA )))))');
  this.firstChar = null;
  this.wordIndicator = null;
  this.error = null; 
  this.msg = null;
  RequestParser.prototype.destroy.call(this);
};

ApplicationParser.prototype.reset = function(){
  this.msg = '';
  this.error = '';
  this.wordIndicator = null;
  this.firstChar = true;
  RequestParser.prototype.reset.call(this);
};

//override
ApplicationParser.prototype.argumentByteWorkerFactory = function(operationName){
  switch (operationName){
    case 'acceptFixMsg':
      return new TagValueByteWorker(FIXMessage);
    case 'connectionEstablished':
      return new TagValueByteWorker(SessionIDMessage);
    case 'connectionClosed':
      return new TagValueByteWorker(SessionIDMessage);
  };
  throw new Error(operationName + ' method is not implemented!');
};

//override
ApplicationParser.prototype.execute = function(bufferItem){
  if (!!this.firstChar){
    this.firstChar = false;
    if (bufferItem === 114){ //if r (result) we expect return message 
      this.wordIndicator = 'msg';
      Logger.log('PROCITAO R, postavio wordIndicator na ' + this.wordIndicator);
      this.byteWorker = new NextWordByteWorker();
    }else if(bufferItem === 101){ //if e (error) we expect error message
      this.wordIndicator = 'error';
      Logger.log('PROCITAO E, postavio wordIndicator na ' + this.wordIndicator);
      this.byteWorker = new NextWordByteWorker();
    }else if(bufferItem === 111){ //if o (event) we expect fix message
      Logger.log('PROCITAO O, napravio MethodByteWorker');
      this.byteWorker = new MethodByteWorker();
      this.bufferHandler.skipByteOnNextWord();
    }else{
      //TODO error?
    }
  }else {
    this.byteWorker.eatByte(bufferItem,this);
  }
};

ApplicationParser.prototype.getReadZero = function(){
  return this.zeroCnt === this.requiredZeros;
};

ApplicationParser.prototype.getMsg = function(){
  return this.msg;
};

ApplicationParser.prototype.getError = function(){
  return this.error;
};

//override
ApplicationParser.prototype.fixInitiatorSuccessfullyStarted = function(){
  return; 
};


//Byte workers...

function ByteWorker(){
}

ByteWorker.prototype.destroy = function(){
};

ByteWorker.prototype.eatByte = function(bufferItem){
  throw new Error('eatByte is not implemented');
};

function NextWordByteWorker(){
  ByteWorker.call(this);
}

NextWordByteWorker.prototype = Object.create(ByteWorker.prototype, {constructor:{
  value: NextWordByteWorker,
  enumerable: false,
  writable: false
}});

NextWordByteWorker.prototype.destroy = function(){
  ByteWorker.prototype.destroy.call(this);
};

NextWordByteWorker.prototype.eatByte = function(bufferItem,parser){
  if (bufferItem === 0){
    parser[parser.wordIndicator] = parser.bufferHandler.generateNextWord().substring(1);
    parser.zeroCnt++;
  }
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
    if (parser.myConnectionHandler.myTcpParent.methods.isImplemented(parser.operationName)){
      Logger.log('METHOD ' + parser.operationName + ' exists and requires ' + parser.myConnectionHandler.myTcpParent.methods.getParamCnt(parser.operationName) + ' params');
      parser.requiredZeros += parser.myConnectionHandler.myTcpParent.methods.getParamCnt(parser.operationName);
      parser.byteWorker.destroy();
      parser.byteWorker = parser.argumentByteWorkerFactory(parser.operationName);
    }else{
      parser.requiredZeros = undefined;
      Logger.log('STA BRE ' + parser.operationName);
      throw new Error(parser.operationName + 'method is not implemented');
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
    Logger.log('GENERISAO SAM OVU REC ' + argument);
    parser.reqArguments.push(argument);
    Logger.log('EVO SU TRENUTNI ARGUMENTI ' + parser.reqArguments);
  }
};

function TagValueByteWorker(objForFillCtor){
  this.byteWorker = new TagByteWorker();
  this.tag = null;
  this.value = null;
  this.objForFillCtor = objForFillCtor;
  this.objForFill = new objForFillCtor;
  this.zeroCnt = 0;
  this.tagsCnt = 0;
  ByteWorker.call(this);
  Logger.log('NAPRAVLJEN TagValueByteWorker!!!');
}

TagValueByteWorker.prototype = Object.create(ByteWorker.prototype, {constructor:{
  value: TagValueByteWorker,
  enumerable: false,
  writable: false
}});

TagValueByteWorker.prototype.destroy = function(){
  this.tagsCnt = null;
  this.zeroCnt = null
  this.objForFill.destroy();
  this.objForFill = null;
  this.value = null;
  this.tag = null;
  if (!!this.byteWorker){
    this.byteWorker.destroy();
  }
  this.byteWorker = null;
  ByteWorker.prototype.destroy.call(this);
};

TagValueByteWorker.prototype.reset = function(){
  this.tag = '';
  this.value = '';
  this.objForFill = new this.objForFillCtor;
  this.zeroCnt = 0;
  this.tagsCnt = 0;
};

TagValueByteWorker.prototype.eatByte = function(bufferItem,parser){
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
  ByteWorker.prototype.destroy.call(this);
};

TagByteWorker.prototype.eatByte = function(bufferItem,parser,parentByteWorker){
  if (bufferItem === 0){
    if (parentByteWorker.zeroCnt === 0){
      parentByteWorker.tag = parser.bufferHandler.generateNextWord();
      //TODO sanity check.. throw!
      if (!parentByteWorker.objForFill.fixTagRegexp.test(parentByteWorker.tag)){
        //throw new Error('Invalid FIX message structure: tag value ' + parentByteWorker.tag + ' is incorrect');
        throw new Error('Invalid FIX message structure: tag is incorrect');
      }
      parentByteWorker.byteWorker.destroy();
      parentByteWorker.byteWorker = new ValueByteWorker(); 
    }else if (parentByteWorker.zeroCnt === 1){
      parentByteWorker.zeroCnt++;
      parentByteWorker.tagsCnt++;
    }else if (parentByteWorker.zeroCnt === 2){
      parser.reqArguments.push(parentByteWorker.objForFill);
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
    if (!parentByteWorker.objForFill[parentByteWorker.objForFill.tagsArray[parentByteWorker.tagsCnt]]){
      //throw new Error('Invalid FIX message structure: end of request expected, instead got tag/value - { ' + parentByteWorker.tag + ':' + parentByteWorker.value + ' } ');
      throw new Error('Invalid FIX message structure: end of request expected');
    }
    parentByteWorker.objForFill[parentByteWorker.objForFill.tagsArray[parentByteWorker.tagsCnt]][parentByteWorker.tag] = parentByteWorker.value;
    parentByteWorker.tag = '';
    parentByteWorker.value = '';
    parentByteWorker.byteWorker.destroy();
    parentByteWorker.byteWorker = new TagByteWorker(); 
  }
};

function FIXMessage(){
  this.reset();
  //TODO groups
};

FIXMessage.prototype.fixTagRegexp = /^[1-9][0-9]*$/;

FIXMessage.prototype.tagsArray = ['header','tags','trailer']; //TODO groups

FIXMessage.prototype.destroy = function(){
  this.tags = null;
  this.header = null;
  this.trailer = null;
};

FIXMessage.prototype.reset = function(){
  this.header = {};
  this.tags = {};
  this.trailer = {};
};

function SessionIDMessage(){
  this.reset();
  //TODO groups
};

SessionIDMessage.prototype.destroy = function(){
  this.SessionID = null;
};

SessionIDMessage.prototype.fixTagRegexp = /.*/; //TODO sanity check session id?

SessionIDMessage.prototype.tagsArray = ['SessionID']; //TODO groups

SessionIDMessage.prototype.reset = function(){
  this.SessionID = {};
};

module.exports = {
  CredentialsParser : CredentialsParser,
  SessionParser : SessionParser,
  RequestParser : RequestParser,
  ApplicationParser : ApplicationParser
};
