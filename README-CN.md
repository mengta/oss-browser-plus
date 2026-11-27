# OSS Browser Plus

> **oss-browser-plus** fork 自 [aliyun/oss-browser](https://github.com/aliyun/oss-browser)，保留上游提交记录与 Apache-2.0 许可，并在其基础上持续进行升级与优化。

上游是一个基于陈旧技术栈（Electron 1.x / AngularJS 1.x / Bootstrap 3 / Gulp）的阿里云 OSS 桌面客户端。本分支的重点是：**运行时现代化、凭证安全加固、UI/UX 重建，以及可长期维护的测试与发布链路**。

## fork 之后做了什么

### 1. 运行时与架构现代化

- **Electron 升级至 45.3.2**（Chromium / Node 运行时更新；发布矩阵为 win32-x64 / darwin-x64 / linux-x64）。
- **渲染层整体重写为 Vue 3 + Pinia + Vue Router**，AngularJS 运行时已从渲染层彻底移除（CodeMirror 6 取代 CM5、dayjs 取代 moment、内联 SVG 图标取代 Font Awesome 4、二维码改为 `qrcode-generator` + 自研 SVG）。
- **主进程 OSS 能力去 Angular 并模块化**：原 2,125 行的 `oss2.js` 拆分为 `node/capabilities/services/oss/{index,context,client,list,object,delete,copy,acl,multipart}.js`，删除 angular-stub 与全局 `localStorage` 垫片。
- **请求级账号上下文**（`node/lib/account-context.js`，AsyncLocalStorage）隔离凭证与请求者付费状态，支持并发操作；传输侧改为不含 secret 的 LRU 缓存。
- **渲染层无 Node、无原始 IPC**：OSS / STS / RAM / 邮件 / 传输 / 升级能力统一经 `contextBridge` 白名单。

### 2. 凭证与安全加固

- AK / SK 使用系统级 **safeStorage 信封加密**存储，旧明文数据无损惰性迁移。
- 收紧 CSP（`script-src 'self'`、禁用远程插件），增加导航 / 新窗口 / webview / 权限拦截。
- 外网地址探测下沉主进程；升级包支持清单验签，无签名时显式告警。
- 日志对 AK/SK/token/password/cookie/authorization/Signature 脱敏；下载进度文件名脱敏。

### 3. VS Code 风格 UI/UX

- **Dark+ / Light+ 双主题**、无边框自绘标题栏、状态栏、命令面板（Ctrl+Shift+P）、面包屑地址栏。
- **登录页**：左侧品牌区 + 右侧表单卡片，AK / 授权码语义化切换；深色对比度治理；登录失败提示保留 60 秒，可选中复制，输入变化后自动消失。
- **文件列表**：更紧凑的工具栏层级、新增「存储类型」列、直观的列表/块视图图标、虚拟滚动；上传完成后 400ms 防抖自动刷新当前目录。
- **更稳的弹窗**：删除流程不再卡死（IPC 传纯对象，同步异常落到可关闭结果页）；复选框点击不再冒泡触发行选中。

### 4. 真实账号权限适配

- 只能访问**某个 Bucket / 目录**的账号：即使 `ListBuckets` 被拒（AccessDenied / Forbidden）也能登录，其他错误仍正常失败。
- 只能访问**单个文件**的账号：预设 OSS 路径填写完整文件地址（`oss://bucket/目录/文件.txt`），通过 HeadObject 直接展示该文件，不依赖 `ListObjects`。

### 5. 构建、体积与发布

- 构建改为 esbuild + electron-builder，CI 固定 Node 24；推送 `v*` tag 由 `release.yml` 构建三平台并发布 GitHub Release。
- 体积治理：渲染层/asar 收敛、locales 裁剪（zh-CN / en-US / ja）、crc64 预构建按平台裁剪；zip 不超过上一版 110%，dist 不超过固定预算。
- CI 执行真实门禁：`pr-gate.yml`（只读 `lint:ci`、IPC 白名单、ava + Vitest、列表性能、构建冒烟）与 `release.yml` 同一套门禁。

### 6. 测试与质量

- **ava 96**（主进程）+ **Vitest 614 / 70 文件**（渲染层与 preload）+ **Playwright 28 用例（无凭证时 21 passed / 7 skipped）**。
- 覆盖率门槛：statements 82 / lines 84 / branches 70 / functions 75。
- 内置 IPC 白名单对账、行数、console、Angular 残留、测试指标漂移等守护脚本；数据记录于 [docs/metrics.md](docs/metrics.md)。

## 与上游的已知差异

- 旧 Angular 路由不再提供；入口页 CSP 为 `script-src 'self'`。
- 分享邮件中的二维码使用 SVG data URL，而非 canvas JPEG。
- 渲染层按设计不再拥有直接 Node.js 访问能力。

## 下载

最新版本：**v2.0.0** — 见 [Releases](https://github.com/mengta/oss-browser-plus/releases)（win32-x64 / darwin-x64 / linux-x64 zip 与 macOS dmg）。历史版本见 [all-releases.md](all-releases.md)。

## 开发

```bash
# Node.js 24
npm ci
npm run build          # 构建渲染层/服务端 bundle 到 dist/
npm test               # ava（主进程）
npm run test:renderer  # Vitest（渲染层 + preload）
npm run test:coverage  # Vitest + 覆盖率门槛
npm run test:all       # ava + Vitest
npx playwright test    # E2E（依赖凭证的用例自动 skip）

# 本地 Windows 打包
npm run build:full
npx electron-builder --win zip --x64 --publish never
```

## 许可与致谢

[Apache License 2.0](LICENSE)，继承自上游 [aliyun/oss-browser](https://github.com/aliyun/oss-browser)。感谢上游作者与 OSS 生态的贡献者。