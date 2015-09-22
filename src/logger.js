'use strict';

var __LOG = false;

function log(string){
  if (!!__LOG){
    console.log(string);
  }
}

module.exports = {
  log : log
};
