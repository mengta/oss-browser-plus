# oss-browser 依赖框架升级技术规划文档

> 文档版本：v1.0
> **编写日期**：2026-11-14
> **基线仓库**：oss-browser 1.19.2（package.json 实测值），git 基线提交 `e84c0f0`（"版本号升级到 1.19.2"），工作区干净
> **基线依赖栈摘要**：electron 1.8.4 / angular 1.5.8 / gulp ~3.5.5 / babel-core ^6.24.1 / ava ^0.20.0 / spectron ^3.7.2 / request ^2.83.0 / electron-packager 7.1.0 / engines.node 8.2.1
> **交付说明**：本文档为升级执行阶段的唯一执行依据，实际升级操作由后续执行按第 5 章任务清单进行；本文档编写周期内不执行任何升级动作。D1/D3/D5/D6 确认栏未经技术负责人签署前，第 4 章对应阶段门禁保持关闭，此为预期初始状态而非交付缺陷。

## 1. 基线盘点

### 1.1 基线摘要（实测）

| 项 | 实测值 | 备注 |
|---|---|---|
| package.json version | 1.19.2 | 与 design.md 记载的 1.19.1 存在漂移，以实测为准 |
| dependencies 数量 | 13 | |
| devDependencies 数量 | 44 | 与 design.md 记载的 39 项存在漂移，以实测为准 |
| 去重后包名总数 | 56 | clipboard 在两段重复声明，去重后计 1 行 |
| engines.node | 8.2.1 | |
| 实测环境 | Windows 11 + git-bash，Node v24.11.0，npm 11.6.1 | |

### 1.2 基线依赖表（56 包全量，版本范围为 package.json 原样字符串）

| 包名 | package.json 原样版本范围 | 所属段 |
|---|---|---|
| ali-oss | ^6.13.2 | dependencies |
| aliyun-sdk | ^1.12.3 | dependencies |
| clipboard | ^1.7.1 | dependencies + devDependencies（去重 1 行） |
| electron-log | 1.3.0 | dependencies |
| emoji-regex | ^9.0.0 | dependencies |
| koa | ^2.3.0 | dependencies |
| koa-convert | ^1.2.0 | dependencies |
| koa-static-server | ^1.2.1 | dependencies |
| mime | ^1.3.6 | dependencies |
| nodemailer | 4.0.1 | dependencies |
| nodemailer-smtp-transport | 2.7.4 | dependencies |
| platform | ^1.3.5 | dependencies |
| request | ^2.83.0 | dependencies |
| @alicloud/eslint-config | ^1.2.23 | devDependencies |
| angular | 1.5.8 | devDependencies |
| angular-bootstrap-contextmenu | ^1.1.0 | devDependencies |
| angular-sanitize | 1.5.8 | devDependencies |
| angular-ui-bootstrap | ^2.3.1 | devDependencies |
| angular-ui-codemirror | 0.3.0 | devDependencies |
| angular-ui-router | 0.2.18 | devDependencies |
| ava | ^0.20.0 | devDependencies |
| babel-core | ^6.24.1 | devDependencies |
| babel-eslint | ^10.1.0 | devDependencies |
| babel-preset-es2015 | ^6.24.1 | devDependencies |
| bootstrap | 3.3.6 | devDependencies |
| bower | ~1.7.9 | devDependencies |
| codemirror | ^5.19.0 | devDependencies |
| commander | ~2.9.0 | devDependencies |
| cross-env | ^3.1.4 | devDependencies |
| del | ^4.1.1 | devDependencies |
| electron | 1.8.4 | devDependencies |
| electron-packager | 7.1.0 | devDependencies |
| eslint | ^7.1.0 | devDependencies |
| font-awesome | ^4.7.0 | devDependencies |
| gulp | ~3.5.5 | devDependencies |
| gulp-angular-templatecache | ^1.1.0 | devDependencies |
| gulp-babel | ~6.1.2 | devDependencies |
| gulp-concat | ~2.1.7 | devDependencies |
| gulp-connect | ^1.0.7 | devDependencies |
| gulp-jshint | ~1.5.0 | devDependencies |
| gulp-load-plugins | ~0.4.0 | devDependencies |
| husky | ^4.2.3 | devDependencies |
| jquery | ^2.2.3 | devDependencies |
| jquery.qrcode | ^1.0.3 | devDependencies |
| karma | ^0.12.1 | devDependencies |
| karma-chrome-launcher | ^0.1.2 | devDependencies |
| karma-jasmine | ^0.1.5 | devDependencies |
| lint-staged | ^10.1.2 | devDependencies |
| minimist | ^1.2.0 | devDependencies |
| mocha | ~2.4.5 | devDependencies |
| moment | ^2.19.2 | devDependencies |
| npm-run-all | ^4.0.2 | devDependencies |
| shelljs | ~0.7.0 | devDependencies |
| should | ~9.0.0 | devDependencies |
| showdown | ^1.4.2 | devDependencies |
| spectron | ^3.7.2 | devDependencies |

### 1.3 关键文件盘点

| 文件 | 关键事实（行号为实测） |
|---|---|
| package.json | scripts 全量使用 POSIX 路径调用本地 bin（dev/dev:run/prod/watch/build 以 `./node_modules/.bin/` 开头）；test 脚本为 `ava test`；engines.node 8.2.1 |
| gulpfile.js | 16 个任务：js/templates/css/libJS/libCSS/copy-fonts/copy-icons/copy-node/copy-docs/copy-static/copy-index/gen-package/remove-redundant/watch/build/default；`--custom` 参数半废弃（getCustomPath 函数整体注释，CLI 参数保留但未被消费）；vendor 硬编码顺序 17 项（gulpfile.js:97-122）+ codemirror modes 经 `fs.readdirSync("./node_modules/codemirror/mode/")` 动态扫描（gulpfile.js:125-129）；gen-package 执行 `cd dist && yarn install --prod --ignore-engines && yarn autoclean --force`（gulpfile.js:213-216）；remove-redundant 删除 dist/node_modules/protobufjs/dist 与 dist/node_modules/aliyun-sdk/dist（gulpfile.js:220-225） |
| main.js | TLS 降级 3 处：main.js:6（`NODE_TLS_REJECT_UNAUTHORIZED=0`，位于 require electron 之后）、main.js:38（`ignore-certificate-errors` switch）、main.js:218-226（certificate-error 事件 `callback(true)` 放行）；IPC 4 消息（main.js:111-146）：getStaticServerPort/openDevTools/refreshPage/installRestart；makeSingleInstance（main.js:182）；darwin 菜单 selector 6 处（main.js:264-292：undo:/redo:/cut:/copy:/paste:/selectAll:）；webPreferences 仅 `plugins: true`（main.js:69-71）；静态服务端口 7123-7126（main.js:25-36）；installRestart asar 替换升级（main.js:125-144，`process.noAsar = true` + moveFile + `app.relaunch()`）；electron-log 双通道关闭（main.js:19-21） |
| Makefile | VERSION=1.19.0（与 package.json 1.19.2 不一致）；ELECTRON_VERSION=1.8.4 硬编码（Makefile:11）；打包目标 win64/win32/linux64/linux32/mac/dmg/asar/all；ELECTRON_MIRROR=npmmirror；`i` 目标使用 cnpm |
| app/index.html | 5 段 script 结构：app/index.html:10-23（require path/os/fs/request + custom 加载 + document.title）、:53-58（module 暂存 hack）、:59（lib.js）、:62-64（module 恢复）、:66-157（aliyun-sdk-oss.js + templates.js + 内联 ipcRenderer/shell/Global 对象）；:14 引入 request；Global.config_path 为 `~/.oss-browser` |
| test/index.js | spectron E2E，操作序列：启动→窗口断言→退出登录→切换中文→登录→list view→搜索 bucket→进入 bucket→上一级→block view→双击进入→地址栏→创建目录→删除目录→上传文件；依赖真实 Bucket 凭证（diku-debug-shanghai） |
| test/import-config-parser.js | ava 0.20 单测，212 行 15 用例，测试 app/main/auth/import-config-parser 模块 |
| karma-unit.js | 僵尸配置：引用 ./build/ 产物（实际构建输出在 dist/）与 app/**/*test.js；实测 `app/**/*test.js` 与 `app/**/*_test.js` 均为 0 个文件，无存量用例损失 |
| custom/index.js | 7 字段契约：title/appId/appName/logo_png/logo_ico/logo_ico/about_html（about_html 当前为注释态） |
| node/crc64 | 子目录：cpp-addon/（binding.gyp + crc64.cc + build.js + test）、electron-crc64-prebuild/（binding.gyp + src + build.js）、fork.js、index.js、pure-js/ |
| vendor/ | 3 个手工维护文件：aliyun-sdk-oss.js、angular-translate.min.js、diff_match_patch.js（独立于 npm 依赖树，构建时直接拷贝/拼接） |
| .gitignore | 已覆盖 node_modules/build/dist/releases/bower_components |

### 1.4 工具链死锁证据（实测，2026-11-14）

实测环境：Windows 11 + git-bash，Node v24.11.0，npm 11.6.1。

实测命令与输出原文：

```
$ node -v && npm run build
v24.11.0

> oss-browser@1.19.2 build
> ./node_modules/.bin/gulp build --custom=$custom

'.' 不是内部或外部命令，也不是可运行的程序或批处理文件。
```

结论：**死锁成立**，当前环境构建链路不可用。两层证据：

1. **npm scripts 层**：`build` 脚本使用 POSIX 风格路径 `./node_modules/.bin/gulp`，Windows cmd 下无法执行，报错原文 `'.' 不是内部或外部命令，也不是可运行的程序或批处理文件。`（dev/dev:run/prod/watch 脚本同构，均不可用）。
2. **依赖安装层**：node_modules 未安装（实测 0 个包），gulp ~3.5.5 无法运行。补充隔离实验（临时目录安装 gulp 3.9.1 后以 Node 24 运行）因安装中断未获得运行时输出；gulp 3 系（graceful-fs 3.x 依赖）在 Node 24 下的运行时报错形态留待 Phase 1 工具链现代化时以新工具链替代，不在本阶段补测。

### 1.5 git 基线信息

- 仓库状态：项目根目录已是可用 git 仓库（`git rev-parse --is-inside-work-tree` 输出 true），无需初始化。
- 基线提交：`e84c0f0`（"版本号升级到 1.19.2"），工作区干净（`git status --short` 无输出）。
- .gitignore 已覆盖 node_modules/build/dist/releases，满足文档全程回滚机制对 git 的依赖。

## 2. 升级目标与范围

### 2.1 升级目标

oss-browser 从陈旧依赖栈（electron 1.8.4 / angular 1.5.8 / gulp ~3.5.5 / babel 6 / node 8.2.1）升级至现代化技术栈，全程功能行为不变、三平台（Windows/macOS/Linux）可构建可运行、每阶段可验证可回滚。

### 2.2 范围排除项

以下内容不在本次升级范围内：

- UI 重设计与新功能开发
- 服务端 server.js/SMTP 功能架构重构（服务端仅随依赖升级保持可用，不做架构重构）
- CI/CD 流水线改造实施
- 应用签名、分发渠道、自动更新服务端建设
- app/ 业务代码深度重构（含 contextBridge 改造，列入第 11 章后续增强建议）
- AngularJS 迁移替代框架重写（路线 B，仅在第 3 章 D3 做对比论证，不实施）
- 依赖升级之外的打包运营细节

### 2.3 核心输入与外部信息源

- npm registry：全部目标版本查询（决策记录区 D1 与版本快照存档）
- Electron 官方文档：大版本迁移指南、安全配置清单（第 3 章 D1/D9）
- 阿里云 OSS 文档：ali-oss / aliyun-sdk SDK 兼容性说明（第 3 章 D10、风险 R-04）

## 3. 决策记录区

> 版本数据来源：`docs/upgrade-snapshots/npm-versions-20261114.txt`（npm registry 实测，查询日期 2026-11-14）。

### D1. Electron 目标版本

- **选型规则**：以执行时点 npm registry 最新稳定版为目标（排除 beta/alpha/rc tag），并通过 Electron 官方发布说明核对其维护状态（官方支持最新 3 个大版本）。
- **实测结果**：`npm view electron version` → **45.3.2**；`npm view electron dist-tags --json` 确认 `latest=45.3.2`（`beta=45.0.0-beta.7`、`alpha=46.0.0-alpha.10` 均排除）。查询日期：2026-11-14。
- **维护状态**：Electron 45 属官方维护窗口内最新大版本（官方支持 43/44/45 三个大版本）。
- **两步走升级规则**：先升至 Electron 官方迁移文档确定的最小可运行中间版本（验证 AngularJS 1.x + Bootstrap 3 渲染层兼容），再升至目标版本 45.3.2。禁止一步跳至目标版本后一次性验证。
- **决策确认栏**：

| 决策项 | 推荐结论 | 确认人 | 确认日期 | 备注 |
|---|---|---|---|---|
| D1 Electron 目标版本 | 45.3.2（两步走升级） | （待签） | （待签） | 未签署前 Phase 2 门禁保持关闭 |

### D2. engines.node 目标

