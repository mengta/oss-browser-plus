angular.module('web').factory('Fav', [
  '$q',
  '$rootScope',
  'AuthInfo',
  'Toast',
  function($q, $rootScope, AuthInfo, Toast) {
    // Vue3-P0-17：收藏 I/O 改经 storage.favorites 白名单（异步持久化 + 内存缓存快照），
    // 对外保持同步读取语义（模板 isFav 不变）：启动即预热缓存，写操作乐观更新后异步落盘。
    var MAX = 100;
    var cache = null;

    function storage() {
      if (typeof window === 'undefined' || !window.ossBrowser) { return null; }
      return window.ossBrowser.storage || null;
    }

    function username() {
      return AuthInfo.get().id || '';
    }

    function digestTick() {
      try { $rootScope.$evalAsync(angular.noop); } catch (e) {}
    }

    function ensureCache() {
      if (cache !== null) { return; }
      cache = [];
      var s = storage();
      if (!s) { return; }
      s.readFavorites(username()).then(
        function(res) {
          if (res && res.ok && typeof res.data === 'string') {
            try { cache = JSON.parse(res.data || '[]'); } catch (e) { cache = []; }
          }
          digestTick();
        },
        function() { digestTick(); }
      );
    }

    ensureCache();

    return {
      add: add,
      list: list,
      remove: remove,
      has: has
    };

    function has(addr) {
      var arr = list();

      for (var i = 0; i < arr.length; i++) {
        if (arr[i].url == addr) {
          return true;
        }
      }

      return false;
    }

    function add(addr) {
      var arr = list();

      if (arr.length >= MAX) { return false; }

      for (var i = 0; i < arr.length; i++) {
        if (arr[i].url == addr) {
          arr.splice(i, 1);
          i--;
        }
      }

      arr.push({ url: addr, time: new Date().getTime() });

      if (arr.length > MAX) {
        arr.splice(MAX, arr.length - MAX);
      }

      cache = arr;
      save(arr);

      return true;
    }

    function remove(addr) {
      var arr = list();

      for (var i = 0; i < arr.length; i++) {
        if (arr[i].url == addr) {
          arr.splice(i, 1);
          i--;
        }
      }

      cache = arr;
      save(arr);
    }

    function save(arr) {
      var s = storage();
      if (!s) { return $q.when(false); }
      return s.writeFavorites(username(), JSON.stringify(arr)).then(
        function(res) { return !!(res && res.ok); },
        function() {
          Toast.error('保存书签失败');
          return false;
        }
      );
    }

    function list() {
      ensureCache();
      return cache ? cache.slice() : [];
    }
  }
]);