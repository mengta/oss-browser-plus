'use strict';

// formater 基线单测（源 app/components/filters/formater.js）
// moment 为真实依赖（P3-08 守护目标）；utilSvs/jobUtil/fileSvs/$sce 为替身 DI。

import test from 'ava';
import moment from 'moment';
import { stubAngular } from '../../../helpers/angular-stub.js';

global.moment = moment;

function loadFilters() {
  const reg = stubAngular();
  reg.services.utilSvs = {
    leftTime(ms) {
      return 'LEFT:' + ms;
    },
  };
  reg.services.jobUtil = {
    getStatusCls(s) {
      return 'cls-' + s;
    },
    getStatusLabel(s, isUp) {
      return 'label-' + s + (isUp ? '-up' : '-down');
    },
  };
  reg.services.fileSvs = {
    getFileType(item) {
      return item._fakeType;
    },
  };
  reg.services.$sce = {
    trustAsResourceUrl(val) {
      return 'TRUSTED:' + val;
    },
  };
  reg.load('app/components/filters/formater.js');
  return reg;
}

test('sub：短字符串原样返回，超长截断加省略号', (t) => {
  const f = loadFilters().getFilter('sub');

  t.is(f('abc', 5), 'abc');
  t.is(f('abcdef', 5), 'abcde...');
});

test('hideSecret：短串打码，长串保留首尾各 3 位', (t) => {
  const f = loadFilters().getFilter('hideSecret');

  t.is(f('abc'), '******');
  t.is(f('abcde'), '******');
  t.is(f('abcdefgh'), 'abc****fgh');
});

test('timeFormat：空值返回默认值，合法时间格式化为 YYYY-MM-DD HH:mm:ss', (t) => {
  const f = loadFilters().getFilter('timeFormat');

  t.is(f(null, '-'), '-');
  t.is(f('', '-'), '-');
  const d = new Date('2026-11-14T08:30:00');
  t.regex(f(d), /^2026-11-14 \d{2}:30:00$/);
});

test('elapse：负值返回 0，毫秒内带 ms，时分级拼接', (t) => {
  const f = loadFilters().getFilter('elapse');
  const st = 1000000;
  const et = st + 500;

  t.is(f(st, st - 1), 0);
  t.is(f(st, et), '500ms');
  t.is(f(st, st + 3700 * 1000), '1h1m40s');
});

test('sizeFormat：零值、单一单位与复合单位（ex 模式）', (t) => {
  const f = loadFilters().getFilter('sizeFormat');

  t.is(f(0), 0);
  t.is(f(null), '0');
  t.is(f(500), '500B');
  t.is(f(2048), '2KB');
  t.is(f(1024 * 1024 * 5), '5MB');
  t.is(f(1024 * 1024 * 1024 * 3), '3GB');
  t.is(f(1024 * 1024 * 1024 * 3 + 1024 * 1024 * 512), '3.5GB');
  t.is(f(1024 * 1024 * 1024 * 3 + 1024 * 512, true), '3G512K');
});

test('persent：finished 与零分母分支及百分比计算', (t) => {
  const f = loadFilters().getFilter('persent');

  t.is(f(0, 0, 'finished'), 100);
  t.is(f(0, 0), 0);
  t.is(f(1, 3), 33.33);
  t.is(f(1, 4), 25);
});

test('leftTimeFormat/statusCls/status 透传对应服务替身', (t) => {
  const reg = loadFilters();

  t.is(reg.getFilter('leftTimeFormat')(123), 'LEFT:123');
  t.is(reg.getFilter('statusCls')('running'), 'cls-running');
  t.is(reg.getFilter('status')('running', true), 'label-running-up');
  t.is(reg.getFilter('status')('failed'), 'label-failed-down');
});

test('trustAsResourceUrl 经 $sce 透传', (t) => {
  const f = loadFilters().getFilter('trustAsResourceUrl');

  t.is(f('https://example.com'), 'TRUSTED:https://example.com');
});

test('fileIcon：归档状态与各类型扩展名映射', (t) => {
  const f = loadFilters().getFilter('fileIcon');

  t.is(f({ storageClass: 'Archive', storageStatus: 2, _fakeType: { type: 'others', ext: ['txt'] } }),
    'hourglass-2 text-warning');
  t.is(f({ storageClass: 'Archive', storageStatus: 1, _fakeType: { type: 'others', ext: ['txt'] } }),
    'square');
  t.is(f({ _fakeType: { type: 'video', ext: ['mp4'] } }), 'file-video-o');
  t.is(f({ _fakeType: { type: 'audio', ext: ['mp3'] } }), 'file-audio-o');
  t.is(f({ _fakeType: { type: 'picture', ext: ['png'] } }), 'file-image-o');
  t.is(f({ _fakeType: { type: 'doc', ext: ['doc'] } }), 'file-word-o');
  t.is(f({ _fakeType: { type: 'doc', ext: ['pdf'] } }), 'file-pdf-o');
  t.is(f({ _fakeType: { type: 'doc', ext: ['ppt'] } }), 'file-powerpoint-o');
  t.is(f({ _fakeType: { type: 'doc', ext: ['xls'] } }), 'file-o');
  t.is(f({ _fakeType: { type: 'code', ext: ['js'] } }), 'file-text-o');
  t.is(f({ _fakeType: { type: 'others', ext: ['zip'] } }), 'file-zip-o');
  t.is(f({ _fakeType: { type: 'others', ext: ['exe'] } }), 'cog');
  t.is(f({ _fakeType: { type: 'others', ext: ['sh'] } }), 'terminal');
  t.is(f({ _fakeType: { type: 'others', ext: ['unknown'] } }), 'file-o');
  t.is(f({ _fakeType: { type: 'other-unknown' } }), 'file-o');
});