- **结论**：`engines.node` 更新为 `">=22"`。
- **依据**：覆盖开发环境 Node 24.11.0 与目标 Electron 内置 Node 的交集。
- **对应校验规则**：Phase 2 执行时以目标 Electron 的 `process.versions.node` 实测核对；若目标 Electron 内置 Node 低于 22，则将 engines.node 下调至该实测值并写入本条目补充说明。

### D3. AngularJS 处理策略

- **对比表**（路线 A vs 路线 B）：

| 维度 | 路线 A：渐进保留（1.5.8 → 1.8.3） | 路线 B：迁移替代框架（React/Vue 重写） |
|---|---|---|
| 工作量 | 小：版本内升级，API 兼容（1.x 系列向后兼容） | 大：app/ 全部组件/服务/模板重写（约 124 个 JS 文件） |
| 风险 | 低：1.8.3 为 AngularJS 1.x 最终版，社区长期稳定 | 高：重写期间功能行为不变约束难以保证 |
| 收益 | 消除已知 CVE，保持现有功能与开发模式 | 现代化技术栈，长期可维护性 |

- **唯一推荐结论**：**路线 A 渐进保留**（angular 1.5.8 → 1.8.3，angular-sanitize 同步 1.8.3）。路线 B 列入第 11 章后续增强建议，本次不实施。
- **决策确认栏**：

| 决策项 | 推荐结论 | 确认人 | 确认日期 | 备注 |
|---|---|---|---|---|
| D3 AngularJS 策略 | 路线 A：渐进保留至 1.8.3 | （待签） | （待签） | 未签署前 Phase 3 门禁保持关闭 |

### D4. 构建工具链选型

- **结论**：esbuild（0.28.2，2026-11-14 实测）+ Node 原生构建脚本（`build.mjs`）替代 gulp ~3.5.5 全部 16 个任务。
- **不采用 gulp 5 理由**：gulp 3 任务定义与 gulp 4/5 的任务注册 API 不兼容（串行/并行声明方式变更），且 gulp-angular-templatecache、gulp-jshint 等插件长期停更；Node 原生脚本零构建期依赖、行为可判定。
- **不采用 Vite 理由**：本项目产物为文件拼接型（app.js/lib.js/templates.js + 静态资源拷贝），非 dev-server 型 SPA；Vite 的 ESM 模块化产物与 app/index.html 现有 5 段 script 结构、AngularJS 依赖注入风格不匹配，改造成本超出"功能行为不变"约束。
- **babel 6 系移除**：目标 Chromium（Electron 45 内置）原生支持 ES2020+，app/**/*.js 转译目标从 ES5 改为不转译（esbuild 仅做拼接，`target: esnext`）。
- **bower 移除**：bower 官方已停止维护；项目 bower_components 已在 .gitignore，实测无使用痕迹。
- **gen-package 改造**：dist 内依赖安装命令由 `yarn install --prod --ignore-engines && yarn autoclean --force` 改为 `npm install --omit=dev`。
- **vendor/ 机制保留**：3 个手工文件（aliyun-sdk-oss.js、angular-translate.min.js、diff_match_patch.js）纳入新构建脚本拷贝/拼接清单。

### D5. 测试框架选型

- **E2E**：spectron ^3.7.2（官方废弃）→ **Playwright `_electron`**（@playwright/test 1.65.1，2026-11-14 实测）。
- **单测**：ava ^0.20.0 → **ava 8.4.0**（2026-11-14 实测最新稳定版）；若 Phase 0 迁移时 8.x 与 test/import-config-parser.js 现有 15 用例存在 API 不兼容，降级目标为 ava 6.4.1（ava@6 最新，2026-11-14 实测）并在执行记录中写明降级理由。迁移后测试断言保持不变，`npm test` 在 Node 24 通过，作为 Phase 1-4 全程快速回归兜底。
- **karma 三件套废弃**（karma ^0.12.1 / karma-chrome-launcher ^0.1.2 / karma-jasmine ^0.1.5 + karma-unit.js）：实测 `app/**/*test.js` 与 `app/**/*_test.js` 均为 0 个文件，**无存量用例损失**；显式废弃并记录，禁止静默删除。
- **决策确认栏**：

| 决策项 | 推荐结论 | 确认人 | 确认日期 | 备注 |
|---|---|---|---|---|
| D5 测试选型 | E2E→Playwright 1.65.1；单测→ava 8.4.0（兜底 6.4.1） | （待签） | （待签） | 未签署前 Phase 5 门禁保持关闭 |

### D6. 打包工具选型

- **结论**：electron-packager 7.1.0 → **electron-builder 26.18.0**（2026-11-14 实测）；Makefile 打包目标名保持不变（win64/win32/linux64/linux32/mac/dmg）。
- **不采用 electron-forge 理由**：两者功能等价；electron-builder 的 extraResources/asarUnpack 为声明式配置，与 custom/ 目录原样拷入产物的需求映射直接；forge 的 maker 体系对现有 Makefile 目标名的等价改造量更大。
- **废弃 rcedit hack**：package.json 的 `rcedit` script 与 `cp tools/rcedit-x64.exe` 步骤随 electron-builder 内置 win 图标/版本信息处理一并移除。
- **ia32 目标评估**：Electron 官方自 Electron 4 起停止 Linux ia32 支持；win32-ia32 在新版 Electron 的支持状态于 Phase 5 执行时以 electron-builder 实测确认。若目标 Electron 45 不支持 ia32，则移除 win32/linux-ia32 打包目标并经人工确认后记录，禁止静默删除。
- **决策确认栏**：

| 决策项 | 推荐结论 | 确认人 | 确认日期 | 备注 |
|---|---|---|---|---|
| D6 打包选型 | electron-builder 26.18.0，Makefile 目标名不变 | （待签） | （待签） | 未签署前 Phase 5 门禁保持关闭 |
| D6-ia32 目标范围 | 待 Phase 5 实测确认后人工裁决 | （待签） | （待签） | 禁止静默删除 |

### D7. TLS 降级开关化

- **结论**：main.js 三处 TLS 降级收敛为环境变量 `OSS_BROWSER_ALLOW_INSECURE_TLS=1` 显式开关，**默认关闭**（默认走系统证书校验）。
- **三处改造点**：
  1. main.js:6 `NODE_TLS_REJECT_UNAUTHORIZED=0` → 按开关赋值；赋值时序保持在 `require("electron")` 之前（现状实测为 require 之后，改造时移至文件首行）。
  2. main.js:38 `app.commandLine.appendSwitch("ignore-certificate-errors")` → 按开关追加。
  3. main.js:218-226 `certificate-error` 事件 `callback(true)` 放行 → 按开关放行，关闭时走默认行为（阻止加载）。
- **审计要求**：开关开启时 electron-log 输出审计日志（记录开启来源与时间戳）。
- **场景说明**：Apsara Stack 私有化部署使用自签名证书，需要该开关保持可用；默认关闭满足公网场景安全收紧。

### D8. remote/IPC 改造映射

Electron 45 已移除 `remote` 模块（Electron 14 起废弃），五项改造映射表：

| # | 现状（实测位置） | 目标（Electron 45 API） |
|---|---|---|
| 1 | `require('electron').remote.dialog`（app/components/services/dialog.s.js:6，全仓唯一 remote 使用点；showUploadDialog/showDownloadDialog 两处回调式调用） | `ipcRenderer.invoke('dialog:show-open-dialog', options)` + 主进程 `ipcMain.handle('dialog:show-open-dialog')` 转调 `dialog.showOpenDialog(win, options)`；保持 `{canceled, filePaths}` 返回结构映射到原回调参数 `filePaths` |
| 2 | `app.makeSingleInstance(callback)`（main.js:182） | `app.requestSingleInstanceLock()` + `second-instance` 事件；行为等价：二次启动聚焦已有窗口 |
| 3 | darwin 菜单 `selector: "undo:"` 等 6 处（main.js:264-292） | 标准 `role`（undo/redo/cut/copy/paste/selectAll） |
| 4 | 单通道 `asynchronous`/`asynchronous-reply` 承载 4 消息（main.js:111-146） | 每消息一通道 invoke/handle（getStaticServerPort/openDevTools/refreshPage/installRestart 各自独立通道）；迁移后 `grep -rn "asynchronous-reply"` 确认零残留 |
| 5 | crc64 原生模块（node/crc64/cpp-addon 与 electron-crc64-prebuild，按 Electron 1.8.4 ABI 编译） | 评估 electron-crc64-prebuild 复用或 electron-rebuild 按新 ABI 重编；验证 crc64 校验值与升级前一致 |

### D9. webPreferences 过渡态声明

- **现状**（main.js:69-71）：仅 `plugins: true`；Electron 1.8.4 时代 nodeIntegration 默认开启。
- **目标（过渡态显式声明）**：`nodeIntegration: true`、`contextIsolation: false`、`sandbox: false`、`plugins: true`（保留并核对 PDF 行为）。
- **豁免理由**：渲染层直接依赖 Node API（app/index.html:10-23 require path/os/fs/request、:69 require electron；app/ 内 9+ 文件使用 Node API）；contextBridge 改造属 app/ 业务代码深度重构，列入第 11 章后续增强建议，本次保持功能行为不变。
- **安全核对表要求**：Phase 2 执行时逐项记录现状/目标/与 Electron 官方安全清单差异/豁免理由，形成书面核对表归档于执行记录区。

### D10. 废弃依赖处置原则

- **处置四值枚举**：`升级` / `替换` / `移除` / `保留`（"保留"必须附豁免理由）。
- **逐包处置结论**：见第 8 章废弃依赖处置对照表（56 包全量）。
- **原则摘要**（spec 点名废弃包）：
  - request → 替换为原生 fetch（目标 Chromium 内置）后从 package.json 移除
  - spectron → 替换为 @playwright/test
  - bower → 移除
  - gulp 3 系 / babel 6 系（babel-core、babel-preset-es2015、gulp-babel）→ 移除（构建链路由 esbuild 替代）
  - nodemailer-smtp-transport → 移除（nodemailer 6.x+ 直传 transport 配置）
  - moment → 升级 2.31.0 保留豁免（dayjs 替换列入第 11 章）
  - jquery 2.x → 升级 3.7.1（jquery@3 最新，2026-11-14 实测；4.0.0 为最新大版本但破坏面大，列入第 11 章）
  - bootstrap 3.x → 升级 3.4.1（3.x 最终维护版；ui-bootstrap 绑定 BS3 样式，5.x 不兼容，豁免保留 3.x 线）
  - font-awesome 4.x → 图标类名兼容核对后决定升级 @fortawesome/fontawesome-free 或豁免保留 4.7.0
  - karma-jasmine 0.1.x 等 karma 三件套 → 移除（无存量用例，见 D5）

> 未签署决策对应阶段门禁保持关闭：D1 未签署 → Phase 2 门禁关闭；D3 未签署 → Phase 3 门禁关闭；D5/D6 未签署 → Phase 5 门禁关闭。

## 4. 阶段总览与门禁

> 升级路径六阶段：P0 基线固化与测试兜底 → P1 构建工具链现代化 → P2 Electron 大版本升级 → P3 前端框架与 UI 库升级 → P4 运行时依赖现代化 → P5 测试重建与打包现代化。每阶段小节含门禁条款、goal、tasks、acceptance、rollback_point、risks、platform_plan 七要素。

### 4.1 P0 基线固化与测试兜底

> 本阶段前置门禁：首阶段默认放行，仅需基线核对通过（agent 按 10.1.5 动序核对仓库现状与第 1 章基线一致）。

- **goal**：固化基线快照与回归兜底，为后续阶段提供可验证起点。
- **tasks**：见 5.1 小节任务清单（P0-01 起）。
- **acceptance**（完成标准，编号 A1-A4）：
  - A1：`docs/upgrade-snapshots/P0/` 内 package.json 与 package-lock.json 存在，且与仓库根目录对应文件 `diff` 为空。
  - A2：`npm test` 退出码 0（ava 迁移后 test/import-config-parser.js 15 用例全部通过）。
  - A3：核心功能冒烟清单九项建立（与第 9 章共用同一份清单文本）。
  - A4：karma 三件套显式废弃记录写入文档（无存量用例损失结论）。
- **rollback_point**：`rollback/P0-baseline`
- **risks**：R-03
- **platform_plan**：Windows 全量验证（本阶段为文档与单测工作，无平台差异项）。

### 4.2 P1 构建工具链现代化

> 本阶段前置门禁：上一阶段完成标准编号 A1-A4 全部通过、其回滚点标签已存在。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

- **goal**：esbuild + Node 原生脚本替代 gulp 链路，产物布局与第 1 章基线逐文件一致。
- **tasks**：见 5.2 小节任务清单（P1-01 起）。
- **acceptance**（完成标准，编号 A1-A3）：
  - A1：`npm run build` 退出码 0，且 `ls dist` 产物清单与第 1 章基线逐文件比对一致。
  - A2：`npm run dev` 全链路可启动（build + watch + electron 启动）。
  - A3：package.json 无 gulp 3 系/gulp-* 插件/babel 6 系/bower 构建期依赖，`engines.node` 为 `">=22"`。
- **rollback_point**：`rollback/P1-toolchain`
- **risks**：R-03、R-08
- **platform_plan**：Windows 全量验证；macOS/Linux 于 P5 补验（构建脚本为 Node 原生实现，跨平台差异集中在路径与图标拷贝）。

### 4.3 P2 Electron 大版本升级

