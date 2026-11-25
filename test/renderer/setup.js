import { beforeEach } from 'vitest';
import { bootstrapFixture, ok, fail } from './fixtures/bootstrap.js';
import { authFixture } from './fixtures/auth.js';
import { filesFixture } from './fixtures/files.js';
import { tasksFixture } from './fixtures/tasks.js';
import { i18nFixture } from './fixtures/i18n.js';

function toHex(text) {
  return Array.from(String(text))
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex) {
  const parts = String(hex).match(/../g) || [];
  return parts.map((part) => String.fromCharCode(parseInt(part, 16))).join('');
}

export function installBridge() {
  const bridge = {
    bootstrap: {
      get: () => ok({ ...bootstrapFixture, locales: i18nFixture }),
      auth: () => authFixture,
    },
    system: {
      getStaticServerPort: () => Promise.resolve(ok(7123)),
      openExternal: () => Promise.resolve(ok(true)),
      showItemInFolder: () => Promise.resolve(ok(true)),
      openDevTools: () => Promise.resolve(ok(true)),
      refreshPage: () => Promise.resolve(ok(true)),
      installAndRestart: () => Promise.resolve(ok(true)),
      showOpenDialog: () => Promise.resolve(ok({ canceled: true, filePaths: [] })),
      clipboardReadText: () => Promise.resolve(ok('')),
      clipboardWriteText: () => Promise.resolve(ok(true)),
      readReleaseNotes: () => Promise.resolve(ok({ found: false, markdown: '' })),
      detectInternalEndpoint: () => Promise.resolve(ok({ internalSupported: false })),
      pathDirname: (p) => ok(String(p).replace(/[\\/][^\\/]*$/, '') || '.'),
      pathJoin: (parts) => ok(parts.join('/')),
      pathBasename: (p) => ok(String(p).split(/[\\/]/).pop()),
      pathRelative: () => ok(''),
    },
    credentials: {
      isAvailable: () => ok(!!globalThis.__testSafeStorage),
      protect: (plainB64) => ok('PROT|' + plainB64),
      release: (b64) => (String(b64).indexOf('PROT|') === 0 ? ok(String(b64).slice(5)) : ok(null)),
      aesGcmEncrypt: (keyB64, plainB64) =>
        globalThis.__testGcmFail ? fail('INTERNAL', 'gcm failed') : ok('GCM|' + plainB64),
      aesGcmDecrypt: (keyB64, cipherB64) =>
        String(cipherB64).indexOf('GCM|') === 0
          ? ok(String(cipherB64).slice(4))
          : fail('INTERNAL', 'bad cipher'),
      legacyCipher: (plain) => ok(toHex('V1:' + String(plain))),
      legacyDecipher: (encrypted) => {
        const text = fromHex(String(encrypted));
        if (text.indexOf('V1:') !== 0) {
          return fail('INTERNAL', 'bad legacy cipher');
        }
        return ok(text.slice(3));
      },
    },
    digest: {
      sha256Hex: (text) => ok(String(text || '').padEnd(64, '0').slice(0, 64)),
    },
    storage: {
      readProgress: () => Promise.resolve(ok({ exists: false, content: '' })),
      writeProgress: () => Promise.resolve(ok(true)),
      listProgress: () => Promise.resolve(ok([])),
      renameProgress: () => Promise.resolve(ok(true)),
      readFavorites: () => Promise.resolve(ok('[]')),
      writeFavorites: () => Promise.resolve(ok(true)),
    },
    oss: {
      listAllBuckets: () =>
        globalThis.__testOssFail
          ? Promise.resolve(fail('InvalidAccessKeyId', 'bad access key'))
          : Promise.resolve(ok(filesFixture.buckets)),
      listFiles: () => Promise.resolve(ok(filesFixture.objects)),
      listAllFiles: () => Promise.resolve(ok(filesFixture.objects)),
      parseOSSPath: (p) => ({ bucket: String(p || '').split('/')[2] || '', key: '' }),
    },
    sts: { assumeRole: () => Promise.resolve(fail('UNAVAILABLE', 'stub')) },
    ram: { listUsers: () => Promise.resolve(ok([])) },
    mail: {
      send: () => Promise.resolve(ok(true)),
      sendTest: () => Promise.resolve(ok(true)),
      validateConfig: () => ok({ valid: true, message: '' }),
    },
    transfer: {
      getTasks: () => Promise.resolve(ok(tasksFixture.tasks)),
      subscribe: () => 'sub-1',
      unsubscribe: () => Promise.resolve(ok(true)),
      createUpload: () => Promise.resolve(ok({ taskId: 'up-1' })),
      createDownload: () => Promise.resolve(ok({ taskId: 'down-1' })),
      pause: () => Promise.resolve(ok(true)),
      resume: () => Promise.resolve(ok(true)),
      cancel: () => Promise.resolve(ok(true)),
      clear: () => Promise.resolve(ok(true)),
      retry: () => Promise.resolve(ok({ taskId: 'up-2' })),
      clearFailed: () => Promise.resolve(ok(true)),
      errorDetail: () => Promise.resolve(ok({ ecCode: '', requestId: '', message: '' })),
    },
    upgrade: {
      check: () => Promise.resolve(ok({ hasNew: false })),
      download: () => Promise.resolve(ok(true)),
      install: () => Promise.resolve(ok(true)),
      subscribe: () => 'usub-1',
      unsubscribe: () => Promise.resolve(ok(true)),
    },
  };

  window.ossBrowser = bridge;
  return bridge;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
}

installBridge();

beforeEach(() => {
  installBridge();
});