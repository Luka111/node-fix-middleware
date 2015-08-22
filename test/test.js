var assert = require('assert');
var should = require('should');
var soapServer = require('../src/soapServer.js');
var soapClient = require('../src/soapClient.js');
var fixAcceptor = require('../src/fix/fixAcceptor.js');

describe('soapClient - creating', function(){

  it('should throw if no url provided', function(){
    (function(){
      var sc = new soapClient();
    }).should.throw('No url provided!');
  });

  it('should throw if url is no string', function(){
    (function(){
      var sc = new soapClient(1337);
    }).should.throw('url must be string!');
  });

});

describe('soapClient - method echo', function(){

  it('should throw if there is no argument provided', function(){
    (function(){
      var sc = new soapClient('/greatUrl');
      sc.echo();
    }).should.throw('Argument MUST be provided!');
  });

  it('should throw if argument is a string', function(){
    (function(){
      var sc = new soapClient('/greatUrl');
      sc.echo('this is not an object');
    }).should.throw('Provided argument MUST be an object');
  });

  it('should throw if argument is a number', function(){
    (function(){
      var sc = new soapClient('/greatUrl');
      sc.echo(1337);
    }).should.throw('Provided argument MUST be an object');
  });

});

describe('soapClient - method sendFixMsg', function(){

  it('should throw if there is no argument provided', function(){
    (function(){
      var sc = new soapClient('/greatUrl');
      sc.sendFixMsg();
    }).should.throw('Argument MUST be provided!');
  });

  it('should throw if argument is a string', function(){
    (function(){
      var sc = new soapClient('/greatUrl');
      sc.sendFixMsg('this is not an object');
    }).should.throw('Provided argument MUST be an object');
  });

  it('should throw if argument is a number', function(){
    (function(){
      var sc = new soapClient('/greatUrl');
      sc.sendFixMsg(1337);
    }).should.throw('Provided argument MUST be an object');
  });

  it('should throw if argument object does not have property header', function(){
    (function(){
      var sc = new soapClient('/greatUrl');
      sc.sendFixMsg({notHeader : 'smth'});
    }).should.throw('Argument object must have property header');
  });

});

describe('soapServer - creating', function(){

  it('should throw if no path provided', function(){
    (function(){
      var ss = new soapServer();
    }).should.throw('No path provided!');
  });

  it('should throw if path is no string', function(){
    (function(){
      var ss = new soapServer(1337);
    }).should.throw('Path must be string!');
  });

  it('should throw if no fileName provided', function(){
    (function(){
      var ss = new soapServer('smth');
    }).should.throw('No fileName provided!');
  });

  it('should throw if fileName is no string', function(){
    (function(){
      var ss = new soapServer('smth', {iAm : 'string'});
    }).should.throw('fileName must be string!');
  });

});