> 本阶段前置门禁：上一阶段完成标准编号 A1-A3 全部通过、其回滚点标签已存在，且 D1 确认栏已签署。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

- **goal**：Electron 1.8.4 → 45.3.2 两步走升级，remote/IPC/安全配置/TLS 开关改造完成，应用可启动可操作。
- **tasks**：见 5.3 小节任务清单（P2-01 起）。
- **acceptance**（完成标准，编号 A1-A4）：
  - A1：应用启动且主窗口加载 index.html，窗口标题与图标正常。
  - A2：`grep -rn "remote\." app/`、`grep -rn "asynchronous-reply"`、`grep -rn "makeSingleInstance"`、`grep -rn "selector:"` 四项零残留。
  - A3：crc64 校验值与升级前实测值一致。
  - A4：TLS 开关默认关闭时自签名证书被阻止；`OSS_BROWSER_ALLOW_INSECURE_TLS=1` 开启时可连接且 electron-log 输出审计日志。
- **rollback_point**：`rollback/P2-electron`
- **risks**：R-01、R-02、R-05、R-07、R-09
- **platform_plan**：Windows 全量验证；macOS/Linux 于 P5 补验（darwin 菜单改造项需 macOS 人工核验）。

### 4.4 P3 前端框架与 UI 库升级

> 本阶段前置门禁：上一阶段完成标准编号 A1-A4 全部通过、其回滚点标签已存在，且 D3 确认栏已签署。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

- **goal**：AngularJS 1.8.3 + UI 库兼容版升级，UI 行为与视觉不变。
- **tasks**：见 5.4 小节任务清单（P3-01 起）。
- **acceptance**（完成标准，编号 A1-A3）：
  - A1：`npm run build` 退出码 0 且应用启动正常。
  - A2：i18n 中文界面显示、release-notes 展示正常（绑定冒烟清单对应项）。
  - A3：右键菜单/模态框 UI 视觉回归抽查通过（绑定冒烟清单对应项）。
- **rollback_point**：`rollback/P3-frontend`
- **risks**：R-02、R-06
- **platform_plan**：Windows 全量验证；macOS/Linux 于 P5 补验。

### 4.5 P4 运行时依赖现代化

> 本阶段前置门禁：上一阶段完成标准编号 A1-A3 全部通过、其回滚点标签已存在。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

- **goal**：运行时依赖升级/替换/移除（request 出清、nodemailer 直传、mime 4.x 等），OSS 核心链路行为不变。
- **tasks**：见 5.5 小节任务清单（P4-01 起）。
- **acceptance**（完成标准，编号 A1-A4）：
  - A1：`npm audit --audit-level=critical` 无 critical 输出（high 级别附书面豁免理由）。
  - A2：request 从 package.json 移除且 `grep -rn "require('request')" app/ main.js` 零残留。
  - A3：SMTP 设置与邮件发送冒烟通过（绑定冒烟清单对应项）。
  - A4：上传/下载（含断点续传）冒烟通过（绑定冒烟清单对应项）。
- **rollback_point**：`rollback/P4-runtime`
- **risks**：R-04、R-05
- **platform_plan**：Windows 全量验证；macOS/Linux 于 P5 补验。

### 4.6 P5 测试重建与打包现代化

> 本阶段前置门禁：上一阶段完成标准编号 A1-A4 全部通过、其回滚点标签已存在，且 D5/D6 确认栏已签署。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

- **goal**：Playwright E2E 重建 + electron-builder 打包落地，三平台产物可构建可运行。
- **tasks**：见 5.6 小节任务清单（P5-01 起）。
- **acceptance**（完成标准，编号 A1-A4）：
  - A1：`npx playwright test` 通过（E2E 用例需真实 Bucket 凭证，标注后执行）。
  - A2：electron-builder 产出 Windows x64 安装包且应用启动冒烟通过。
  - A3：三平台验证记录回填（Windows 实测 + macOS/Linux 由开发者/测试人工执行并回填结果）。
  - A4：`npm audit` 无 critical 终验 + 全量冒烟九项回归收尾。
- **rollback_point**：`rollback/P5-packaging`
- **risks**：R-01、R-08
- **platform_plan**：Windows 实测；macOS/Linux 人工补验（本阶段为三平台覆盖收口点）。

## 5. 分阶段任务清单

> 任务条目格式见 10.1.4；agent 执行动序见 10.1.5。每阶段小节开头引用第 4 章对应门禁条款。验证命令基准环境：项目根目录 git-bash。

### 5.1 Phase 0 任务清单（基线固化与测试兜底）

> 本阶段前置门禁：首阶段默认放行，仅需基线核对通过（agent 按 10.1.5 动序核对仓库现状与第 1 章基线一致）。

- [ ] **P0-01** 基线依赖快照固化
  - **前置依赖**：无（本阶段首任务）
  - **执行步骤**：`mkdir -p docs/upgrade-snapshots/P0`；复制 `package.json` 与 `package-lock.json`（实测存在，15255 行）到该目录。
  - **验证命令**：`diff package.json docs/upgrade-snapshots/P0/package.json && diff package-lock.json docs/upgrade-snapshots/P0/package-lock.json && echo SNAPSHOT-OK`
  - **预期输出**：`SNAPSHOT-OK`（两个 diff 均无输出）
  - **失败处理**：快照缺失或不一致时重新复制后复跑；任务级回滚见 7.1 节。

- [ ] **P0-02** 工具链死锁证据记录
  - **前置依赖**：P0-01
  - **执行步骤**：核对 1.4 节死锁证据小节存在且含实测输出原文（文档 v1.0 已固化）；升级执行时复核该证据与仓库现状一致（node_modules 仍为空、scripts 仍为 POSIX 路径）。
  - **验证命令**：`grep -cF "'.' 不是内部或外部命令" docs/dependency-upgrade-plan.md`
  - **预期输出**：计数 ≥1（证据原文在文档中）
  - **失败处理**：证据缺失时重跑 `npm run build` 采集输出并补录 1.4 节。

- [ ] **P0-03** ava 单测迁移（ava 0.20 → 8.4.0，兜底 6.4.1）
  - **前置依赖**：P0-01
  - **执行步骤**：`npm install --save-dev ava@8.4.0`；运行 `npm test` 比对 test/import-config-parser.js 15 用例结果；若 8.x API 与现有用例不兼容（导入方式/断言签名变化）则降级 `npm install --save-dev ava@6.4.1` 并在执行记录写明降级理由；测试断言保持不变。
  - **验证命令**：`npm test`
  - **预期输出**：15 个用例全部通过，退出码 0（作为 Phase 1-4 全程快速回归兜底）
  - **失败处理**：8.x 与 6.x 均失败时标记 `[!]` 阻塞并输出失败用例清单，等待人工裁决。

- [ ] **P0-04** 核心功能冒烟清单建立
  - **前置依赖**：P0-01
  - **执行步骤**：将第 9 章冒烟九项清单与本阶段对齐（同一份文本）；每项附操作路径或自动化用例说明。
  - **验证命令**：`grep -c "断点续传" docs/dependency-upgrade-plan.md`
  - **预期输出**：计数 ≥2（第 5 章与第 9 章各至少 1 处）
  - **失败处理**：清单缺失项补齐后复跑。

- [ ] **P0-05** karma 僵尸测试处置核对
  - **前置依赖**：P0-01
  - **执行步骤**：执行 glob 核对 `app/**/*_test.js` 与 `app/**/*test.js` 均为空（实测 COUNT=0）；将"无存量用例损失 + 显式废弃 karma 三件套（karma/karma-chrome-launcher/karma-jasmine）与 karma-unit.js"结论写入执行记录；从 package.json 移除三件套并删除 karma-unit.js 文件。
  - **验证命令**：`ls app/**/*_test.js app/**/*test.js 2>/dev/null | wc -l`
  - **预期输出**：`0`
  - **失败处理**：发现存量用例文件时停止删除，标记 `[!]` 阻塞输出清单，等待人工裁决。

- [ ] **P0-06** spectron E2E 冻结声明
  - **前置依赖**：P0-01
  - **执行步骤**：保留 test/index.js 不改动（Phase 5 用 Playwright 重写）；在执行记录写入冻结声明（冻结期间不要求 spectron 用例通过，`npm test` 不包含 E2E 入口）；本任务验证命令不依赖真实 Bucket 凭证。
  - **验证命令**：`test -f test/index.js && grep -c "spectron" test/index.js`
  - **预期输出**：test/index.js 存在且 spectron 引用计数 ≥1（文件保留原状）
  - **失败处理**：文件缺失时从 git 基线恢复。

- [ ] **P0-07** 创建阶段回滚点与依赖快照
  - **前置依赖**：P0-01 至 P0-06 全部完成
  - **执行步骤**：按 7.4 节备份机制确认依赖快照在位；`git add -A && git commit -m "phase0: baseline and test fallback"`；创建标签 `rollback/P0-baseline`。
  - **验证命令**：`git tag -l "rollback/P0-baseline"`
  - **预期输出**：输出 `rollback/P0-baseline`
  - **失败处理**：标签创建失败时检查 git 状态后重试。

### 5.2 Phase 1 任务清单（构建工具链现代化）

> 本阶段前置门禁：上一阶段完成标准编号 A1-A4 全部通过、其回滚点标签已存在。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

- [ ] **P1-01** esbuild 构建脚本实现 app.js 产物
  - **前置依赖**：Phase 0 门禁通过
  - **执行步骤**：`npm install --save-dev esbuild@0.28.2`；新建 `build.mjs`：扫描 `app/**/*.js`（排除 `*_test.js`）拼接后经 esbuild transform（`target: esnext`，不输出 ES5）输出 `dist/app.js`。
  - **验证命令**：`npm run build && test -f dist/app.js && echo APPJS-OK`
  - **预期输出**：`APPJS-OK`
  - **失败处理**：构建报错时定位文件级语法错误修正后复跑。

- [ ] **P1-02** templates.js 产物生成
  - **前置依赖**：P1-01
  - **执行步骤**：build.mjs 扫描 `app/**/*.html`（排除 index.html），生成 $templateCache 等价模块 `dist/templates.js`（standalone 模块，模板 id 与 gulp-angular-templatecache 产物一致：app 相对路径 key）。
  - **验证命令**：`npm run build && grep -c "templateCache" dist/templates.js`
  - **预期输出**：计数 ≥1
  - **失败处理**：模板 id 不一致导致 ui-view 加载失败时，比对基线 templates.js 的 key 格式修正。

- [ ] **P1-03** lib.js vendor 拼接
  - **前置依赖**：P1-01
  - **执行步骤**：按 gulpfile.js:97-122 硬编码顺序拼接 vendor 清单（含 ./vendor/ 3 个手工文件：aliyun-sdk-oss.js、angular-translate.min.js、diff_match_patch.js）+ codemirror modes 经 `fs.readdirSync("./node_modules/codemirror/mode/")` 动态扫描等价复刻；输出 `dist/lib.js`。
  - **验证命令**：`npm run build && test -f dist/lib.js && echo LIBJS-OK`
  - **预期输出**：`LIBJS-OK`
  - **失败处理**：顺序错误导致 AngularJS 注入失败时对照 gulpfile.js 基线顺序修正。

- [ ] **P1-04** css 产物与字体图标拷贝
  - **前置依赖**：P1-01
  - **执行步骤**：拼接 `app/**/*.css` → `dist/app.css`；bootstrap/font-awesome/codemirror css → `dist/css/lib.css`；字体文件 → `dist/fonts`；`app/icons/**` → `dist/icons`（与 gulpfile libCSS/copy-fonts/copy-icons 任务等价）。
  - **验证命令**：`npm run build && ls dist/app.css dist/css/lib.css dist/fonts >/dev/null && echo CSS-OK`
  - **预期输出**：`CSS-OK`
  - **失败处理**：产物缺失对照 gulpfile 对应任务补齐。

- [ ] **P1-05** gen-package 等价改造
  - **前置依赖**：P1-01
  - **执行步骤**：dist 生成裁剪版 package.json（删除 devDependencies、`scripts={start: "electron ."}`、`main="main.js"`）；dist 内依赖安装命令改为 `npm install --omit=dev`（替代 `yarn install --prod --ignore-engines`）。
  - **验证命令**：`npm run build && node -e "const p=require('./dist/package.json');console.log(!p.devDependencies&&p.main==='main.js'?'GENPKG-OK':'GENPKG-FAIL')"`
  - **预期输出**：`GENPKG-OK`
  - **失败处理**：裁剪字段缺失对照 gulpfile gen-package 任务修正。

- [ ] **P1-06** remove-redundant 等价
  - **前置依赖**：P1-05
  - **执行步骤**：构建后删除 `dist/node_modules/protobufjs/dist` 与 `dist/node_modules/aliyun-sdk/dist`（与 gulpfile.js:220-225 等价）。
  - **验证命令**：`npm run build && test ! -d dist/node_modules/protobufjs/dist && test ! -d dist/node_modules/aliyun-sdk/dist && echo REDUNDANT-OK`
  - **预期输出**：`REDUNDANT-OK`
  - **失败处理**：目录存在时检查删除步骤执行顺序。

