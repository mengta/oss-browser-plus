# 测试说明

## 单元测试（ava 8）

```bash
npm test
```

- 入口白名单见 package.json `ava.files`：`test/import-config-parser.mjs` + `test/unit/**/*.test.mjs`
- 串行执行（`serial: true`，全局替身不并发互踩）
- 测试基建四件套：`test/helpers/`（angular-stub / env-stubs / module-stubs / crypto-legacy）

## E2E 测试（Playwright _electron）

```bash
npm run build && npx playwright test
```

详见 [e2e/README.md](e2e/README.md)（凭证注入方法、冒烟九项用例清单、半自动项人工步骤说明）。

> 原 spectron 用例（test/index.js）已由 Playwright 冒烟用例等价替换（替换而非删除，断言语义不变，git 历史可溯）。
