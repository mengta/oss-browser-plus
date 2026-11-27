# 批次优化度量（P1~P7）

> 由 `.codeartsdoer/specs/batch_optimization/{spec,design,tasks}.md` 驱动。
> 度量数字必须由脚本产生，禁止手工填写（spec 4.4.6 / 6.4）。

## 1. 批次执行前状态（T-P0-01）

采集时间：2026-11-26。工作区存在既有未提交改动，执行期间视为**既有基线**，只做增量修改：

- 已跟踪改动：70 项（`M`），含 `app/renderer/**` 大量组件、`all-releases.md`、`docs/vue3-rewrite-ledger.md` 等。
- 未跟踪：`.security/`、根 `app.js`(2,332,678 B)、`app/renderer/components/base/ThemePicker.vue`、`test/renderer/components/theme-picker.test.js`、`test/renderer/stores-files-navigate.test.js`、`test/unit/main/capabilities/dispatch-transfer-args.test.mjs`。
- 红线：**禁止** `git stash` / `git checkout --` / `git reset` / 自动提交（autocrlf 回滚事故）。

## 2. 体积门禁基线（T-P0-03 / T-P1-06）

| 指标 | 基线 | 改造后 | 阈值 | 结论 |
| --- | --- | --- | --- | --- |
| `dist` 总字节 | 39,318,412 | **18,817,214** | ≤ 48,447,897 | PASS |
| `dist/app.js` | 2,332,522 | **1,098,942**（minify） | ≤ 1,835,008 | PASS |
| `dist/node/crc64` | 34,248,074 | **1,073,333**（仅目标平台 + pure-js） | ≤ 3.3MB | PASS |
| 基线 zip（1.21.9-local-fixes-v6） | 146,848,237 B | 新 zip **145,431,774 B** | ≤ 161,533,060（110%） | PASS（ratio 0.9904） |
| asar 顶层 | — | 12 项 | ≥ 7 项 | PASS |
| 三核心 / testzip | — | 齐备 / OK | 必须 | PASS |

门禁命令：`npm run build:full` → `npm run gate:dist` → `npx electron-builder --win zip --x64 --publish never` → `node tools/gate-size.mjs --zip=build/oss-browser-1.21.9-win.zip --prev=releases/1.21.9-local-fixes-v6/oss-browser-1.21.9-win.zip --asar=build/win-unpacked/resources/app.asar`。

## 3. 用例统计（T-P2-08）

<!-- metrics:tests:start -->
| 套件 | passed | skipped | failed | total | 采集时间 |
| --- | --- | --- | --- | --- | --- |
| ava | 95 | 0 | 0 | 95 | 2026-11-27 14:53 |
| Vitest | 613 | 0 | 0 | 613 | 2026-11-27 14:53 |
| Playwright | 未采集 | 未采集 | 未采集 | 未采集 | 2026-11-27 14:53 |
<!-- metrics:tests:end -->

维护命令：`node tools/measure-tests.mjs --write` / `--check`（门禁 ⑬）。

**覆盖率（2026-11-26 完善单测后）**：命令 `npm run test:coverage`（`vitest run --coverage --no-file-parallelism`）。门槛：statements 82 / lines 84 / branches 70 / functions 75；实测 statements 84.05%、lines 86.05%、branches 73.12%、functions 77.47%（含 `app/**/*.{js,vue}`，排除 `app/renderer/main.js` 与 `app/preload/api-manifest.js`）。新增 `test/preload/` 8 文件覆盖 11 个 preload 能力域（invokeChannel 信封、TIMEOUT、storage 原子写、credentials GCM/v1、net-bridge 装配与降级），渲染层补 FilesPage 交互、sts/ram client、user-ak-store、file-actions、SubAddressBar、HomePage、登录页左右分栏与 tab 语义、列表页存储类型列与视图切换图标等。

**P6c（2026-11-27）**：`node/capabilities/services/oss2.js`（2125 行）拆分为 `services/oss/{index,context,client,list,object,delete,copy,acl,multipart}.js`（均 <500 行），移除 angular-stub 与 global.localStorage；`verify-no-angular` PASS（12 文件，白名单 0）；ava 95（新增 context-isolation 4、allowlist-parity 2，删除 angular-stub-settings 1）；USER_AGENT 在源码回退根 package.json、dist 读取 services/package.json（均含 1.21.14）。

> **已修复（2026-11-26）**：`test/renderer/transfer.test.js`（「渲染任务行…筛选与清空」）原在全量并行时偶发失败。根因：store 裸 `setTimeout`（100ms `checkStart`、`saveProgress`/`saveDownloadProgress` 防抖）跨用例未清理，叠加用例内 fake/real timer 切换。修复：store 新增 `schedule()/clearTimers()` 并在 `dispose()` 清理（含 `_saveTimer`/`_saveDownTimer`）；测试新增 `beforeEach vi.useRealTimers()` 与 `afterEach dispose()+vi.useRealTimers()`；`confirm` 断言改用 `vi.waitFor`。复验：单文件 **5/5**、全量 **3/3**（359 passed）稳定。