- [ ] **P1-07** watch/dev 等价复刻
  - **前置依赖**：P1-01 至 P1-06
  - **执行步骤**：build.mjs 实现 `fs.watch` 监听 `app/**/*`（js→app.js、html→templates.js、css→app.css、index.html/main.js→copy-index 等价）；package.json 的 dev 脚本保持 npm-run-all 并行 build/watch/dev:run 结构，全部 scripts 消除 `./node_modules/.bin/` POSIX 路径前缀（改用命令名，经 npm PATH 解析）。
  - **验证命令**：`npm run build && echo BUILD-OK`（dev 全链路启动为人工验证项，绑定冒烟清单）
  - **预期输出**：`BUILD-OK`
  - **失败处理**：watch 不触发时检查 fs.watch 路径过滤逻辑。

- [ ] **P1-08** package.json scripts 与构建期依赖清理
  - **前置依赖**：P1-01 至 P1-06
  - **执行步骤**：移除 devDependencies 中 gulp、gulp-angular-templatecache、gulp-babel、gulp-concat、gulp-connect、gulp-jshint、gulp-load-plugins、babel-core、babel-preset-es2015、bower、shelljs；`engines.node` 更新为 `">=22"`（D2）；scripts 中 gulp 调用全部替换。
  - **验证命令**：`node -e "const p=require('./package.json');const gone=['gulp','gulp-babel','babel-core','bower','shelljs'].every(n=>!p.devDependencies[n]);console.log(gone&&p.engines.node==='>=22'?'CLEANUP-OK':'CLEANUP-FAIL')"`
  - **预期输出**：`CLEANUP-OK`
  - **失败处理**：残留依赖逐项核对移除后复跑。

- [ ] **P1-09** Makefile 构建调用替换与 vendor 保留
  - **前置依赖**：P1-01 至 P1-06
  - **执行步骤**：Makefile 的 GULP 变量与 build/watch 目标内部命令替换为新构建脚本调用；copy-index 等价——`app/index.html`、`main.js`、`server.js`、`vendor/*.js`、`release-notes.md`、`tools/.yarnclean` 拷贝至 dist；vendor/ 3 个手工文件保留并纳入 build.mjs 拷贝清单。
  - **验证命令**：`npm run build && ls dist/aliyun-sdk-oss.js dist/main.js dist/server.js >/dev/null && echo VENDOR-OK`
  - **预期输出**：`VENDOR-OK`
  - **失败处理**：拷贝清单缺失对照 gulpfile copy-index 任务补齐。

- [ ] **P1-10** 产物布局契约逐文件核对
  - **前置依赖**：P1-01 至 P1-09
  - **执行步骤**：对照第 1 章基线盘点与 gulpfile build 任务产物清单，逐文件核对 dist 布局（main.js、index.html、app.js、lib.js、templates.js、app.css、css/lib.css、fonts/、icons/、node/、release-notes/、static/、package.json、server.js、vendor js、aliyun-sdk-oss.js）；隐式契约不得变化，不一致项修正构建脚本。
  - **验证命令**：`npm run build && for f in main.js index.html app.js lib.js templates.js app.css server.js package.json; do test -f dist/$f || echo "MISSING:dist/$f"; done; echo LAYOUT-CHECK-DONE`
  - **预期输出**：仅输出 `LAYOUT-CHECK-DONE`（无 MISSING）
  - **失败处理**：MISSING 项对照基线补齐构建步骤后复跑。

### 5.3 Phase 2 任务清单（Electron 大版本升级）

> 本阶段前置门禁：上一阶段完成标准编号 A1-A3 全部通过、其回滚点标签已存在，且 D1 确认栏已签署。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。D1 确认栏未签署时本阶段任务保持未开始。

- [ ] **P2-01** Electron 版本查询与 D1 决策复核
  - **前置依赖**：Phase 1 门禁通过 + D1 确认栏已签署
  - **执行步骤**：执行 `npm view electron version` 复核目标版本（文档基线为 45.3.2，2026-11-14 查询）；若与 D1 记录不一致（新版发布），更新 D1 条目与查询日期；查询失败（网络不可达）时标记 `[!]` 阻塞待人工输入目标版本号，禁止臆写。
  - **验证命令**：`npm view electron version`
  - **预期输出**：输出具体版本号（与 D1 记录一致或更新后的新值）
  - **失败处理**：npm 查询报错时标记阻塞待人工输入。

- [ ] **P2-02** 目标 Electron 内置 Node 版本核对
  - **前置依赖**：P2-01
  - **执行步骤**：安装目标 Electron 后以 `node -p "process.versions.node"`（electron 运行时内）或官方发布说明核对内置 Node 版本；若低于 22，将 engines.node 下调至该值并写入 D2 补充说明。
  - **验证命令**：`npx electron -e "console.log(process.versions.node)" 2>/dev/null || node -e "console.log('以官方发布说明核对')"`
  - **预期输出**：输出内置 Node 版本号或核对说明
  - **失败处理**：无法确认时以 Electron 官方 releases 文档为准记录。

- [ ] **P2-03** 两步走升级第一步（中间版本验证）
  - **前置依赖**：P2-01、P2-02
  - **执行步骤**：按 Electron 官方迁移文档（1.8→2 破坏性变更清单）确定最小可运行中间版本；`npm install --save-dev electron@<中间版本>`；启动应用验证 AngularJS 1.x + Bootstrap 3 渲染层兼容（窗口加载 index.html、UI 元素可见）；禁止一步跳至目标版本后一次性验证。
  - **验证命令**：`npm install --save-dev electron@<中间版本> && npx electron . --no-sandbox`（人工观察窗口加载）
  - **预期输出**：应用窗口启动且 index.html 渲染无白屏
  - **失败处理**：渲染失败时按官方迁移文档逐项修复（remote/菜单等先于本任务或并行处理）。

- [ ] **P2-04** makeSingleInstance 替换
  - **前置依赖**：P2-03
  - **执行步骤**：main.js:182 的 `app.makeSingleInstance(callback)` 改为 `app.requestSingleInstanceLock()` + `second-instance` 事件；行为等价：二次启动聚焦已有窗口（isMinimized→restore、focus）。
  - **验证命令**：`grep -c "makeSingleInstance" main.js`
  - **预期输出**：`0`（零残留）
  - **失败处理**：替换后二次启动行为异常时对照 Electron 官方 requestSingleInstanceLock 文档修正。

- [ ] **P2-05** darwin 菜单 selector 改造
  - **前置依赖**：P2-03
  - **执行步骤**：main.js:264-292 的 `selector: "undo:"` 等 6 处改为标准 `role`（undo/redo/cut/copy/paste/selectAll）。
  - **验证命令**：`grep -c "selector:" main.js`
  - **预期输出**：`0`（零残留）
  - **失败处理**：菜单行为异常时对照 Electron Menu role 文档修正。

- [ ] **P2-06** remote.dialog 替代
  - **前置依赖**：P2-03
  - **执行步骤**：app/components/services/dialog.s.js:6（全仓唯一 remote 使用点）改为 `ipcRenderer.invoke('dialog:show-open-dialog', options)`；主进程新增 `ipcMain.handle('dialog:show-open-dialog')` 转调 `dialog.showOpenDialog(win, options)`；保持 `{canceled, filePaths}` 返回结构映射到原回调参数 `filePaths`（showUploadDialog/showDownloadDialog 两处调用行为等价）。
  - **验证命令**：`grep -rn "remote" app/components/services/dialog.s.js; grep -c "dialog:show-open-dialog" main.js`
  - **预期输出**：dialog.s.js 内 remote 零命中；main.js 通道计数 ≥1
  - **失败处理**：上传/下载对话框行为异常时核对 Promise 返回结构与回调映射。

- [ ] **P2-07** IPC 通道改造
  - **前置依赖**：P2-06
  - **执行步骤**：单通道 `asynchronous`/`asynchronous-reply` 4 消息拆分为每消息一通道 invoke/handle（getStaticServerPort/openDevTools/refreshPage/installRestart 各自独立）；app/index.html:72-110 的 ipcRenderer 调用同步改造；任务步骤含残留自检。
  - **验证命令**：`grep -rn "asynchronous-reply" app/ main.js app/index.html`
  - **预期输出**：零命中（退出码 1 属预期）
  - **失败处理**：残留引用逐处改造后复跑。

- [ ] **P2-08** webPreferences 显式声明与安全核对表
  - **前置依赖**：P2-03
  - **执行步骤**：main.js:69-71 webPreferences 显式声明 `nodeIntegration: true`、`contextIsolation: false`、`sandbox: false`、`plugins: true`（保留并核对 PDF 行为）；按 D9 形成安全核对表（现状/目标/与官方安全清单差异/豁免理由）归档执行记录区。
  - **验证命令**：`grep -c "nodeIntegration" main.js`
  - **预期输出**：计数 ≥1
  - **失败处理**：渲染层 Node API 不可用时核对显式声明是否生效。

- [ ] **P2-09** TLS 三处降级开关化
  - **前置依赖**：P2-03
  - **执行步骤**：按 D7 改造三处——①`NODE_TLS_REJECT_UNAUTHORIZED=0` 赋值移至文件首行（require electron 之前）并按开关 `OSS_BROWSER_ALLOW_INSECURE_TLS=1` 条件赋值；②`ignore-certificate-errors` switch 按开关追加；③`certificate-error` 事件按开关放行（默认走阻止行为）；开关开启时 electron-log 输出审计日志。
  - **验证命令**：`grep -c "OSS_BROWSER_ALLOW_INSECURE_TLS" main.js`
  - **预期输出**：计数 ≥3（三处改造点均引用开关）
  - **失败处理**：开关默认关闭时自签名证书场景失败属预期，核对开关开启后恢复可用。

- [ ] **P2-10** crc64 原生模块处置
  - **前置依赖**：P2-03
  - **执行步骤**：评估 node/crc64/electron-crc64-prebuild 复用或以 electron-rebuild 按新 ABI 重编 cpp-addon；升级前先实测记录 crc64 校验值（对固定样本文件），重编后比对一致。
  - **验证命令**：`node -e "const c=require('./node/crc64');console.log('crc64-check-ok')"`（以实际模块入口为准）
  - **预期输出**：模块加载成功且校验值与升级前一致
  - **失败处理**：ABI 不匹配时按 electron-rebuild 文档重编；仍失败标记 `[!]` 阻塞（影响上传校验，禁止跳过）。

- [ ] **P2-11** Chromium 渲染兼容验证
  - **前置依赖**：P2-03 至 P2-09
  - **执行步骤**：复核 app/index.html:53-64 module 暂存 hack 在新 Electron 下的必要性（保留则记录理由，移除则验证 lib.js 加载正常）；老 UI 库渲染核对（Bootstrap 3 布局、字体图标、模态框）。
  - **验证命令**：`npx electron .`（人工观察 UI 渲染，绑定冒烟清单中文界面项）
  - **预期输出**：UI 元素渲染正常无布局错乱
  - **失败处理**：渲染差异项记录并对照 R-02 缓解措施处置。

- [ ] **P2-12** userData 与本地数据兼容评估
  - **前置依赖**：P2-03
  - **执行步骤**：核对 Global.config_path（~/.oss-browser，app/index.html:126）保持不变；以存量配置文件实测升级后登录态恢复（AK/SK 读取正常）；评估 app.getPath('userData') 变化影响并记录（R-09）。
  - **验证命令**：`grep -n "config_path" app/index.html`
  - **预期输出**：命中 `~/.oss-browser` 路径定义行
  - **失败处理**：登录态丢失时回退排查配置读取链路。

### 5.4 Phase 3 任务清单（前端框架与 UI 库升级）

> 本阶段前置门禁：上一阶段完成标准编号 A1-A4 全部通过、其回滚点标签已存在，且 D3 确认栏已签署。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

- [ ] **P3-01** angular 1.5.8 → 1.8.3 与 angular-sanitize 同步升级
  - **前置依赖**：Phase 2 门禁通过 + D3 确认栏已签署
  - **执行步骤**：`npm install --save-dev angular@1.8.3 angular-sanitize@1.8.3`；1.x 系列内向后兼容，启动应用核对模块加载；豁免条目（1.x 终版、路线 B 列入第 11 章）记入第 8 章对照表。
  - **验证命令**：`node -e "console.log(require('./package.json').devDependencies.angular)"`
  - **预期输出**：`1.8.3`
  - **失败处理**：模块加载异常时对照 AngularJS 1.8 迁移说明修正。

- [ ] **P3-02** angular-ui-router 0.2.18 → 0.4.3 兼容版升级
  - **前置依赖**：P3-01
  - **执行步骤**：`npm install --save-dev angular-ui-router@0.4.3`；核对 $stateChange 事件名变化（$stateChangeSuccess 等在 0.4.x 保留但 1.x 移除，0.4.3 为兼容目标）；启动核对路由跳转正常。
  - **验证命令**：`node -e "console.log(require('./package.json').devDependencies['angular-ui-router'])"`
  - **预期输出**：`0.4.3`
  - **失败处理**：路由异常时 grep 事件监听点核对事件名。

- [ ] **P3-03** angular-ui-bootstrap 2.3.1 → 2.5.6 升级
  - **前置依赖**：P3-01
  - **执行步骤**：`npm install --save-dev angular-ui-bootstrap@2.5.6`；核对 $uibModal 命名空间等破坏性 API 适配（2.3→2.5 内 $uibModal 稳定）；启动核对模态框（dialog.s.js 的 $modal.open 调用）正常。
  - **验证命令**：`node -e "console.log(require('./package.json').devDependencies['angular-ui-bootstrap'])"`
  - **预期输出**：`2.5.6`
  - **失败处理**：模态框异常时对照 ui-bootstrap 2.5 changelog 修正。

