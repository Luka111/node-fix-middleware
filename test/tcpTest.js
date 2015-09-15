var assert = require('assert');
var should = require('should');
var df = require('dateformat');

var tcpServer = require('../src/tcpTestServer.js');
var tcpClient = require('../src/tcpClient.js');
var fixAcceptor = require('../src/fix/fixAcceptor.js');

var settings = '[DEFAULT]\nReconnectInterval=60\nPersistMessages=Y\nFileStorePath=../data\nFileLogPath=../log\n\n[SESSION]\nConnectionType=initiator\nSenderCompID=NODEQUICKFIX\nTargetCompID=ELECTRONIFIE\nBeginString=FIX.4.4\nStartTime=00:00:00\nEndTime=23:59:59\nHeartBtInt=30\nSocketConnectPort=3223\nSocketConnectHost=localhost\nUseDataDictionary=Y\nDataDictionary=../node_modules/node-quickfix/quickfix/spec/FIX44.xml\nResetOnLogon=Y';

describe('tcpClient - creating', function(){

  it('should throw if no options provided', function(){
    (function(){
      var tc = new tcpClient();
    }).should.throw('No options provided!');
  });

  it('should throw if options is not an object - string', function(){
    (function(){
      var tc = new tcpClient('not object');
    }).should.throw('options must be object!');
  });

  it('should throw if no port property', function(){
    (function(){
      var tc = new tcpClient({notPort: 14000});
    }).should.throw('options must have property port');
  });

  it('should throw if no name provided', function(){
    (function(){
      var tc = new tcpClient({port: 14000});
    }).should.throw('No name provided!');
  });

  it('should throw if name is not a string - object', function(){
    (function(){
      var tc = new tcpClient({port: 14000},{name: 'Luka'});
    }).should.throw('name must be string!');
  });

  it('should throw if password is not a string - number', function(){
    (function(){
      var tc = new tcpClient({port: 14000},'Luka',1234);
    }).should.throw('password must be string!');
  });

  it('should throw if no settings provided', function(){
    (function(){
      var tc = new tcpClient({port: 14000},'Luka','1234');
    }).should.throw('No settings provided!');
  });

  it('should throw if settings is not a string - object', function(){
    (function(){
      var tc = new tcpClient({port: 14000},'Luka','1234',{settings:'something'});
    }).should.throw('settings must be string!');
  });

});

describe('tcpServer - starting', function(){
  
  var server = new tcpServer();

  it('should throw if no port provided', function(){
    (function(){
      server.start();
    }).should.throw('No port provided!');
  });

  it('should throw if port is not a number - string', function(){
    (function(){
      server.start('1234');
    }).should.throw('Port must be a number!');
  });

});

describe('fix Acceptor - starting', function(){
  
  var acceptor = new fixAcceptor();

  it('should throw if first param is not null or function - undefined', function(){
    (function(){
      acceptor.start(undefined);
    }).should.throw('start accepts function or null as the first param!');
  });

  it('should throw if first param is not null or function - number', function(){
    (function(){
      acceptor.start(123);
    }).should.throw('start accepts function or null as the first param!');
  });

  it('should throw if first param is not null or function - string', function(){
    (function(){
      acceptor.start('not_function');
    }).should.throw('start accepts function or null as the first param!');
  });

});

describe('Credentials', function(){
  
  function generate300CharsWord(){
    var ret = '';
    for (var i=0; i<300; i++){
      ret += 'a';
    }
    return ret;
  }

  var server = new tcpServer();
  server.start(14000);

  it('should throw if name is longer than 128 bytes', function(done){
    var error = new Error('Maximum length exceeded!');
    var recordedError = null;
    var originalExceptionListener = process.listeners('uncaughtException').pop();
    process.removeListener('uncaughtException', originalExceptionListener);
    process.once('uncaughtException',function(err){
      recordedError = err;
      should.equal(error.message,recordedError.message);
      process.listeners('uncaughtException').push(originalExceptionListener);
      done();
    });
    var name = generate300CharsWord();
    var client = new tcpClient({port:14000},name,'kp',settings);
  });

});