## 4. Lint 与静态门禁（T-P2-01 / T-P4-07 / T-P7a-10）

- `npm run lint:ci`（范围含 `app/**`、`test/**`、`main.js`、`server.js`、`build.mjs`、`gen.js`、`node/**`、`tools/**`）：**errors 0**；warnings **219**（低于 P2 基线 298，后续不得增加）。
- `node tools/count-console.mjs --fail-on-hit`：`console.log=0`（`node/lib/logger.js` 自身白名单）。
- `node tools/verify-line-count.mjs --check`：扫描 293 文件，超 500 行 12 个，全部在豁免清单（条目数 12 未增）。
- `node tools/verify-allowlist.mjs --require-all`：**PASS**（主进程通道 90 / manifest 登记 90；暴露方法 118）。
- `node tools/measure-list-perf.mjs --rows=1000 --gate`：rowCount **39**（1000 项窗口化）、firstPaint **88ms**、fps **162.7** → PASS。

### 4.1 规则覆盖偏离登记（显式、可追溯）

| 偏离 | 原因 | 补偿 |
| --- | --- | --- |
| Vue SFC 仅继承正确性规则子集（`no-undef`/`no-eval`/`no-debugger`/`no-unused-vars` 等），不套用纯格式规则 | 全量套用会产生 26 处纯风格 error，使门禁不可交付 | 正确性规则全覆盖；格式统一由 `npm run lint`（--fix）按需处理 |
| `node/crc64/**`、`node/ossstore/test/**` 豁免静态规则 | emscripten 生成代码与旧测试脚本 | 生成代码不入 dist（P1 已裁剪） |
| `no-console` 在 `main.js`/`node/**` 为 `warn` | 兼容既有调用点（已全部迁移到 logger） | `count-console` 门禁保证 `console.log=0` |

## 5. 功能不丢失基线（每批次收尾）

| 基线 | 结果 | 证据 |
| --- | --- | --- |
| AK 历史（截断/悬浮/复制 `key: value`/长度 1~1000） | 未改动 | 代码与测试未触碰 |
| 一键导入（JSON/XML/YAML/kv） | 未改动 | `import-config-parser` 测试通过 |
| 未登录导航栏隐藏 | 保留 | 登录路由与 TopBar 未改 |
| 关于页（版本/logo/定制 about_html/发行说明） | **增强**：发行说明恢复 HTML 渲染 + 失败可关闭提示 | `about-fav.test.js` 9 例、`markdown.test.js` 8 例 |
| 文件列表（分页/目录置顶/shift/全选/块视图/缩略图/归档/操作列） | 保留，列表视图窗口化 | `files-pagination.test.js`、`use-virtual-rows.test.js` |
| 传输（上传/下载/暂停/续传/重试/进度） | 保留 + 订阅可解绑 | `transfer-dispose.test.js` |
| 对象操作（删除/复制/移动/重命名） | 未改动业务逻辑 | ava 全绿 |
| 权限（ACL/STS） | 未改动业务逻辑 | ava 全绿 |
| SMTP（测试/发送） | 未改动（nodemailer 未升级，见 §7） | ava 全绿 |
| 预览（FLV/图片/二维码） | FLV 页去除 jQuery，改原生 DOM 尺寸 API | `smoke-09` 探测目标改为 `/flv.js` |
| 定制（标题/logo/about_html/升级地址） | 保留；about_html 增加 sanitize（安全增强） | `about-fav.test.js` |
| 主题（深/浅/系统 + 持久化） | 保留 + 系统监听可解绑 | `ui-dispose.test.js` |
| 升级（检查/下载/拒绝/安装） | **增强**：清单验签 + 主进程路径/版本二次校验 | `upgrade-verify.test.mjs` 8 例 |

## 6. 已完成批次摘要

| 批次 | 结果 | 关键改动 |
| --- | --- | --- |
| P0 | 完成 | 基线登记、体积阈值核对、不可逆动作清单 |
| P2 | 完成 | `lint:ci`(no --fix) + `pr-gate.yml` + release 门禁；`import showdown` 恢复发行说明渲染；`measure-tests.mjs`；README/README-CN 纠偏；三语新增 key |
| P1 | 完成 | `build.mjs` 增 `--target`、crc64 按平台裁剪（tools/build-filters.mjs）、renderer minify、删 lib.js/lib.css/fonts/templates/aliyun-sdk-oss 复制链、`bootstrap-subset.css`、FLV 去 jQuery、`verify-dist-allowlist.mjs`/`gate-size.mjs` + 单测；**源死资产已删除**（`static/jquery.min.js`/`jquery.min.map`、`vendor/`、根 `app.js`、`.merkle-snapshot.json`） |
| P7a | 部分完成 | `package.json` 元数据 + gate scripts；patch/minor 依赖升级；删除 `OSS_BROWSER_VUE_ENTRY`；主题/传输订阅解绑 + 测试；行数/console 门禁工具；`aliyun-sdk` 单点 adapter；README 更新 |
| P4 | 完成 | `node/lib/{logger,redact,rate-limit}.js`、`static-server.js`（Promise 化端口）；main.js 日志/端口/IPC 错误/渲染层错误上报；`renderer-log.js` + 端口不可用提示；console 全量迁移（`console.log=0`） |
| P3 | 部分完成 | CSP 收紧（去 `https:`）+ `plugins:false` + 导航/新窗/webview/权限拦截；`app:probe-url` 下沉（CSP 收紧后地址探测不丢失）；凭证 `dek:d:` 不再新增 + 异步可用性预热；`upgrade-trust.js` 验签 + `safeInstall`；主进程 install/version/path 与 dialog 白名单 |
| P5 | 完成（块视图未窗口化） | `useVirtualRows.js` + `scroll-parent.js`；列表视图窗口化（行高 32px、spacer 守恒、行数据预计算）；`loadMore` 原地 push + 排序归并；`measure-list-perf --gate`（rowCount 39） |
| P6a/P6b/P6c | **未执行** | 见 §7 |
| P7b | **未执行** | 依赖 P6c |

