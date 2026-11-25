'use strict';

const crypto = require('crypto');

function sha256Hex(text) {
  if (typeof text !== 'string') {
    const err = new Error('text must be a string');
    err.code = 'INVALID_ARG';
    throw err;
  }
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

module.exports = { sha256Hex };