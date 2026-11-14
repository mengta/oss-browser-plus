'use strict';

// list-filter 基线单测（源 app/components/filters/list-filter.js）
// angular.forEach 以替身提供（angular-stub 内建）。

import test from 'ava';
import { stubAngular } from '../../../helpers/angular-stub.js';

function loadFilter() {
  const reg = stubAngular();
  reg.load('app/components/filters/list-filter.js');
  return reg.getFilter('listFilter');
}

test('空检索值时原样返回列表', (t) => {
  const f = loadFilter();
  const arr = [{ n: 'a' }, { n: 'b' }];

  t.is(f(arr, 'n', ''), arr);
  t.is(f(arr, 'n', undefined), arr);
});

test('字符串 keyFn 按字段包含过滤', (t) => {
  const f = loadFilter();
  const arr = [{ n: 'abc' }, { n: 'bcd' }, { n: 'cde' }];

  t.deepEqual(f(arr, 'n', 'b'), [{ n: 'abc' }, { n: 'bcd' }]);
});

test('函数 keyFn 按返回值包含过滤', (t) => {
  const f = loadFilter();
  const arr = [{ n: 'abc' }, { n: 'bcd' }];

  t.deepEqual(f(arr, (x) => x.n.toUpperCase(), 'AB'), [{ n: 'abc' }]);
});

test('非数组输入返回空数组', (t) => {
  const f = loadFilter();

  t.deepEqual(f(null, 'n', 'a'), []);
  t.deepEqual(f(undefined, 'n', 'x'), []);
});