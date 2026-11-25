'use strict';

const { buildDomainApi } = require('./shared');

module.exports = buildDomainApi('sts', 30000);