- [ ] **P3-04** angular-ui-codemirror 与 codemirror 5.19.0 → 5.65.21 升级
  - **前置依赖**：P3-01
  - **执行步骤**：`npm install --save-dev codemirror@5.65.21`；angular-ui-codemirror 0.3.0 保留（无新版本）；6.x 为模块化重写（ESM 重构）不兼容 angular-ui-codemirror 的全局脚本加载方式，豁免理由写入第 8 章；启动核对代码预览组件。
  - **验证命令**：`node -e "console.log(require('./package.json').devDependencies.codemirror)"`
  - **预期输出**：`5.65.21`
  - **失败处理**：预览组件异常时核对 codemirror 5.x 内 API 变化。

- [ ] **P3-05** jquery 2.2.3 → 3.7.1 升级
  - **前置依赖**：P3-01
  - **执行步骤**：`npm install --save-dev jquery@3.7.1`；执行 `grep -rn "\.load(\|\.unload(\|\.bind(" app/` 核对废弃 API 调用点（.load/.unload/.bind 在 3.x 移除），逐点改为 .on() 等价调用；实测基线该 grep 命中 1 处（app/main/main.js:29 `autoUpgradeSvs.load(...)` 为自定义服务方法调用，非 jquery API，属模式误报，人工核对排除）；jquery 4.0.0 为最新大版本但破坏面大，列入第 11 章。
  - **验证命令**：`grep -rn "\.load(\|\.unload(\|\.bind(" app/ --include="*.js" | grep -v node_modules | wc -l`
  - **预期输出**：计数 `1` 且唯一命中为 app/main/main.js:29（`autoUpgradeSvs.load` 自定义服务方法误报；jquery 废弃 API 调用点人工核对为零）
  - **失败处理**：残留调用点逐处改造后复跑。

- [ ] **P3-06** bootstrap 3.3.6 → 3.4.1 升级
  - **前置依赖**：P3-01
  - **执行步骤**：`npm install --save-dev bootstrap@3.4.1`（3.x 最终维护版）；ui-bootstrap 2.5.6 绑定 BS3 样式，bootstrap 5.x 不兼容，豁免保留 3.x 线理由写入第 8 章；启动核对布局与组件样式。
  - **验证命令**：`node -e "console.log(require('./package.json').devDependencies.bootstrap)"`
  - **预期输出**：`3.4.1`
  - **失败处理**：样式差异项对照 bootstrap 3.4 changelog 修正。

- [ ] **P3-07** font-awesome 4.7.0 图标类名兼容核对
  - **前置依赖**：P3-01
  - **执行步骤**：核对 font-awesome 4.7.0 图标类名（fa fa-*）在升级至 @fortawesome/fontawesome-free 7.3.1 后的兼容性（4.x `fa` 类名 → 6.x+ `fa-solid` 等结构变化）；执行类名清单核对命令产出使用面；不兼容则豁免保留 4.7.0 并记录，禁止默认保留。
  - **验证命令**：`grep -rhoE 'fa fa-[a-z0-9-]+' app/ --include="*.html" | sort -u | head -n 20`
  - **预期输出**：产出图标类名清单（决策依据）
  - **失败处理**：类名不兼容且改造量超出范围时豁免保留 4.7.0 并在第 8 章记录理由。

- [ ] **P3-08** moment 2.19.2 → 2.31.0 升级
  - **前置依赖**：P3-01
  - **执行步骤**：`npm install --save-dev moment@2.31.0`（design 阶段预选 2.30.1，以 2026-11-14 实测存档最新 2.31.0 为准）；核对 5 处调用点（实测：app/components/filters/formater.js:38、app/main/auth/login.js:138、app/main/files/modals/grant-token-modal.js:199、app/main/_/top.js:64 共 4 处活跃调用 + app/main/files/modals/preview/restore-checker.js:59 注释 1 处）；dayjs 替换超出范围，豁免记录写入第 8 章。
  - **验证命令**：`grep -rn "moment(" app/ --include="*.js" | grep -v node_modules | wc -l`
  - **预期输出**：`5`（与实测调用点数一致）
  - **失败处理**：调用点数变化时重新盘点并核对每处格式化行为。

- [ ] **P3-09** showdown 1.4.2 升级核对
  - **前置依赖**：P3-01
  - **执行步骤**：`npm install --save-dev showdown@2.1.0`；核对 2 处调用点（实测：app/main/modals/about.js:46、app/main/_/top.js:114 的 `new showdown.Converter()`）；启动核对 release-notes markdown 渲染。
  - **验证命令**：`grep -rn "new showdown.Converter()" app/ --include="*.js" | wc -l`
  - **预期输出**：`2`
  - **失败处理**：渲染异常时对照 showdown 2.x changelog 核对 Converter API。

- [ ] **P3-10** lib.js vendor 清单同步与 angular-translate 升级
  - **前置依赖**：P3-01 至 P3-09
  - **执行步骤**：build.mjs 的 vendor 拼接清单随新版本包路径同步（如 angular 1.8.3 的 dist 路径）；vendor/angular-translate.min.js 升级至对应 2.x 版本（手工文件，从官方发布渠道获取后替换并记录来源）。
  - **验证命令**：`npm run build && test -f dist/lib.js && echo LIBJS-SYNC-OK`
  - **预期输出**：`LIBJS-SYNC-OK`
  - **失败处理**：拼接路径缺失时对照 node_modules 实际布局修正。

- [ ] **P3-11** 前端回归验证
  - **前置依赖**：P3-01 至 P3-10
  - **执行步骤**：执行冒烟清单对应项——i18n 中文界面显示、release-notes 展示、右键菜单/模态框 UI 视觉回归抽查；全部通过后创建回滚点。
  - **验证命令**：`npm run build && npx electron .`（人工核对冒烟三项）
  - **预期输出**：三项冒烟全部通过
  - **失败处理**：未通过项定位至具体库版本回退该库后复验。

### 5.5 Phase 4 任务清单（运行时依赖现代化）

> 本阶段前置门禁：上一阶段完成标准编号 A1-A3 全部通过、其回滚点标签已存在。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

- [ ] **P4-01** request 调用点复核与替换
  - **前置依赖**：Phase 3 门禁通过
  - **执行步骤**：先执行 `grep -rn "request(" app/ main.js` 与 `grep -rn "require('request')\|require(\"request\")" app/ main.js app/index.html` 产出调用点清单（实测：app/index.html:14 唯一引入点）；逐点改用原生 fetch（目标 Chromium 内置）或主进程侧 electron net；禁止盲删；替换后从 package.json 移除 request。
  - **验证命令**：`grep -rn "require('request')\|require(\"request\")" app/ main.js app/index.html; node -e "console.log(!require('./package.json').dependencies.request?'REQUEST-REMOVED':'STILL-PRESENT')"`
  - **预期输出**：调用点零命中；`REQUEST-REMOVED`
  - **失败处理**：替换后请求行为异常时逐点核对 fetch 选项（headers/timeout）与 request 等价性。

- [ ] **P4-02** nodemailer 升级与 nodemailer-smtp-transport 移除
  - **前置依赖**：P4-01
  - **执行步骤**：`npm install --save nodemailer@6.10.1`（6.x 最新维护版，2026-11-14 实测；7.x+ 主版本存在 transport 选项变更，列入第 11 章）；app/components/services/mailer.js:5 移除 `require('nodemailer-smtp-transport')`，:19 的 `createTransport(smtpTransport(smtp))` 改为 `createTransport(smtp)` 直传（行为等价）；从 package.json 移除 nodemailer-smtp-transport。
  - **验证命令**：`grep -c "smtpTransport" app/components/services/mailer.js; node -e "console.log(!require('./package.json').dependencies['nodemailer-smtp-transport']?'TRANSPORT-REMOVED':'STILL-PRESENT')"`
  - **预期输出**：mailer.js 内 smtpTransport 计数 `0`；`TRANSPORT-REMOVED`
  - **失败处理**：邮件发送异常时核对 smtp 配置对象字段与 nodemailer 6.x 文档。

- [ ] **P4-03** electron-log 1.3.0 → 5.4.4 升级
  - **前置依赖**：P4-01
  - **执行步骤**：`npm install --save electron-log@5.4.4`；核对 transports.file.level API（1.x `log.transports.file.level = false` → 5.x `log.transports.file.level = false` 语义变化，按 5.x 文档适配）；D7 审计日志依赖此模块，开关开启时输出审计日志需实测。
  - **验证命令**：`node -e "console.log(require('./package.json').dependencies['electron-log'])"`
  - **预期输出**：`5.4.4`
  - **失败处理**：日志不输出时核对 5.x transports 配置结构。

- [ ] **P4-04** mime 1.3.6 → 4.1.2 升级
  - **前置依赖**：P4-01
  - **执行步骤**：`npm install --save mime@4.1.2`；node/ossstore/lib/upload-job.js:8 引入不变，:297 与 :413 的 `mime.lookup(...)` 改为 `mime.getType(...)`（2.x 起 lookup 更名 getType，实测两处调用点）。
  - **验证命令**：`grep -c "mime.lookup" node/ossstore/lib/upload-job.js`
  - **预期输出**：`0`（零残留）
  - **失败处理**：上传 ContentType 异常时核对 getType 返回值与 lookup 等价性。

- [ ] **P4-05** koa 系升级至 2.x 最新维护版
  - **前置依赖**：P4-01
  - **执行步骤**：`npm install --save koa@2.16.4 koa-convert@2.0.0 koa-static-server@1.5.2`；koa 3.3.0（2026-11-14 实测 latest）存在回调签名变更且 server.js 收益不足，豁免保留 2.x 线理由写入第 8 章；启动核对静态服务端口 7123-7126 监听正常。
  - **验证命令**：`node -e "const p=require('./package.json');console.log(p.dependencies.koa,p.dependencies['koa-convert'],p.dependencies['koa-static-server'])"`
  - **预期输出**：`2.16.4 2.0.0 1.5.2`
  - **失败处理**：静态服务异常时核对 koa-convert 包装中间件行为。

- [ ] **P4-06** ali-oss 升级与 aliyun-sdk 兼容实测
  - **前置依赖**：P4-01
  - **执行步骤**：`npm install --save ali-oss@6.23.0 aliyun-sdk@1.12.10`；aliyun-sdk 依赖老版 protobufjs，与新 Node 兼容性为 R-04 高风险——实测上传/下载链路（含 vendor/aliyun-sdk-oss.js 手工文件加载）；实测失败则书面豁免保留现状版本（^1.12.3）并在第 8 章记录。
  - **验证命令**：`node -e "console.log(require('./package.json').dependencies['ali-oss'],require('./package.json').dependencies['aliyun-sdk'])"`
  - **预期输出**：`6.23.0 1.12.10`（或豁免保留时输出豁免后版本并附记录）
  - **失败处理**：实测失败时执行豁免路径：回退版本、记录根因、在执行记录区标注"R-04 已触发并豁免"。

- [ ] **P4-07** npm audit 核验
  - **前置依赖**：P4-01 至 P4-06
  - **执行步骤**：执行 `npm audit --audit-level=critical`；critical 级别漏洞清零（存在则逐项处置：升级补丁版本或书面豁免）；high 级别漏洞附书面豁免理由。
  - **验证命令**：`npm audit --audit-level=critical`
  - **预期输出**：无 critical 输出（退出码 0）
  - **失败处理**：critical 存在时逐项升级处置后复跑；无法处置标记 `[!]` 阻塞。

- [ ] **P4-08** SMTP 与上传下载冒烟
  - **前置依赖**：P4-01 至 P4-07
  - **执行步骤**：执行冒烟清单对应项——SMTP 设置与邮件发送（需真实 SMTP 凭证，标注后执行）；上传/下载（含断点续传）冒烟（需真实 Bucket 凭证，标注后执行）；全部通过后创建回滚点。
  - **验证命令**：`npm run build && npx electron .`（人工执行冒烟两项，凭证标注"需真实凭证"）
  - **预期输出**：两项冒烟通过
  - **失败处理**：未通过项回退对应依赖版本后复验。

### 5.6 Phase 5 任务清单（测试重建与打包现代化）

> 本阶段前置门禁：上一阶段完成标准编号 A1-A4 全部通过、其回滚点标签已存在，且 D5/D6 确认栏已签署。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

- [ ] **P5-01** spectron E2E → Playwright _electron 迁移
  - **前置依赖**：Phase 4 门禁通过 + D5 确认栏已签署
  - **执行步骤**：`npm install --save-dev @playwright/test@1.65.1`；test/index.js 操作序列逐条映射为 Playwright 用例（登录→Bucket 浏览→建目录→删目录→上传）；UI 断言选择器按 Playwright API 适配（waitForExist→waitFor、setValue→fill 等）；绑定测试专用 Bucket 并标注"需真实凭证"；ava 0.20 的 E2E 入口替换为 Playwright test runner（test/index.js 重命名为 test/e2e.spec.js 或等效）。
  - **验证命令**：`npx playwright test --list`
  - **预期输出**：列出迁移后用例清单（无加载错误）
  - **失败处理**：选择器失效时以 Playwright trace 定位元素重写。

