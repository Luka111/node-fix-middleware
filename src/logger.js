'use strict';

var __LOG = true;

function log(string){
  if (!!__LOG){
    console.log(string);
  }
}

module.exports = {
  log : log
};
