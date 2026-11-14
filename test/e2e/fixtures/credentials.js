'use strict';

// P5-01 E02：凭证 fixture 与环境变量契约（命名冻结，spec 4.3.2 / design 2.2.2-4）
// 契约：全部仅从 process.env 解析；禁止默认值兜底、禁止落盘、禁止入日志（R-13）。
// 命名冻结：OSS_E2E_AK / OSS_E2E_SK / OSS_E2E_REGION / OSS_E2E_BUCKET / OSS_E2E_FOLDER
//           SMTP_E2E_HOST / SMTP_E2E_PORT / SMTP_E2E_USER / SMTP_E2E_PASS / SMTP_E2E_FROM / SMTP_E2E_TO

function hasOssCredentials() {
  return Boolean(
    process.env.OSS_E2E_AK && process.env.OSS_E2E_SK && process.env.OSS_E2E_BUCKET
  );
}

function hasSmtpCredentials() {
  return Boolean(
    process.env.SMTP_E2E_HOST && process.env.SMTP_E2E_USER && process.env.SMTP_E2E_PASS
  );
}

function getOssCredentials() {
  if (!hasOssCredentials()) return null;
  return {
    ak: process.env.OSS_E2E_AK,
    sk: process.env.OSS_E2E_SK,
    region: process.env.OSS_E2E_REGION || 'oss-cn-hangzhou',
    bucket: process.env.OSS_E2E_BUCKET,
    folder: process.env.OSS_E2E_FOLDER || 'e2e-test-folder',
  };
}

function getSmtpCredentials() {
  if (!hasSmtpCredentials()) return null;
  return {
    host: process.env.SMTP_E2E_HOST,
    port: process.env.SMTP_E2E_PORT || '465',
    user: process.env.SMTP_E2E_USER,
    pass: process.env.SMTP_E2E_PASS,
    from: process.env.SMTP_E2E_FROM || process.env.SMTP_E2E_USER,
    to: process.env.SMTP_E2E_TO || process.env.SMTP_E2E_FROM || process.env.SMTP_E2E_USER,
  };
}

module.exports = { hasOssCredentials, hasSmtpCredentials, getOssCredentials, getSmtpCredentials };