- [ ] **P5-02** electron-builder 配置落地
  - **前置依赖**：D6 确认栏已签署
  - **执行步骤**：package.json 增加 builder 配置段——`extraResources` 将 custom/ 原样拷入产物 resources（保持自定义构建机制行为一致，custom/index.js 7 字段契约不变）；`asarUnpack` 对应 `*.node`（crc64 原生模块）；win/mac/linux 目标声明。
  - **验证命令**：`node -e "const p=require('./package.json');console.log(!!p.build?'BUILDER-CONFIG-OK':'MISSING')"`
  - **预期输出**：`BUILDER-CONFIG-OK`
  - **失败处理**：custom/ 字段未生效时核对 extraResources from/to 路径。

- [ ] **P5-03** Makefile 目标名保留与 rcedit hack 废弃
  - **前置依赖**：P5-02
  - **执行步骤**：Makefile 打包目标名保持不变（win64/win32/linux64/linux32/mac/dmg），内部命令替换为 electron-builder CLI 调用；废弃 rcedit hack——删除 package.json 的 `rcedit` script 与 `cp tools/rcedit-x64.exe` 步骤（electron-builder 内置 win 图标/版本信息处理）。
  - **验证命令**：`grep -cE "^(win64|win32|linux64|linux32|mac|dmg):" Makefile; grep -c "rcedit" Makefile package.json`
  - **预期输出**：目标名计数 `6`；rcedit 计数 `0`
  - **失败处理**：目标缺失时补齐；rcedit 残留逐处删除。

- [ ] **P5-04** ia32 目标评估
  - **前置依赖**：P5-02
  - **执行步骤**：以 electron-builder 实测 win32-ia32/linux-ia32 在目标 Electron 45 下的支持状态；不支持则在决策记录区 D6-ia32 条目记录实测结论，经人工确认后移除 win32/linux-ia32 打包目标，禁止静默删除。
  - **验证命令**：`npx electron-builder --win --ia32 --dir`（实测支持性）
  - **预期输出**：构建成功或明确的"不支持 ia32"报错（作为记录依据）
  - **失败处理**：实测不支持时走人工确认流程，未确认前保留目标定义。

- [ ] **P5-05** installRestart 升级机制验证
  - **前置依赖**：P5-02
  - **执行步骤**：main.js:125-144 的 installRestart（asar 文件替换 + app.relaunch）在新打包布局（electron-builder asar 结构）下验证；行为变化时在执行记录区显式声明（自动升级服务端不在本次范围，见第 2 章排除项）。
  - **验证命令**：`grep -n "installRestart" main.js`
  - **预期输出**：命中 installRestart 处理段（改造后入口仍在）
  - **失败处理**：新布局下 asar 路径不可达时记录差异并声明行为变化。

- [ ] **P5-06** 三平台验证
  - **前置依赖**：P5-01 至 P5-05
  - **执行步骤**：Windows（当前环境）：构建产物存在性检查 + 应用启动 + 冒烟清单九项核心项回归；macOS/Linux：由开发者/测试人工执行同等验证并回填结果至第 10 章执行记录区（三平台覆盖计划见第 9 章）。
  - **验证命令**：`npx electron-builder --win --x64 && ls dist/*.exe 2>/dev/null || echo "产物路径以 builder 输出为准"`
  - **预期输出**：Windows 产物生成成功（macOS/Linux 人工回填）
  - **失败处理**：Windows 构建失败时按 electron-builder 报错定位；平台差异项记录后人工裁决。

- [ ] **P5-07** 终验收口
  - **前置依赖**：P5-01 至 P5-06
  - **执行步骤**：`npx playwright test` 通过（E2E 需真实凭证，标注后执行）；`npm audit` 无 critical 终验；全量冒烟九项回归收尾；创建回滚点 `rollback/P5-packaging`。
  - **验证命令**：`npx playwright test; npm audit --audit-level=critical`
  - **预期输出**：E2E 通过；audit 无 critical
  - **失败处理**：未通过项定位修复后复跑；无法当日修复标记 `[!]` 阻塞。

## 6. 风险清单

> 每条风险字段：风险描述 / 影响阶段 / 发生概率 / 影响等级 / 缓解措施 / 回滚策略 / 状态。缓解措施与回滚策略均不得为空。

### R-01

- **风险描述**：Electron 1.8.4 → 45.3.2 跨越 40+ 大版本，remote 模块移除（Electron 14 起）、`app.makeSingleInstance` 移除、darwin 菜单 `selector` 失效、webPreferences 默认值收紧（nodeIntegration 默认 false）。
- **影响阶段**：P2（主）、P5
- **发生概率**：高
- **影响等级**：高
- **缓解措施**：按 D8 五项映射表逐项改造；两步走升级（先中间版本验证渲染层再升目标版本）；Phase 2 专项任务逐条绑定验证命令。
- **回滚策略**：`git checkout rollback/P1-toolchain`（回到工具链现代化完成态，Electron 保持 1.8.4）。
- **状态**：未触发

### R-02

- **风险描述**：AngularJS 1.5.8 / Bootstrap 3.3.6 / angular-ui-bootstrap 2.3.1 在新 Chromium 上的渲染与行为差异（CSS 布局、事件模型、模态框/右键菜单交互）。
- **影响阶段**：P2、P3
- **发生概率**：中
- **影响等级**：高
- **缓解措施**：两步走升级的中间版本验证渲染层兼容；P3 阶段 UI 视觉回归抽查（右键菜单/模态框/i18n 中文显示）绑定冒烟清单。
- **回滚策略**：`git checkout rollback/P2-electron`（P3 内回退）或 `git checkout rollback/P1-toolchain`（P2 内回退）。
- **状态**：未触发

### R-03

- **风险描述**：工具链死锁——gulp ~3.5.5（依赖 graceful-fs 3.x）与 Node 24 不兼容导致构建瘫痪；叠加 npm scripts POSIX 路径在 Windows 不可执行。
- **影响阶段**：P0、P1
- **发生概率**：高（已实测确认，证据见 1.4 节）
- **影响等级**：高
- **缓解措施**：P1 以 esbuild + Node 原生脚本整体替代 gulp 链路并重写 scripts（消除 POSIX 路径依赖）；P0 先迁移 ava 单测建立回归兜底。
- **回滚策略**：`git checkout rollback/P0-baseline`（基线态可复现 `npm test`）。
- **状态**：已触发（构建链路不可用，实测证据固化于 1.4 节）

### R-04

- **风险描述**：aliyun-sdk ^1.12.3 依赖老版 protobufjs，其 Buffer API / 代码风格在新 Node 下可能运行报错；vendor/aliyun-sdk-oss.js 为手工文件独立于 npm 依赖树。
- **影响阶段**：P4
- **发生概率**：中
- **影响等级**：高
- **缓解措施**：P4 设置 aliyun-sdk 1.12.10 兼容实测任务（含上传下载链路）；实测失败则书面豁免保留现状版本并在第 8 章对照表记录。
- **回滚策略**：`git checkout rollback/P3-frontend`（回到前端升级完成态）。
- **状态**：未触发

### R-05

- **风险描述**：Apsara Stack 私有化部署使用自签名证书，TLS 降级默认关闭后该场景无法建立连接。
- **影响阶段**：P2、P4
- **发生概率**：中
- **影响等级**：中
- **缓解措施**：D7 显式开关 `OSS_BROWSER_ALLOW_INSECURE_TLS=1`（默认关闭、开启时 electron-log 审计日志），第 9 章约束记录开关用法与场景说明。
- **回滚策略**：`git checkout rollback/P1-toolchain`（回到 TLS 行为原状态）。
- **状态**：未触发

### R-06

- **风险描述**：AngularJS 若误选迁移替代框架路线（路线 B），app/ 约 124 个 JS 文件重写导致工作量与风险失控。
- **影响阶段**：P3
- **发生概率**：低（D3 已决策路线 A）
- **影响等级**：高
- **缓解措施**：D3 唯一推荐路线 A（渐进保留至 1.8.3）+ 确认栏签署门禁；路线 B 仅第 3 章对比论证，不实施。
- **回滚策略**：`git checkout rollback/P2-electron`（回到 Electron 升级完成态）。
- **状态**：未触发

### R-07

- **风险描述**：node/crc64 cpp-addon 原生模块按 Electron 1.8.4 ABI 编译，新 Electron ABI 不匹配导致 .node 加载失败（影响上传校验）。
- **影响阶段**：P2
- **发生概率**：高
- **影响等级**：中
- **缓解措施**：D8 第 5 项——评估 electron-crc64-prebuild 复用或 electron-rebuild 按新 ABI 重编；以 crc64 校验值与升级前一致为验收。
- **回滚策略**：`git checkout rollback/P1-toolchain`（crc64 保持原 ABI 可用态）。
- **状态**：未触发

### R-08

- **风险描述**：ia32 目标平台（win32-ia32/linux-ia32）不再被新版 Electron 支持（Electron 4 起 Linux ia32 已停止支持，win32-ia32 支持状态待实测）。
- **影响阶段**：P1（Makefile 改造）、P5
- **发生概率**：高
- **影响等级**：中
- **缓解措施**：D6 ia32 评估任务——Phase 5 以 electron-builder 实测确认，不支持则经人工确认后移除目标并记录，禁止静默删除。
- **回滚策略**：`git checkout rollback/P4-runtime`（打包目标清单保持改造前状态）。
- **状态**：未触发

### R-09

- **风险描述**：userData 目录结构变化导致用户本地数据（AK/SK 密钥、界面配置，存储于 ~/.oss-browser，见 app/index.html:126）不兼容或丢失。
- **影响阶段**：P2
- **发生概率**：低
- **影响等级**：高（涉及用户密钥数据）
- **缓解措施**：P2 设置 userData 与本地数据兼容评估任务；保持 Global.config_path（~/.oss-browser）不变；升级后以存量配置文件实测登录态恢复。
- **回滚策略**：`git checkout rollback/P1-toolchain`（配置读取行为保持原状）。
- **状态**：未触发

## 7. 回滚机制

> 三层回滚：任务级 → 阶段级 → 全局兜底。全部命令在项目根目录 git-bash 执行。

### 7.1 任务级回滚

单条任务失败时执行（重试 1 次仍失败则停在该回滚点输出诊断）：

```bash
# 1. 还原该任务改动的文件（以实际改动清单为准，禁止使用通配全量还原）
git checkout -- <改动文件清单>
# 2. 恢复依赖状态
npm install
# 3. 重跑该任务验证命令，比对预期输出
<该任务的验证命令>
```

### 7.2 阶段级回滚

阶段内多任务失败或阶段验收不通过时执行：

```bash
# 1. 暂存未提交改动
git stash
# 2. 标记失败点
git tag -f rollback/P{n}-failed
# 3. 回到上一阶段回滚点（示例为回退到 P1 完成态）
git checkout rollback/P1-toolchain
# 4. 新建恢复分支继续工作
git checkout -b recover/P{n}-retry
# 5. 恢复依赖状态
npm install
# 6. 执行上一阶段完成标准中的构建+启动验证命令，确认可运行
npm run build && npm test
```

### 7.3 全局兜底回滚

阶段级回滚后仍不可用时执行：

```bash
# 1. 回到基线
git checkout rollback/P0-baseline
# 2. 新建恢复分支
git checkout -b recover/baseline
# 3. 恢复依赖状态
npm install
# 4. 重跑 P0 的测试与构建验证，确认基线可复现
npm test
```

- 回滚后仍不可用的处置路径：在恢复分支上输出根因记录（写入第 10 章执行记录区"根因记录"占位区：现象 / 复现命令 / 初步定位 / 影响范围），暂停升级执行，等待人工裁决。
- 未预期风险补录流程：新发现问题按 `R-{两位序号}` 顺延补录至第 6 章（字段齐全）后再处置。

### 7.4 依赖清单备份机制

每阶段回滚点标签创建时，同步执行依赖快照备份：

```bash
mkdir -p docs/upgrade-snapshots/P{n}
cp package.json package-lock.json docs/upgrade-snapshots/P{n}/
git tag -f rollback/P{n}-{主题词}
```

备份产物（docs/upgrade-snapshots/P{n}/package.json 与 package-lock.json）随文档一并入库，作为该阶段依赖状态的不可变存证；阶段级回滚时以快照比对依赖漂移。

## 8. 废弃依赖处置对照表

> 全量覆盖 package.json 去重后 56 个直接依赖（dependencies 13 + devDependencies 44，clipboard 两侧声明去重 1 行）。target_version 引用 `docs/upgrade-snapshots/npm-versions-20261114.txt`（查询日期 2026-11-14）。disposition 四值枚举：升级 / 替换 / 移除 / 保留（保留必须附豁免理由）。deprecated_flag 对官方废弃/停更包标记"是"，被标记包均有替换/移除计划或书面豁免。