## 7. 未完成项与偏离登记（诚实记录）

| 编号 | 项 | 状态 | 说明 |
| --- | --- | --- | --- |
| P6a/P6b/P6c | `sts.js`/`ram.js`/`oss2.js` 去 Angular 化与 `oss2.js` 拆 8 文件 | **未执行** | 改动面最大（2124 行 + dispatch/transfer 收尾），本会话未实施；行数豁免清单保留 `oss2.js`（batch P6c） |
| P7b | 移除 `aliyun-sdk` | **未执行** | 依赖 P6c；当前已建 `node/capabilities/sdk/aliyun-sdk-adapter.js` 单点收敛，等 6c 完成后可切换 |
| Q-1 | 升级签名密钥 | 待用户提供 | 已实现验签能力；未配置真实公钥时 `safeInstall=false` + `upgrade.verify_failed`（不静默放行） |
| Q-2 | 6d/6e（manifest/transfer/FilesPage 拆分） | 未纳入 | 已进行数豁免清单（长期） |
| Q-3 | nsis 安装包 | 未纳入 | 仅补元数据，`win.target` 保持 zip |
| Q-4 | nodemailer 6→10 | 未执行 | `npm audit` 显示 high 仅 10.6.1 可修复（major），QP 默认路径无可行补丁版本；登记为待确认 |
| Q-5 | 体积阈值 | 维持 | zip ≤110%、dist ≤48,447,897 B；实测远低于阈值 |
| Q-6 | 日志保留 | 已实现 | 7 天 / 5MB×5 / 脱敏 8 类字段（`logger-redact.test.mjs`） |
| Q-7 | 虚拟滚动行高 | **32px** | 与 design D-05 / smoke-12 一致（tasks 默认 28px 已按 design 定值） |
| 块视图窗口化 | T-P5-03 | 未执行 | 列表视图已窗口化；块视图保留全量渲染（登记阶段性偏离） |
| 删除源死资产 | T-P1-08/T-P7a-09 | **已完成**（2026-11-26 用户授权） | 已删 `static/jquery.min.js`、`static/jquery.min.map`、`vendor/`（2 文件）、根 `app.js`、`.merkle-snapshot.json`；删除前证据：全仓零引用（`DiffEditor.vue`/`oss2.js` 命中仅为注释与 UA 字符串）；删除后 `build:full`+`gate:dist`+`gate:size`+ava 84+Vitest 359 全绿 |
| `jquery` devDependency 遗留 | P7a-01 后续 | 未清理 | `package.json` 仍声明 `jquery ^3.7.1`，源码零 `import`/`require`（`$(` 零命中）；删除需动 lock，留待依赖批次一并处理 |
| E2E（smoke-01~15） | 已完成 | — | 2026-11-26 复跑 28 用例：21 passed / 7 skipped（无凭证按设计跳过）。`test/e2e/helpers/launch.js` 已用独立 `--user-data-dir` 绕开单实例锁并显式覆盖宿主残留 `ELECTRON_RUN_AS_NODE`；新增 smoke-15 登录页左右分栏/tab 语义/窄窗口折叠，smoke-06/13/14/15 等无凭证用例可在本机会话直接运行 |
| 跨世界 IPC 耗时、块视图 fps、mac/linux 实机 E2E | 不可测量 | — | 本机仅 win64 |

## 8. 回滚点清单（不自动执行）

`batch-p2-gate`、`batch-p1-volume`、`batch-p7a-deps`、`batch-p4-observability`、`batch-p3-security`、`batch-p5-virtual-list`（P6a/P6b/P6c/P7b 未产生）。

- 回滚不得使用 `git checkout --` 批量覆盖（autocrlf 事故）；提交/打 tag/发布由维护者执行。
- 回滚后复验：`npm run lint:ci` → `verify-allowlist` → `npm test` → `test:renderer` → `build:full` → `gate:dist` → `gate:size` → `gate:perf`。