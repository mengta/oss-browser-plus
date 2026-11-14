'use strict';

// mailer 单测（源 app/components/services/mailer.js，P4-02 改造后形态）
// nodemailer 以 module-stubs 注入替身；
// 断言 send() 的 opt 构造（from/to/subject/html||content）与 createTransport(smtp) 直传。
// 注：P4-02 升级后 createTransport(smtp) 直传（nodemailer-smtp-transport 已废弃移除），
// 替身断言同步为直传形态（升级后行为等价性验证）。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';
import { stubModule, unstubAll } from '../../../helpers/module-stubs.js';

function setupMailer(smtp) {
  const calls = { transports: [], mails: [] };
  stubModule('nodemailer', {
    createTransport(t) {
      calls.transports.push(t);
      return {
        sendMail(opt, cb) {
          calls.mails.push(opt);
          if (opt.subject === '__FAIL__') {
            cb(new Error('send failed'), null);
          } else {
            cb(null, { messageId: 'mid-1', accepted: opt.to });
          }
        },
      };
    },
  });

  const reg = stubAngular();
  reg.services.settingsSvs = {
    mailSmtp: {
      get() {
        return smtp || {
          from: 'sender@example.com',
          host: 'smtp.example.com',
          port: 465,
          secure: true,
        };
      },
    },
  };
  reg.load('app/components/services/mailer.js');
  const Mailer = reg.get('Mailer');
  return { Mailer, calls, cleanup: unstubAll };
}

test.afterEach(() => {
  unstubAll();
});

test('send 组装 from/to/subject/html 并以 createTransport(smtp) 直传创建 transport', async (t) => {
  const { Mailer, calls } = setupMailer();

  const info = await Mailer.send({
    to: 'user@example.com',
    subject: '测试主题',
    html: '<b>hello</b>',
  });

  t.is(calls.transports.length, 1);
  t.is(calls.transports[0].from, 'sender@example.com');
  t.is(calls.transports[0].host, 'smtp.example.com');
  t.is(calls.mails.length, 1);
  t.is(calls.mails[0].from, 'sender@example.com');
  t.is(calls.mails[0].to, 'user@example.com');
  t.is(calls.mails[0].subject, '测试主题');
  t.is(calls.mails[0].html, '<b>hello</b>');
  t.is(info.messageId, 'mid-1');
});

test('send 缺 html 时回退 content 字段', async (t) => {
  const { Mailer, calls } = setupMailer();

  await Mailer.send({
    to: 'u@example.com',
    subject: 's',
    content: 'plain content',
  });

  t.is(calls.mails[0].html, 'plain content');
});

test('send 失败时 reject 错误', async (t) => {
  const { Mailer } = setupMailer();

  const err = await t.throwsAsync(() =>
    Mailer.send({ to: 'u@example.com', subject: '__FAIL__' })
  );

  t.is(err.message, 'send failed');
});