| 包名 | current_version | target_version | disposition | replace_with | deprecated_flag | 豁免理由/备注 |
|---|---|---|---|---|---|---|
| ali-oss | ^6.13.2 | 6.23.0 | 升级 | | 否 | P4-06 任务执行 |
| aliyun-sdk | ^1.12.3 | 1.12.10 | 升级 | | 否 | P4-06 兼容实测；失败则豁免保留现状版本（R-04） |
| clipboard | ^1.7.1 | — | 保留 | | 否 | 豁免：剪贴板功能正常，2.x 构造签名变化且非废弃包，升级收益低 |
| electron-log | 1.3.0 | 5.4.4 | 升级 | | 否 | P4-03 任务执行；D7 审计日志依赖 |
| emoji-regex | ^9.0.0 | — | 保留 | | 否 | 豁免：功能型工具包非废弃，现状满足需求 |
| koa | ^2.3.0 | 2.16.4 | 升级 | | 否 | P4-05；koa 3.3.0 回调签名变更收益不足，豁免保留 2.x 线 |
| koa-convert | ^1.2.0 | 2.0.0 | 升级 | | 否 | P4-05 |
| koa-static-server | ^1.2.1 | 1.5.2 | 升级 | | 否 | P4-05 |
| mime | ^1.3.6 | 4.1.2 | 升级 | | 否 | P4-04；mime.lookup→getType 两处调用点（upload-job.js:297/:413） |
| nodemailer | 4.0.1 | 6.10.1 | 升级 | | 否 | P4-02；7.x+ 主版本变更列入第 11 章 |
| nodemailer-smtp-transport | 2.7.4 | — | 移除 | | 是 | P4-02；createTransport(smtp) 直传等价替代 |
| platform | ^1.3.5 | — | 保留 | | 是 | 书面豁免：仅平台检测用途、行为稳定，官方归档无功能风险 |
| request | ^2.83.0 | — | 移除 | | 是 | P4-01；调用点改用原生 fetch（Chromium 内置，非 npm 包）后移除 |
| @alicloud/eslint-config | ^1.2.23 | — | 保留 | | 否 | 豁免：配套内部 eslint 规范，eslint 10 兼容性执行时核对 |
| angular | 1.5.8 | 1.8.3 | 升级 | | 否 | D3 路线 A；1.x 最终版 |
| angular-bootstrap-contextmenu | ^1.1.0 | — | 保留 | | 否 | 豁免：右键菜单功能正常，无新版本发布 |
| angular-sanitize | 1.5.8 | 1.8.3 | 升级 | | 否 | 与 angular 同步升级 |
| angular-ui-bootstrap | ^2.3.1 | 2.5.6 | 升级 | | 否 | P3-03；$uibModal 命名空间核对 |
| angular-ui-codemirror | 0.3.0 | — | 保留 | | 否 | 豁免：无新版本，配套 codemirror 5.x 使用 |
| angular-ui-router | 0.2.18 | 0.4.3 | 升级 | | 否 | P3-02；$stateChange 事件名核对 |
| ava | ^0.20.0 | 8.4.0 | 升级 | | 否 | P0-03；8.x 不兼容时兜底 6.4.1 |
| babel-core | ^6.24.1 | — | 移除 | | 是 | babel 6 系官方 EOL；esbuild 替代构建转译 |
| babel-eslint | ^10.1.0 | — | 移除 | | 是 | babel 6 系配套 parser；eslint 10 内置 espree 解析 ES2020+ |
| babel-preset-es2015 | ^6.24.1 | — | 移除 | | 是 | babel 6 系官方 EOL |
| bootstrap | 3.3.6 | 3.4.1 | 升级 | | 否 | P3-06；3.x 最终维护版，5.x 不兼容 ui-bootstrap 豁免 |
| bower | ~1.7.9 | — | 移除 | | 是 | 官方停止维护；实测无使用痕迹 |
| codemirror | ^5.19.0 | 5.65.21 | 升级 | | 否 | P3-04；6.x 模块化重写不兼容 ui-codemirror，豁免不升 6.x |
| commander | ~2.9.0 | — | 移除 | | 否 | 实测全仓无 require 使用点（构建辅助遗留） |
| cross-env | ^3.1.4 | — | 保留 | | 否 | 豁免：功能型脚本工具非废弃，满足 scripts 用途 |
| del | ^4.1.1 | — | 移除 | | 否 | 仅 gulpfile.js:6 使用；构建脚本 Node 原生 fs 替代 |
| electron | 1.8.4 | 45.3.2 | 升级 | | 否 | D1 两步走升级 |
| electron-packager | 7.1.0 | — | 替换 | electron-builder | 否 | D6；electron-builder 26.18.0 接替打包 |
| eslint | ^7.1.0 | 10.15.0 | 升级 | | 否 | lint 链路升级 |
| font-awesome | ^4.7.0 | — | 保留 | | 是 | 书面豁免：npm 包停更；P3-07 图标类名核对不通过则保留 4.7.0，通过则替换 @fortawesome/fontawesome-free 7.3.1 |
| gulp | ~3.5.5 | — | 移除 | | 是 | gulp 3 官方不维护；esbuild + Node 原生脚本替代 |
| gulp-angular-templatecache | ^1.1.0 | — | 移除 | | 否 | gulp 插件随构建链路移除 |
| gulp-babel | ~6.1.2 | — | 移除 | | 否 | gulp 插件随构建链路移除 |
| gulp-concat | ~2.1.7 | — | 移除 | | 否 | gulp 插件随构建链路移除 |
| gulp-connect | ^1.0.7 | — | 移除 | | 否 | gulp 插件随构建链路移除 |
| gulp-jshint | ~1.5.0 | — | 移除 | | 否 | gulp 插件随构建链路移除 |
| gulp-load-plugins | ~0.4.0 | — | 移除 | | 否 | gulp 插件随构建链路移除 |
| husky | ^4.2.3 | 9.1.7 | 升级 | | 否 | hooks 配置格式迁移（package.json hooks → .husky/ 目录） |
| jquery | ^2.2.3 | 3.7.1 | 升级 | | 否 | P3-05；废弃 API 调用点核对；4.0.0 列入第 11 章 |
| jquery.qrcode | ^1.0.3 | — | 保留 | | 否 | 豁免：二维码功能正常，无新版本发布 |
| karma | ^0.12.1 | — | 移除 | | 否 | 僵尸配置无存量用例（实测 0 文件），P0-05 显式废弃记录 |
| karma-chrome-launcher | ^0.1.2 | — | 移除 | | 否 | 同 karma 处置 |
| karma-jasmine | ^0.1.5 | — | 移除 | | 否 | 同 karma 处置 |
| lint-staged | ^10.1.2 | 17.6.0 | 升级 | | 否 | 与 husky 9 配套升级 |
| minimist | ^1.2.0 | — | 移除 | | 否 | 仅 gulpfile.js:7 注释引用，无活跃调用点；^1.2.0 范围内已含 1.2.8 安全修复 |
| mocha | ~2.4.5 | — | 保留 | | 否 | 豁免：node/ossstore 与 node/crc64 子项目测试文件 require 使用中（4 文件），不在 npm test 链路；现代化列入第 11 章 |
| moment | ^2.19.2 | 2.31.0 | 升级 | | 否 | P3-08；dayjs 替换列入第 11 章 |
| npm-run-all | ^4.0.2 | — | 保留 | | 否 | 豁免：dev 脚本并行结构保留其用途；npm-run-all2 替代列入第 11 章 |
| shelljs | ~0.7.0 | — | 移除 | | 否 | 仅 gulpfile.js:10 使用（shelljs/global）；Node 原生 child_process 替代 |
| should | ~9.0.0 | — | 保留 | | 否 | 豁免：node/ 子项目 mocha 测试断言使用中；与 mocha 同批处置 |
| showdown | ^1.4.2 | 2.1.0 | 升级 | | 否 | P3-09；2 处调用点（modals/about.js:46、_/top.js:114） |
| spectron | ^3.7.2 | — | 替换 | @playwright/test | 是 | 官方废弃；P5-01 Playwright _electron 迁移 |

## 9. 升级约束

### 9.1 功能行为不变声明与核心功能冒烟清单

升级全程功能行为不变。核心功能冒烟清单九项（与 5.1 小节 Phase 0 任务 P0-04 为同一份清单文本，各阶段回归共用）：

| # | 功能项 | 验证方式 |
|---|---|---|
| 1 | Bucket 列表与创建 | 操作路径：登录后主界面 Bucket 列表加载；工具栏创建 Bucket 表单提交 |
| 2 | 对象浏览/搜索 | 操作路径：进入 Bucket 后列表/块状视图切换、地址栏导航、Bucket 名称搜索框 |
| 3 | 上传/下载（含断点续传） | 操作路径：工具栏上传（文件/文件夹选择对话框）、下载按钮；断点续传为 ali-oss 分片上传链路（需真实 Bucket 凭证） |
| 4 | 删除/复制/移动 | 操作路径：对象右键菜单删除/复制/移动操作 |
| 5 | 权限 ACL/STS 设置 | 操作路径：对象右键菜单 ACL 设置、授权 Token 弹窗（grant-token-modal） |
| 6 | 中文界面显示 | 操作路径：设置语言切换 zh-CN 后界面文案核对 |
| 7 | SMTP 设置 | 操作路径：设置页 SMTP 表单保存与测试邮件发送（需真实 SMTP 凭证） |
| 8 | 自定义构建参数 | 操作路径：custom/index.js 7 字段（title/appId/appName/logo_png/logo_ico/logo_ico/about_html）打包后生效核对 |
| 9 | release-notes 展示 | 操作路径：关于弹窗 markdown 渲染（app/main/modals/about.js:46 showdown Converter） |

### 9.2 三平台约束与覆盖计划

- 每阶段完成标准必须含至少一个平台的全量构建+启动验证。
- 三平台覆盖计划表：

| 阶段 | 验证平台 | 补验安排 |
|---|---|---|
| P0-P1 | Windows（当前环境实测） | 无平台差异项，无需补验 |
| P2 | Windows 全量 | macOS（darwin 菜单改造项）在 P5 补验 |
| P3-P4 | Windows 全量 | macOS/Linux 在 P5 补验 |
| P5 | Windows 实测 | macOS/Linux 由开发者/测试人工执行同等验证并回填结果至第 10 章执行记录区 |

### 9.3 现有测试不倒退条款

- ava 迁移兜底：P0-03 将 test/import-config-parser.js 15 用例迁移至 ava 8.4.0（兜底 6.4.1），`npm test` 作为 Phase 1-4 全程快速回归兜底。
- karma 显式废弃记录：P0-05 核对无存量用例后显式废弃并记录（实测 0 文件），禁止静默删除。
- spectron 冻结：P0-06 冻结 test/index.js 至 Phase 5 用 Playwright 重写，期间不要求通过。
- 以上三项处置均禁止静默删除测试资产；测试不倒退指迁移后用例数与断言不减少。

### 9.4 约束优先级规则

"功能行为不变"与"安全配置收紧"冲突时，以显式配置开关方式同时满足（引用 D7 的 `OSS_BROWSER_ALLOW_INSECURE_TLS` 环境变量开关：默认关闭走安全校验、开启时保持 Apsara Stack 自签名证书场景可用并输出审计日志），禁止静默二选一。

### 9.5 custom/ 自定义构建兼容约束

- 自定义 title/logo/appId/appName 等经 electron-builder `extraResources` 将 custom/ 目录原样拷入产物 resources，保持自定义构建机制行为一致（引用 5.6 小节 P5-02）。
- 自定义构建参数在冒烟清单第 8 项核验（打包产物内 custom 字段生效）。

## 10. 执行状态追踪区

### 10.1 全局执行机制说明

#### 10.1.1 任务状态五态

任务状态五态，符号 + 文字双写：`\[ \] 未开始` / `\[~\] 进行中` / `\[x\] 已完成` / `\[r\] 已回滚` / `\[!\] 阻塞`。

| 符号 | 含义 | 处置规则 |
|---|---|---|
| [ ] | 未开始 | 任务尚未执行 |
| [~] | 进行中 | 任务正在执行 |
| [x] | 已完成 | 任务验证通过 |
| [r] | 已回滚 | 任务已按失败处理回退 |
| [!] | 阻塞 | 任务无法继续，等待人工裁决 |

#### 10.1.2 阶段门禁条款模板

各阶段小节开头引用以下模板原文：

> 本阶段前置门禁：上一阶段完成标准编号 A1-A{n} 全部通过、其回滚点标签已存在。任一不满足时，本阶段所有任务保持"未开始"状态，仅允许输出阻塞清单。

#### 10.1.3 回滚点命名规范

`rollback/P{阶段号}-{主题词}`，例如 `rollback/P0-baseline`、`rollback/P1-toolchain`。

#### 10.1.4 文档内升级任务条目格式

每条任务以 `- [ ] **P{n}-{XX}** {标题≤40字}` 开头，后接五个字段行：`**前置依赖**`、`**执行步骤**`、`**验证命令**`、`**预期输出**`、`**失败处理**`（六要素中 task_id/title 由条目头承担）。

#### 10.1.5 agent 执行动序（五步）

1. 读取任务条目。
2. 基线核对：核对仓库现状与第 1 章基线，存在漂移时先输出差异报告并暂停等待人工裁决。
3. 按"执行步骤"执行。
4. 运行"验证命令"比对"预期输出"。
5. 通过则勾选 `[x]` 并在执行记录区写执行记录；失败则按"失败处理"回退、标记 `[!]` 附日志摘要，重试 1 次仍失败则停在该回滚点输出诊断。

