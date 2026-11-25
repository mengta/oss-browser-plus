'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const authStore = new AsyncLocalStorage();

function angularStub() {
  const registry = {};
  const rootScope = { bucketMap: {}, internalSupported: null };

  const q = {
    defer: function () {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise: promise, resolve: resolve, reject: reject, notify: function () {} };
    },
    all: function (promises) {
      return Promise.all(promises);
    },
    when: function (value) {
      return Promise.resolve(value);
    },
    reject: function (reason) {
      return Promise.reject(reason);
    },
  };

  const state = { go: function () {} };
  const toast = {
    error: function () {},
    success: function () {},
    info: function () {},
    warning: function () {},
  };
  const Const = { PRIVATE: 'private', PRIVATE_LINK: 'private-link' };
  const settings = { connectTimeout: 30000 };
  const authInfo = {
    get: function () {
      return authStore.getStore() || {};
    },
    save: function () {},
  };

  const deps = {
    $q: q,
    $rootScope: rootScope,
    $timeout: function (fn) {
      return setTimeout(fn, 0);
    },
    $state: state,
    Toast: toast,
    Const: Const,
    AuthInfo: authInfo,
    settingsSvs: settings,
  };

  const angular = {
    extend: Object.assign,
    forEach: function (obj, fn) {
      Object.keys(obj || {}).forEach(function (key) {
        fn(obj[key], key);
      });
    },
    copy: function (value) {
      return JSON.parse(JSON.stringify(value));
    },
    module: function () {
      const api = {
        factory: function (name, depsOrFn, fn) {
          let deps = [];
          let impl = fn;
          if (Array.isArray(depsOrFn)) {
            const list = depsOrFn.slice();
            impl = list.pop();
            deps = list;
          } else if (typeof depsOrFn === 'function') {
            impl = depsOrFn;
          }
          registry[name] = { deps: deps, impl: impl };
          return api;
        },
        service: function (name, depsOrFn, fn) {
          return api.factory(name, depsOrFn, fn);
        },
        directive: function () {
          return api;
        },
        config: function () {
          return api;
        },
        run: function () {
          return api;
        },
      };
      return api;
    },
  };

  function resolve(name) {
    if (deps[name]) return deps[name];
    const entry = registry[name];
    if (!entry) return undefined;
    const args = entry.deps.map(function (dep) {
      return resolve(dep);
    });
    return entry.impl.apply(null, args);
  }

  return { angular: angular, resolve: resolve, authStore: authStore };
}

module.exports = { angularStub };