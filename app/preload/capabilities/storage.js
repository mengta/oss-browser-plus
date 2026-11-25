'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const PROGRESS_PREFIXES = ['upprog_', 'downprog_'];
const FAVORITES_PREFIX = 'fav_';

function codedError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function baseDir() {
  return path.join(os.homedir(), '.oss-browser');
}

function ensureDir() {
  const dir = baseDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function assertBasename(name) {
  if (typeof name !== 'string' || !name) throw codedError('INVALID_ARG', 'name is required');
  if (name.indexOf('/') >= 0 || name.indexOf('\\') >= 0 || name.indexOf('..') >= 0) {
    throw codedError('INVALID_ARG', 'name must be a plain basename');
  }
  if (path.basename(name) !== name) throw codedError('INVALID_ARG', 'name must be a plain basename');
  return name;
}

function favoritesName(username) {
  if (typeof username !== 'string') throw codedError('INVALID_ARG', 'username must be a string');
  return assertBasename(FAVORITES_PREFIX + username + '.json');
}

function atomicWrite(file, content) {
  ensureDir();
  const temp = file + '.tmp';
  try {
    fs.writeFileSync(temp, content);
    fs.renameSync(temp, file);
  } catch (err) {
    try {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    } catch (cleanErr) {}
    throw codedError('IO', 'failed to write ' + path.basename(file));
  }
}

function readIfExists(file) {
  try {
    return { exists: true, content: fs.readFileSync(file, 'utf8') };
  } catch (err) {
    if (err && err.code === 'ENOENT') return { exists: false, content: '' };
    throw codedError('IO', 'failed to read ' + path.basename(file));
  }
}

function readProgress(name) {
  return readIfExists(path.join(baseDir(), assertBasename(name)));
}

function writeProgress(name, content) {
  if (typeof content !== 'string') throw codedError('INVALID_ARG', 'content must be a string');
  atomicWrite(path.join(baseDir(), assertBasename(name)), content);
  return true;
}

function listProgress(prefix) {
  if (PROGRESS_PREFIXES.indexOf(prefix) < 0) throw codedError('INVALID_ARG', 'invalid progress prefix');
  let entries;
  try {
    entries = fs.readdirSync(ensureDir());
  } catch (err) {
    throw codedError('IO', 'failed to list progress files');
  }
  return entries
    .filter((name) => name.indexOf(prefix) === 0 && name.slice(-5) === '.json')
    .sort();
}

function renameProgress(from, to) {
  const source = path.join(baseDir(), assertBasename(from));
  const target = path.join(baseDir(), assertBasename(to));
  if (!fs.existsSync(source)) return true;
  try {
    fs.renameSync(source, target);
  } catch (err) {
    throw codedError('IO', 'failed to rename progress file');
  }
  return true;
}

function readFavorites(username) {
  const file = path.join(baseDir(), favoritesName(username));
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return '';
    throw codedError('IO', 'failed to read favorites');
  }
}

function writeFavorites(username, content) {
  if (typeof content !== 'string') throw codedError('INVALID_ARG', 'content must be a string');
  atomicWrite(path.join(baseDir(), favoritesName(username)), content);
  return true;
}

module.exports = {
  readProgress,
  writeProgress,
  listProgress,
  renameProgress,
  readFavorites,
  writeFavorites,
};