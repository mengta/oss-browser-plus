// 等价 Angular subUserAKSvs + indexDBSvs（子账号 AK 本地保存，DB: subUserAkList v1）。
// 结构冻结：store subUserAK，keyPath AccessKeyId；save 为 upsert 语义。

const DBNAME = 'subUserAkList';
const DBVERSION = 1;
const STORENAME = 'subUserAK';
const INITSTORE = { subUserAK: { keyPath: 'AccessKeyId' } };

function open(name = DBNAME, version = DBVERSION, initStoreMap = INITSTORE) {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(name, version);

    request.onerror = (e) => {
      console.error(e.currentTarget.error && e.currentTarget.error.message);
      reject(e.currentTarget.error);
    };
    request.onsuccess = (e) => {
      resolve(e.target.result);
    };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (initStoreMap) {
        for (const storeName in initStoreMap) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(
              storeName,
              initStoreMap[storeName] || { keyPath: 'id', autoIncrement: true }
            );
          }
        }
      }
    };
  });
}

async function list() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORENAME, 'readwrite').objectStore(STORENAME);
    const cursor = store.openCursor();
    const data = [];

    cursor.onsuccess = (e) => {
      const result = e.target.result;
      if (result && result !== null) {
        data.push(result.value);
        result.continue();
      } else {
        resolve(data);
      }
    };
    cursor.onerror = (e) => {
      console.error(e.currentTarget.error && e.currentTarget.error.message);
      reject(e.currentTarget.error);
    };
  });
}

async function get(AccessKeyId) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORENAME, 'readwrite').objectStore(STORENAME);
    const request = store.get(AccessKeyId);

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => {
      console.error(e.currentTarget.error && e.currentTarget.error.message);
      reject(e.currentTarget.error);
    };
  });
}

async function save(data) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORENAME, 'readwrite').objectStore(STORENAME);
    const request = store.get(data.AccessKeyId);

    request.onsuccess = (e) => {
      const item = e.target.result;
      if (item) {
        Object.assign(item, data);
        store.put(item);
      } else {
        store.add(data);
      }
      resolve();
    };
    request.onerror = (e) => {
      console.error(e.currentTarget.error && e.currentTarget.error.message);
      reject(e.currentTarget.error);
    };
  });
}

async function del(AccessKeyId) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORENAME, 'readwrite').objectStore(STORENAME);
    const request = store.delete(AccessKeyId);

    request.onsuccess = () => resolve();
    request.onerror = (e) => {
      console.error(e.currentTarget.error && e.currentTarget.error.message);
      reject(e.currentTarget.error);
    };
  });
}

export const userAkStore = { open, list, get, save, del, DBNAME, DBVERSION, STORENAME, INITSTORE };