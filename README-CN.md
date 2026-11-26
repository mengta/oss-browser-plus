# OSS Browser Plus

> 本仓库（**oss-browser-plus**）fork 自 [aliyun/oss-browser](https://github.com/aliyun/oss-browser)，保留上游的提交记录，并在其基础上进行二次开发。

## 本分支相对上游（aliyun/oss-browser）的主要优化

### 运行时与依赖升级

- Electron 升级至 45.3.2，Chromium / Node 运行时现代化。
- 清理 6 个零引用僵尸 devDependencies，去除 clipboard 双重声明；`npm audit` critical 级漏洞清零。

### 凭证安全

- AK / SK 改用系统级 safeStorage 信封加密存储，旧明文凭证惰性迁移（不丢失）。
- 下载进度文件名脱敏，避免敏感路径信息泄漏。

### 构建与发布链重建

- release.yml 重写：electron-builder + Node 24 钉版，发布矩阵收敛为 win64 / darwin / linux64（Electron 45 不再提供 ia32 二进制）。
- 内置 locales 裁剪（zh-CN / en-US / ja），安装包体积约减少 11 MB。
- CI 增加真实门禁：`.github/workflows/pr-gate.yml`（pull_request / push main）执行 `lint:ci`（只读、不带 `--fix`）、`verify-allowlist`、ava、Vitest，再做构建冒烟；`release.yml` 在打包前执行同一命令集（E2E 仅 win64）。
- `lint:ci` 覆盖 `app/**`、`test/**`、`main.js`、`server.js`、`build.mjs`、`gen.js`、`node/**`、`tools/**`；`.vue` 继承正确性规则子集。

### 工程化

- ESLint 9 flat config 自维护规则集，替代 @alicloud/eslint-config。
- husky 9 + lint-staged 17 pre-commit 门禁；cross-env 7.0.3 跨平台脚本。

### 测试保障

- 单元测试用例数与 passed/skipped 由 `tools/measure-tests.mjs` 生成并记录于 [docs/metrics.md](docs/metrics.md)（README 不再写死数字），`--check` 防止漂移。
- E2E 冒烟分级验证（smoke-01 … smoke-11）。

## 下载

前往 [Releases](https://github.com/mengta/oss-browser-plus/releases) 获取最新构建（v1.21.x），历史版本清单见 [all-releases.md](all-releases.md)。

## 许可

[Apache License 2.0](LICENSE)（继承上游）

### Vue 3 架构（1.21.0）

- 渲染层整体重写为 **Vue 3 + Pinia + Vue Router**，AngularJS 运行时已在**渲染层移除**；主进程能力域（`node/capabilities/services/{oss2,ram,sts}.js`）仍运行在 Angular stub 上，正按批次迁移（P6 收口）。
- 渲染世界无 Node、无原始 IPC；OSS/STS/RAM/邮件/传输/升级等能力统一经 `contextBridge` 白名单由主进程/preload 承载（`sandbox=false`）。
- 构建：Vue bundle 为 `dist/app.js`；CodeMirror 6 取代 CM5；dayjs 取代 moment；内联 SVG 图标取代 Font Awesome 4；二维码使用 `qrcode-generator` + 自研 SVG。
- 已知差异：入口页 CSP 为 `script-src 'self'`；分享邮件中的二维码为 SVG data URL；旧 Angular 路由不再提供。
### 登录体验

- 一键导入：登录页支持粘贴 JSON / XML / YAML / key:value 格式凭证，一步解析并回填表单。
- AK 历史：长内容省略号截断 + 悬停查看完整内容；「复制」将 AK 等 OSS 信息以 `key: value` 格式写入剪贴板。

