var fs = require('fs'),
  Path = require('path');

var _global = {
	instance: null
};

(function () {
	function Checker() {
  }
  Checker.prototype.check = function (name, pass, cb) {
    fs.readFile(Path.join(__dirname, 'validcredentials.json'), this.onFile.bind(this, name, pass, cb));
  };
  Checker.prototype.onFile = function (name, pass, cb, err, content) {
    if (err) {
      console.error(err);
      cb(false);
      return;
    }
    try {
      var cs = JSON.parse(content);
      if (!(typeof cs === 'object' && cs instanceof Array)){
        console.error(cs, 'is not an Array');
        cb(false);
      }
      cb(cs.some(function(c) {
        return c && c.name === name && c.password === pass;
      }));
    } catch (e) {
      console.error(e.stack);
      console.error(e);
      cb(false);
    }
  };

  _global.instance = new Checker;
})();

module.exports = _global.instance;
