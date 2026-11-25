'use strict';

// mailer 单测（源 app/components/services/mailer.js，Vue3-P0-18 改造后形态）
// nodemailer 已下沉主进程：渲染层断言"经 mail.send 白名单透传 smtp 与 info，失败 reject + Toast"。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { unstubAll } from '../../../helpers/module-stubs.js';

const DEFAULT_SMTP = {
  from: 'sender@example.com',
  host: 'smtp.example.com',
  port: 465,
  secure: true,
};

function setupMailer(smtp) {
  const calls = { sends: [], toasts: [] };
  globalThis.window = {
    ossBrowser: {
      mail: {
        send(smtpConfig, info) {
          calls.sends.push({ smtp: smtpConfig, info });
          if (info && info.subject === '__FAIL__') {
            const err = new Error('send failed');
            err.code = 'SMTP_ERROR';
            return Promise.reject(err);
          }
          return Promise.resolve(true);
        },
      },
    },
  };

  const reg = stubAngular();
  reg.services.$q = {
    reject(reason) {
      return Promise.reject(reason);
    },
    when(value) {
      return Promise.resolve(value);
    },
    all(promises) {
      return Promise.all(promises);
    },
  };
  reg.services.settingsSvs = {
    mailSmtp: {
      get() {
        return smtp || DEFAULT_SMTP;
      },
    },
  };
  reg.services.Toast = {
    error(message) {
      calls.toasts.push(message);
    },
    success() {},
    warn() {},
    warning() {},
  };
  reg.load('app/components/services/mailer.js');
  const Mailer = reg.get('Mailer');
  return { Mailer, calls };
}

test.afterEach(() => {
  delete globalThis.window;
  unstubAll();
});

test('send 经白名单透传 smtp 配置与 info（to/subject/html）', async (t) => {
  const { Mailer, calls } = setupMailer();

  const info = { to: 'user@example.com', subject: '测试主题', html: '<b>hello</b>' };
  const result = await Mailer.send(info);

  t.is(result, true);
  t.is(calls.sends.length, 1);
  t.deepEqual(calls.sends[0].smtp, DEFAULT_SMTP);
  t.deepEqual(calls.sends[0].info, info);
});

test('send 缺 html 时原样透传 content 字段（回退在主进程执行）', async (t) => {
  const { Mailer, calls } = setupMailer();

  await Mailer.send({ to: 'user@example.com', subject: 's', content: 'plain-content' });

  t.is(calls.sends[0].info.html, undefined);
  t.is(calls.sends[0].info.content, 'plain-content');
});

test('send 失败时 reject 错误并弹出 Toast', async (t) => {
  const { Mailer, calls } = setupMailer();

  await t.throwsAsync(() => Mailer.send({ to: 'user@example.com', subject: '__FAIL__' }));
  t.is(calls.toasts.length, 1);
  t.true(calls.toasts[0].indexOf('SMTP_ERROR') >= 0);
});