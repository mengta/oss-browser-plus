angular.module('web').factory('AuthInfo', [
  '$q',
  'Const',
  'Cipher',
  'SecureStore',
  function($q, Const, Cipher, SecureStore) {
    var AUTH_INFO = Const.AUTH_INFO_KEY;
    var AUTH_HIS = Const.AUTH_HIS;
    var AUTH_KEEP = Const.AUTH_KEEP;

    return {
      get: function() {
        return get(AUTH_INFO);
      },
      save: function(obj) {
        save(AUTH_INFO, obj);
      },
      remove: function() {
        remove(AUTH_INFO);
      },
      saveToAuthInfo: saveToAuthInfo,

      remember: function(obj) {
        save(AUTH_KEEP, obj);
      },
      unremember: function() {
        remove(AUTH_KEEP);
      },
      getRemember: function() {
        return get(AUTH_KEEP);
      },

      listHistories: function() {
        return get(AUTH_HIS);
      },
      cleanHistories: function() {
        remove(AUTH_HIS);
      },
      removeFromHistories: removeFromHistories,
      addToHistories: addToHistories
    };

    function addToHistories(obj) {
      var arr = get(AUTH_HIS, []);

      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id == obj.id) {
          arr.splice(i, 1);
          i--;
        }
      }

      arr.unshift(obj);
      save(AUTH_HIS, arr, []);
    }
    function removeFromHistories(id) {
      var arr = get(AUTH_HIS, []);

      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id == id) {
          arr.splice(i, 1);
          i--;
        }
      }

      save(AUTH_HIS, arr, []);
    }

    function saveToAuthInfo(opt) {
      var obj = get(AUTH_INFO);

      for (var k in opt) { obj[k] = opt[k]; }

      save(AUTH_INFO, obj);
    }

    // /////////////////////////////
    function remove(key) {
      SecureStore.remove(key);
    }
    function get(key, defv) {
      // v1/v0 命中时 SecureStore.get 已同步完成惰性迁移写回（CS-02）
      var str = SecureStore.get(key, null);

      if (str) {
        try {
          return JSON.parse(str);
        } catch (e) {
          console.log(e, key);
        }
      }

      return defv || {};
    }
    function save(key, obj, defv) {
      delete obj.httpOptions;

      var str = JSON.stringify(obj || defv || {});

      // D-9：加密失败不落盘（修正存量 catch 分支明文落盘缺陷，5.2.3-1）
      if (!SecureStore.set(key, str)) {
        return;
      }
    }
  }
]);
