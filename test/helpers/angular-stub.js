'use strict';

// AngularJS 环境替身（R-11 边界：仅替身框架层，业务依赖用真实实现）
// 提供与 angular.module('web') 等价的注册表，支持 factory/filter/controller
// 数组式 DI 与 $inject 式注入，用于加载 AngularJS 源文件做纯逻辑单测。

const path = require('path');

function stubAngular() {
  const registry = {
    services: {},
    filters: {},
    controllers: {},
    angular: null,
  };

  function invokeInjectable(fnOrArray, extraLocals) {
    let fn = fnOrArray;
    let deps = [];
    if (Array.isArray(fnOrArray)) {
      deps = fnOrArray.slice(0, -1);
      fn = fnOrArray[fnOrArray.length - 1];
    }
    const args = deps.map((name) => {
      if (extraLocals && Object.prototype.hasOwnProperty.call(extraLocals, name)) {
        return extraLocals[name];
      }
      if (Object.prototype.hasOwnProperty.call(registry.services, name)) {
        return registry.services[name];
      }
      throw new Error(
        'angular-stub: 未知依赖注入 "' + name + '"，请在测试中提供替身'
      );
    });
    return fn.apply(null, args);
  }

  const moduleApi = {
    factory(name, fnOrArray) {
      registry.services[name] = invokeInjectable(fnOrArray);
      return moduleApi;
    },
    filter(name, fnOrArray) {
      registry.filters[name] = invokeInjectable(fnOrArray);
      return moduleApi;
    },
    controller(name, fnOrArray) {
      registry.controllers[name] = fnOrArray;
      return moduleApi;
    },
    directive() {
      return moduleApi;
    },
    config() {
      return moduleApi;
    },
    run() {
      return moduleApi;
    },
  };

  const angularGlobal = {
    module() {
      return moduleApi;
    },
    forEach(obj, fn) {
      if (Array.isArray(obj)) {
        obj.forEach((v, i) => fn(v, i));
        return obj;
      }
      Object.keys(obj || {}).forEach((k) => fn(obj[k], k));
      return obj;
    },
    isArray(arg) {
      return Array.isArray(arg);
    },
    isObject(arg) {
      return arg !== null && typeof arg === 'object';
    },
    extend(dst) {
      for (let i = 1; i < arguments.length; i++) {
        Object.assign(dst, arguments[i]);
      }
      return dst;
    },
    copy(src) {
      return JSON.parse(JSON.stringify(src));
    },
  };

  registry.angular = angularGlobal;
  registry.invoke = invokeInjectable;

  registry.load = function (sourcePath) {
    const abs = path.resolve(process.cwd(), sourcePath);
    delete require.cache[abs];
    // 挂载后保持：filter/controller 返回的函数体在测试调用期仍引用全局 angular
    global.angular = angularGlobal;
    require(abs);
    delete require.cache[abs];
    return registry;
  };

  registry.get = function (name) {
    return registry.services[name];
  };

  registry.getFilter = function (name) {
    return registry.filters[name];
  };

  registry.invokeController = function (name, locals) {
    const prevAngular = global.angular;
    global.angular = angularGlobal;
    try {
      return invokeInjectable(registry.controllers[name], locals);
    } finally {
      if (prevAngular === undefined) {
        delete global.angular;
      } else {
        global.angular = prevAngular;
      }
    }
  };

  return registry;
}

module.exports = { stubAngular };