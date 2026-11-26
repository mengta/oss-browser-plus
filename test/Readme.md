# 测试说明

## 单元测试

### 主进程 / ossstore（ava 8）

```bash
npm test
```

- 入口白名单见 package.json `ava.files`：`test/import-config-parser.mjs` + `test/unit/**/*.test.mjs`
- 串行执行（`serial: true`，全局替身不并发互踩）
- 测试基建四件套：`test/helpers/`（angular-stub / env-stubs / module-stubs / crypto-legacy）

### 渲染层 + preload 能力层（vitest）

```bash
npm run test:renderer          # 全量（test/renderer + test/preload）
npx vitest run test/preload    # 仅 preload 能力层
npx vitest run -- -t "关键词"   # 按用例名过滤
```

- 运行环境 jsdom，入口 `test/renderer/**/*.test.js` 与 `test/preload/**/*.test.js`（见 `vitest.config.mjs`）
- 全局替身：`test/renderer/setup.js` 注入 `window.ossBrowser` 白名单桥（bootstrap / system / credentials / oss / transfer / upgrade ...）
- preload 套件（`test/preload/`）直接加载 `app/preload` 的 CommonJS 模块：
  - `helpers/preload-env.js` 通过 Node 模块缓存注入 `electron` 替身（`ipcRenderer` / `shell` / `webUtils` / `contextBridge`），
    并在每次加载前清空 `app/preload` 缓存，保证用例之间互不影响；
  - 覆盖 `invokeChannel` 信封/超时/错误映射、11 个能力域的入参校验、进度订阅、GCM 与 v1 兼容加解密、net-bridge 装配与降级。

### 覆盖率

```bash
npx vitest run --coverage --no-file-parallelism ^
  --coverage.include="app/**/*.{js,vue}" --coverage.reporter=text-summary
```

- 依赖 `@vitest/coverage-v8`（devDependencies）
- `--no-file-parallelism`：串行执行以消除 CPU 争用导致的定时/渲染抖动（CI 与本地一致）
- 当前基线（2026-11-26）：Statements 83.4% / Lines 85.44% / Branches 72.61% / Functions 76.85%
- 明细报告：`coverage/coverage-summary.json`（json-summary reporter）

## E2E 测试（Playwright _electron）

```bash
npm run build && npx playwright test
```

详见 [e2e/README.md](e2e/README.md)（凭证注入方法、冒烟用例清单、半自动项人工步骤说明）。

- 用例规模：14 个 spec / 24 个用例
- 无凭证时凭证依赖用例自动 skipped，套件退出码 0

> 原 spectron 用例（test/index.js）已由 Playwright 冒烟用例等价替换（替换而非删除，断言语义不变，git 历史可溯）。