### 10.2 任务状态总表

> 第 5 章全部文档内升级任务逐条建行；状态列初始全部"未开始"，随执行进度按 10.1.1 五态更新。

| 任务ID | 标题 | 状态 | 执行日期 | 摘要 |
|---|---|---|---|---|
| P0-01 | 基线依赖快照固化 | 未开始 | | |
| P0-02 | 工具链死锁证据记录 | 未开始 | | |
| P0-03 | ava 单测迁移（8.4.0，兜底 6.4.1） | 未开始 | | |
| P0-04 | 核心功能冒烟清单建立 | 未开始 | | |
| P0-05 | karma 僵尸测试处置核对 | 未开始 | | |
| P0-06 | spectron E2E 冻结声明 | 未开始 | | |
| P0-07 | 创建阶段回滚点与依赖快照 | 未开始 | | |
| P1-01 | esbuild 构建脚本实现 app.js 产物 | 未开始 | | |
| P1-02 | templates.js 产物生成 | 未开始 | | |
| P1-03 | lib.js vendor 拼接 | 未开始 | | |
| P1-04 | css 产物与字体图标拷贝 | 未开始 | | |
| P1-05 | gen-package 等价改造 | 未开始 | | |
| P1-06 | remove-redundant 等价 | 未开始 | | |
| P1-07 | watch/dev 等价复刻 | 未开始 | | |
| P1-08 | package.json scripts 与构建期依赖清理 | 未开始 | | |
| P1-09 | Makefile 构建调用替换与 vendor 保留 | 未开始 | | |
| P1-10 | 产物布局契约逐文件核对 | 未开始 | | |
| P2-01 | Electron 版本查询与 D1 决策复核 | 未开始 | | |
| P2-02 | 目标 Electron 内置 Node 版本核对 | 未开始 | | |
| P2-03 | 两步走升级第一步（中间版本验证） | 未开始 | | |
| P2-04 | makeSingleInstance 替换 | 未开始 | | |
| P2-05 | darwin 菜单 selector 改造 | 未开始 | | |
| P2-06 | remote.dialog 替代 | 未开始 | | |
| P2-07 | IPC 通道改造 | 未开始 | | |
| P2-08 | webPreferences 显式声明与安全核对表 | 未开始 | | |
| P2-09 | TLS 三处降级开关化 | 未开始 | | |
| P2-10 | crc64 原生模块处置 | 未开始 | | |
| P2-11 | Chromium 渲染兼容验证 | 未开始 | | |
| P2-12 | userData 与本地数据兼容评估 | 未开始 | | |
| P3-01 | angular 1.5.8 → 1.8.3 与 angular-sanitize 同步升级 | 未开始 | | |
| P3-02 | angular-ui-router 0.2.18 → 0.4.3 兼容版升级 | 未开始 | | |
| P3-03 | angular-ui-bootstrap 2.3.1 → 2.5.6 升级 | 未开始 | | |
| P3-04 | angular-ui-codemirror 与 codemirror → 5.65.21 升级 | 未开始 | | |
| P3-05 | jquery 2.2.3 → 3.7.1 升级 | 未开始 | | |
| P3-06 | bootstrap 3.3.6 → 3.4.1 升级 | 未开始 | | |
| P3-07 | font-awesome 4.7.0 图标类名兼容核对 | 未开始 | | |
| P3-08 | moment 2.19.2 → 2.31.0 升级 | 未开始 | | |
| P3-09 | showdown 1.4.2 升级核对 | 未开始 | | |
| P3-10 | lib.js vendor 清单同步与 angular-translate 升级 | 未开始 | | |
| P3-11 | 前端回归验证 | 未开始 | | |
| P4-01 | request 调用点复核与替换 | 未开始 | | |
| P4-02 | nodemailer 升级与 nodemailer-smtp-transport 移除 | 未开始 | | |
| P4-03 | electron-log 1.3.0 → 5.4.4 升级 | 未开始 | | |
| P4-04 | mime 1.3.6 → 4.1.2 升级 | 未开始 | | |
| P4-05 | koa 系升级至 2.x 最新维护版 | 未开始 | | |
| P4-06 | ali-oss 升级与 aliyun-sdk 兼容实测 | 未开始 | | |
| P4-07 | npm audit 核验 | 未开始 | | |
| P4-08 | SMTP 与上传下载冒烟 | 未开始 | | |
| P5-01 | spectron E2E → Playwright _electron 迁移 | 未开始 | | |
| P5-02 | electron-builder 配置落地 | 未开始 | | |
| P5-03 | Makefile 目标名保留与 rcedit hack 废弃 | 未开始 | | |
| P5-04 | ia32 目标评估 | 未开始 | | |
| P5-05 | installRestart 升级机制验证 | 未开始 | | |
| P5-06 | 三平台验证 | 未开始 | | |
| P5-07 | 终验收口 | 未开始 | | |

### 10.3 基线核对任务说明

agent 每次续作（新会话或中断恢复）先执行基线核对：核对仓库现状与第 1 章基线盘点一致（package.json 版本与依赖计数、关键文件行号引用、git 基线提交）；存在漂移时输出差异报告并暂停等待人工裁决，禁止带漂移执行任务。

### 10.4 执行记录区

> 模板：`日期 | 任务ID | 结果摘要`。执行记录按时间顺序追加。

| 日期 | 任务ID | 结果摘要 |
|---|---|---|
| 2026-11-14 | 文档自检 P5-01 | 不可判定用语检索（适当/尽量/视情况）全文零命中 |
| 2026-11-14 | 文档自检 P5-02 | 任务 ID 全局唯一（dup-count=0）；五字段计数均 56 ≥ 任务总数 55 |
| 2026-11-14 | 文档自检 P5-03 | 验证命令抽验 12 条，全部可执行，记录见下方抽验记录表 |

#### 抽验记录表（P5-03，2026-11-14，Windows git-bash）

| # | 命令（来源任务） | 适用平台 | 退出码 | 输出摘要 | 是否符合文档预期 |
|---|---|---|---|---|---|
| 1 | `grep -cF "'.' 不是内部或外部命令" docs/dependency-upgrade-plan.md`（P0-02） | 全平台 | 0 | 3 | 是（≥1） |
| 2 | `grep -c "断点续传" docs/dependency-upgrade-plan.md`（P0-04） | 全平台 | 0 | 4 | 是（≥2） |
| 3 | `ls app/**/*_test.js app/**/*test.js 2>/dev/null \| wc -l`（P0-05） | 全平台 | 0 | 0 | 是（=0） |
| 4 | `test -f test/index.js && grep -c "spectron" test/index.js`（P0-06） | 全平台 | 0 | 1 | 是（≥1） |
| 5 | `npm view electron version`（P2-01） | 全平台 | 0 | 45.3.2 | 是（具体版本号） |
| 6 | `grep -n "config_path" app/index.html`（P2-12） | 全平台 | 0 | 命中 126 行 ~/.oss-browser 定义 | 是 |
| 7 | `grep -rn "\.load(\|\.unload(\|\.bind(" app/ --include="*.js" \| grep -v node_modules \| wc -l`（P3-05） | 全平台 | 0 | 1（app/main/main.js:29 自定义服务方法误报，已补录任务描述） | 是（命令可执行；基线实测与任务描述记载一致） |
| 8 | `grep -rn "moment(" app/ --include="*.js" \| grep -v node_modules \| wc -l`（P3-08） | 全平台 | 0 | 5 | 是（=5） |
| 9 | `grep -rn "new showdown.Converter()" app/ --include="*.js" \| wc -l`（P3-09） | 全平台 | 0 | 2 | 是（=2） |
| 10 | `grep -n "installRestart" main.js`（P5-05） | 全平台 | 0 | 命中 125 行处理段入口 | 是 |
| 11 | `grep -rn "require('request')\|require(\"request\")" app/ main.js app/index.html`（P4-01） | 全平台 | 0 | app/index.html:14 唯一引入点 | 是（产出调用点清单） |
| 12 | `node -e "const p=require('./package.json');console.log('version='+p.version,...)"`（P0-01 基线核对） | 全平台 | 0 | version=1.19.2 deps=13 devDeps=44 | 是 |

> 冒烟类命令（需真实 OSS/SMTP 凭证，如 P4-08、P5-01 E2E）按规则标注"需真实凭证"跳过实测。

#### 文档完整性检查表（P5-04，对照 spec.md 第 5 章验收条目逐项核对）

| spec 条目 | 验收要求 | 文档落点 | 勾选 |
|---|---|---|---|
| 5.1.1-1 | Electron 目标版本号+维护状态+查询日期 | 第 3 章 D1（45.3.2，2026-11-14） | [x] |
| 5.1.1-2 | engines.node 目标值与对应说明 | 第 3 章 D2（">=22"+校验规则） | [x] |
| 5.1.1-3 | AngularJS 双路线对比+唯一推荐+确认栏 | 第 3 章 D3 | [x] |
| 5.1.1-4 | 废弃依赖全覆盖（spec 点名 10 项） | 第 8 章 56 包对照表 | [x] |
| 5.1.1-5 | E2E 与单测选型及理由 | 第 3 章 D5 | [x] |
| 5.1.1-6 | 打包选型+三平台验证 | 第 3 章 D6、第 4 章 4.6 | [x] |
| 5.1.1-7 | 范围排除项列表 | 第 2 章 2.2（7 项） | [x] |
| 5.2.1-1 | 六阶段划分且顺序符合依赖关系 | 第 4 章 4.1-4.6 | [x] |
| 5.2.1-2 | 每阶段完成标准 ≥3 条绑定验证 | 第 4 章各阶段 acceptance（A1-A4） | [x] |
| 5.2.1-3 | 显式门禁条款阻止跳阶段 | 第 4 章各阶段门禁块+10.1.2 模板 | [x] |
| 5.2.1-4 | 任务六要素完整 | 第 5 章 55 条任务（P5-02 自检通过） | [x] |
| 5.2.1-5 | Electron 升级五项专项拆解 | 5.3 小节 P2-06/P2-08/P2-05/P2-11/P2-12 | [x] |
| 5.3.1-1 | 冒烟九项清单+验证方式 | 第 9 章 9.1 | [x] |
| 5.3.1-2 | 平台验证条目+三平台覆盖计划 | 第 9 章 9.2 | [x] |
| 5.3.1-3 | 现有测试处置条目（禁静默删除） | 第 9 章 9.3、5.1 小节 P0-03/05/06 | [x] |
| 5.3.1-4 | 冲突处理规则（显式开关） | 第 9 章 9.4（D7 开关） | [x] |
| 5.4.1-1 | 风险字段完整+六项高风险在列 | 第 6 章 R-01~R-09 | [x] |
| 5.4.1-2 | 回滚命令序列（git+依赖恢复） | 第 7 章 7.1-7.3 | [x] |
| 5.4.1-3 | 阶段开头风险编号引用 | 第 4 章各阶段 risks 字段 | [x] |
| 5.4.1-4 | 基线兜底路径 | 第 7 章 7.3（git checkout rollback/P0-baseline） | [x] |
| 5.5.1-1 | docs/ 交付+头部信息完整 | 文档头部（版本/日期/基线仓库信息） | [x] |
| 5.5.1-2 | ≥10 条验证命令实测通过 | 抽验记录表 12 条 | [x] |
| 5.5.1-3 | 不可判定用语零命中 | P5-01 自检（全文 0 命中） | [x] |
| 5.5.1-4 | 状态标记可更新+含义说明 | 10.1.1 五态表+10.2 总表 | [x] |
| 5.5.1-5 | 文档自包含（三问可答） | 第 1 章基线表+第 4 章总览+10.2 总表 | [x] |
| 5.5.1-6 | 三类核心数据表格化 | 第 5/8/6 章均为表格/结构化列表 | [x] |

## 11. 后续增强建议

以下条目不纳入本次升级验收范围：

- **contextIsolation/contextBridge 改造**：渲染层 9+ 文件脱离 Node API 依赖（app/index.html:10-23 的 require path/os/fs/request 等），按 Electron 官方安全清单将 nodeIntegration 收紧为 false、contextIsolation 开启，经 contextBridge 暴露白名单 API。
- **AngularJS 框架迁移立项（路线 B）**：D3 对比表中路线 B（React/Vue 重写）作为独立项目立项评估，与本次升级解耦。
- **dayjs 替换 moment**：moment 2.31.0 为维护态终版，dayjs 体积更小，作为独立增强项。
- **codemirror 6 迁移**：6.x 为模块化重写，需同步替换 angular-ui-codemirror（无官方新版），随前端框架现代化一并评估。
- **大版本升级批次**：jquery 4.0.0、nodemailer 7+、koa 3.x、npm-run-all2（替代 npm-run-all）、@fortawesome/fontawesome-free 7.x 图标体系。
- **app/ 业务代码深度重构**：含 IPC 通道语义化命名、server.js/SMTP 架构现代化、node/ 子项目（ossstore、crc64）测试体系（mocha/should）现代化。

> 交付说明附注：本文档为升级执行阶段的唯一执行依据，实际升级操作由后续执行按第 5 章任务清单进行；本文档编写周期内不执行任何升级动作。D1/D3/D5/D6 确认栏未经技术负责人签署前，第 4 章对应阶段门禁保持关闭，此为预期初始状态而非交付缺陷。