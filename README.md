# OSS Browser Plus

> This repository (**oss-browser-plus**) is forked from [aliyun/oss-browser](https://github.com/aliyun/oss-browser). The upstream commit history is kept, and our own changes are added on top of it.

## Key improvements over upstream (aliyun/oss-browser)

### Runtime & dependencies

- Electron upgraded to 45.3.2, modernizing the Chromium / Node runtime.
- Removed 6 unused zombie devDependencies and a duplicate clipboard declaration; `npm audit` critical vulnerabilities reduced to zero.

### Credential security

- AK / SK are now stored with OS-level safeStorage envelope encryption, with lossless lazy migration from legacy plaintext storage.
- Download progress file names are sanitized to avoid leaking sensitive path information.

### Build & release pipeline rebuild

- release.yml rewritten: electron-builder + pinned Node 24; the release matrix is narrowed to win64 / darwin / linux64 (Electron 45 no longer ships ia32 binaries).
- Built-in locales trimming (zh-CN / en-US / ja), reducing the package size by roughly 11 MB.
- CI now enforces lint and test gates.

### Engineering toolchain

- ESLint 9 flat config with a self-maintained rule set, replacing @alicloud/eslint-config.
- husky 9 + lint-staged 17 pre-commit gate; cross-env 7.0.3 for cross-platform scripts.

### Test coverage

- Unit tests grown from 148 to 246 all-green cases (new: 69 for the ossSvs2 service, 29 for the filesCtrl controller, plus legacy batches for credential security / download manager).
- Graded E2E smoke verification (7 passed / 6 skipped).

## Download

Grab the latest build from [Releases](https://github.com/mengta/oss-browser-plus/releases) (v1.21.x). For the full history, see [all-releases.md](all-releases.md).

## License

[Apache License 2.0](LICENSE) (inherited from upstream)

### Vue 3 architecture (1.21.0)

- The renderer has been rewritten in **Vue 3 + Pinia + Vue Router**; the AngularJS runtime was removed.
- Renderer has no Node.js or raw IPC access; all OSS/STS/RAM/mail/transfer/upgrade capabilities go through the `contextBridge` allowlist (hosted by main/preload, `sandbox=false`).
- Build: Vue bundle is `dist/app.js`; CodeMirror 6 replaces CM5; dayjs replaces moment; inline SVG icons replace Font Awesome 4; QR codes use `qrcode-generator` + self-rendered SVG.
- Known differences: entry page CSP is `script-src 'self'`; QR image in share emails is SVG data URL; legacy Angular routes are no longer served.
### Login experience

- One-click import: paste JSON / XML / YAML / key:value credentials to fill the form in one step.
- AK history: long values truncate with a hover tooltip; the Copy action writes `key: value` OSS credentials to clipboard.

