# OSS Browser Plus

> **oss-browser-plus** is a maintained fork of [aliyun/oss-browser](https://github.com/aliyun/oss-browser). We keep the upstream git history and Apache-2.0 license, and build our own upgrade and optimization work on top of it.

The upstream project is a desktop client for Alibaba Cloud OSS built on an aging stack (Electron 1.x, AngularJS 1.x, Bootstrap 3, Gulp). This fork focuses on **modernizing the runtime, hardening credential security, rebuilding the UI/UX, and keeping a real test/release pipeline**.

## What has changed since the fork

### 1. Runtime and architecture modernization

- **Electron 45.3.2** (Chromium / Node runtime upgraded; win32-x64, darwin-x64 and linux-x64 release matrix).
- **Renderer rewritten in Vue 3 + Pinia + Vue Router**; the AngularJS runtime is completely removed from the renderer (CodeMirror 6 instead of CM5, dayjs instead of moment, inline SVG icons instead of Font Awesome 4, `qrcode-generator` + self-rendered SVG).
- **Main-process OSS capability de-Angularized and modularized**: the 2,125-line `oss2.js` was split into `node/capabilities/services/oss/{index,context,client,list,object,delete,copy,acl,multipart}.js`; the Angular stub and global `localStorage` shim were removed.
- **Request-scoped account context** (`node/lib/account-context.js`, AsyncLocalStorage) isolates credentials and request-payer state, including concurrent operations; transfer stores use an LRU map keyed without secrets.
- **No Node.js or raw IPC in the renderer**: all OSS / STS / RAM / mail / transfer / upgrade capabilities go through a `contextBridge` allowlist.

### 2. Credential and security hardening

- AK/SK stored with OS-level **safeStorage envelope encryption**, with lossless lazy migration from legacy plaintext data.
- Tighter CSP (`script-src 'self'`, no remote plugins), navigation / new-window / webview / permission interception.
- External URL probing moved to the main process; upgrade packages support manifest signature verification with explicit warnings when unsigned.
- Log redaction for AK/SK/token/password/cookie/authorization/Signature; download progress file names sanitized.

### 3. VS Code-style UI/UX

- **Dark+ / Light+ themes**, frameless window with a self-drawn title bar, status bar, command palette (Ctrl+Shift+P), breadcrumb address bar.
- **Login page**: left brand panel + right form card, semantic AK / authorization-token tabs, theme-aware contrast, 60-second login failure toast that supports text selection/copy and disappears when the input changes.
- **File list**: compact toolbar hierarchy, storage-class column, clear list/grid view icons, virtualized rows, 400 ms debounced auto-refresh after uploads.
- **Safer dialogs**: delete flow no longer hangs (plain objects over IPC, synchronous failures land on a closable result view); checkbox clicks no longer bubble into row selection.

### 4. Real-world account permissions

- Accounts that can only access **a single bucket / directory** can sign in even when `ListBuckets` is denied (`AccessDenied` / `Forbidden` are tolerated, other errors still fail).
- Accounts that can only access **one specific object** can use a full file path as the preset OSS path (`oss://bucket/dir/file.txt`); the file is resolved via HeadObject and shown without requiring `ListObjects`.

### 5. Build, size and release pipeline

- esbuild + electron-builder; pinned Node 24 in CI; `release.yml` builds all three platforms and publishes a GitHub Release from a `v*` tag.
- Size gates: renderer/asar minimization, locale trimming (zh-CN / en-US / ja), crc64 prebuild trimmed per platform, zip must stay within 110% of the previous release and dist under the fixed budget.
- CI enforces real gates: `pr-gate.yml` (read-only `lint:ci`, IPC allowlist, ava + Vitest, list-performance gate, build smoke) and the same gates in `release.yml` before packaging.

### 6. Test and quality baseline

- **ava 96** main-process tests + **Vitest 614 / 70 files** renderer & preload tests; **Playwright 28 cases (21 passed / 7 skipped without credentials)**.
- Coverage thresholds: statements 82 / lines 84 / branches 70 / functions 75.
- Guard scripts for IPC allowlist parity, line-count, console usage, Angular leftovers, and test-metric drift; all documented in [docs/metrics.md](docs/metrics.md).

## Known differences from upstream

- Legacy Angular routes are no longer served; the entry page CSP is `script-src 'self'`.
- QR codes embedded in share emails use an SVG data URL instead of canvas JPEG.
- The renderer has no direct Node.js access by design.

## Download

Latest release: **v2.0.0** — see [Releases](https://github.com/mengta/oss-browser-plus/releases) for win32-x64 / darwin-x64 / linux-x64 zip and macOS dmg. Full version history: [all-releases.md](all-releases.md).

## Development

```bash
# Node.js 24
npm ci
npm run build          # renderer/server bundles into dist/
npm test               # ava (main process)
npm run test:renderer  # Vitest (renderer + preload)
npm run test:coverage  # Vitest with coverage thresholds
npm run test:all       # ava + Vitest
npx playwright test    # E2E (credential-dependent cases are skipped)

# local Windows package
npm run build:full
npx electron-builder --win zip --x64 --publish never
```

## License and credits

[Apache License 2.0](LICENSE), inherited from the upstream [aliyun/oss-browser](https://github.com/aliyun/oss-browser). Thanks to the upstream authors and all contributors of the OSS ecosystem.