'use strict';

// P5-01 E01：globalSetup——构建产物检查（design 2.2.2-2）
// dist/main.js 不存在时给出"先执行 npm run build"的明确失败信息

const fs = require('fs');
const path = require('path');

module.exports = function globalSetup() {
  const distMain = path.resolve(__dirname, '..', '..', '..', 'dist', 'main.js');
  if (!fs.existsSync(distMain)) {
    throw new Error(
      '[e2e] 构建产物缺失：dist/main.js 不存在——请先执行 `npm run build` 再运行 E2E'
    );
  }
};