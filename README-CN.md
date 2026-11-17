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
- CI 增加 lint 与测试门禁。

### 工程化

- ESLint 9 flat config 自维护规则集，替代 @alicloud/eslint-config。
- husky 9 + lint-staged 17 pre-commit 门禁；cross-env 7.0.3 跨平台脚本。

### 测试保障

- 单元测试从 148 增至 246 用例全绿（新增 ossSvs2 服务 69 例、filesCtrl 控制器 29 例，及凭证安全 / 下载管理器等存量批次）。
- E2E 冒烟分级验证（7 passed / 6 skipped）。

## 下载

前往 [Releases](https://github.com/mengta/oss-browser-plus/releases) 获取最新构建（v1.20.x），历史版本清单见 [all-releases.md](all-releases.md)。

## 许可

[Apache License 2.0](LICENSE)（继承上游）
