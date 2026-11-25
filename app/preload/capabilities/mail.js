'use strict';

const { invokeChannel } = require('./shared');

const SMTP_TIMEOUT = 20000;

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function sendTest(smtp, to) {
  if (!smtp || typeof smtp !== 'object') throw codedError('INVALID_ARG', 'smtp is required');
  if (typeof to !== 'string' || !to) throw codedError('INVALID_ARG', 'to is required');
  return invokeChannel('mail:sendTest', [smtp, to], SMTP_TIMEOUT);
}

function send(smtp, info) {
  if (!smtp || typeof smtp !== 'object') throw codedError('INVALID_ARG', 'smtp is required');
  if (!info || typeof info !== 'object' || typeof info.to !== 'string' || !info.to) {
    throw codedError('INVALID_ARG', 'info.to is required');
  }
  return invokeChannel('mail:send', [smtp, info], SMTP_TIMEOUT);
}

function validateConfig(options) {
  const issues = [];
  const smtp = options || {};
  if (typeof smtp.host !== 'string' || !smtp.host) issues.push('host is required');
  const port = Number(smtp.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) issues.push('port is invalid');
  if (smtp.secure !== undefined && typeof smtp.secure !== 'boolean') issues.push('secure must be boolean');
  if (smtp.user !== undefined && typeof smtp.user !== 'string') issues.push('user must be a string');
  if (smtp.pass !== undefined && typeof smtp.pass !== 'string') issues.push('pass must be a string');
  return { valid: issues.length === 0, message: issues.join('; ') };
}

module.exports = { sendTest, send, validateConfig };