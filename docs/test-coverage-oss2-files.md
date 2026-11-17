# oss2/files 测试覆盖执行记录（TC- 系列）

> 上游依据：`.codeartsdoer/specs/oss2-files-coverage/{spec,design,tasks}.md`
> 质量基线：`npm test` 148 用例全绿 → 批次一（oss2.test.mjs）+ 批次二（files.test.mjs）后终态 ≥208。
> 硬约束：零真实网络（假凭证 LTAI5tFake/sk/tok-*）；`app/` 与 `test/helpers/**` 零变更；疑似缺陷只锁定当前行为并登记、不修业务代码。

## TC-01 批次一收口（ossSvs2）

- 单文件 `npx ava test/unit/components/services/oss2.test.mjs`：69 tests passed（冒烟 1 + 纯逻辑 20 + 删除编排 12 + 复制编排 11 + 碎片 3 + 构造器 3 + P1 薄包装/列表域名/saveContent 19）
- lint 零错误：`npm run lint` EXIT=0
- 全量回归：`npm test` 不倒退（GATE 执行记录见下方）
- git 边界核对：`app/` 与 `test/helpers/*` 零变更（新增 oss2.test.mjs 除外）

## TC-02 批次二收口（filesCtrl）

- 单文件 `npx ava test/unit/main/files/files.test.mjs`：**29 tests passed / 2461ms（G1 ≤15s）**——冒烟 2 + canSetHeader filter 3 + 选择族 6 + 事件族 9 + 列表族 4 + 状态/下载族 2 + P1 模态抽查 3（规划 29 / 底线 ≥20）
- lint 零错误：`npm run lint` EXIT=0（G2）
- 全量回归：`npm test` **246 tests passed**（148 基线 + 批次一 69 + 批次二 29），EXIT=0（G3）
- git 边界核对：仅新增 files.test.mjs；`app/` 与 `test/helpers/*` 零变更（G4）

## 疑似缺陷登记（4+2 处候选——只锁定当前行为，不修业务代码；修复时须同步更新锚定用例）

| # | 位置 | 现象 | 锚定用例 |
|---|---|---|---|
| 候选① | oss2.js:255-259 | deleteFiles 的 rejected 汇聚：数组 reason concat 后又 push 数组本身。实测（stop+1folder+2files 场景）rejected.len=1（folder reject 对象 1 项；files 通道因 stop 置位晚于同步调用而 fulfilled）——**与 design 预期 len=3 不符**，实际形态已探针登记 | deleteFiles 候选①探针（t.pass 登记式） |
| 候选② | oss2.js:401 | deleteMultiFiles 的 errorCount 误用全量 files.length 而非失败分片长度（1001 key 双分片、第 2 分片失败 → errorCount=1001） | deleteMultiFiles 候选②锚定 |
| 候选③ | oss2.js:1978-2032 | getOssUrl 未导出死代码（全仓无调用方），无法构造测试入口——仅登记，无锁定用例 | —（不可锁定） |
| 候选④ | oss2.js:1209 | saveContent 的 `data[k]` 未定义引用（tagging 非空 tag 时触发）——测试以空 tag `{}` 规避 | saveContent（tag 空规避） |
| 候选⑤ | oss2.js:336-339 | deleteFolder 的 deleteMulti 失败路径 catch 只累计 errorCount 不检查 resolve 条件 → **永不 resolve（挂起）**。用例以 Promise.race 锁定挂起行为 | deleteFolder 候选⑤锚定（race 300ms） |
| 候选⑥ | oss2.js:1894+837 | handleError 返回 Promise.reject(err) 而 moveFile 调用后未消费 → unhandledRejection。测试进程级静默（removeAllListeners+空处理器） | moveFile 失败用例（进程级静默） |
| 候选③次序 | oss2.js:2120 | listUsableAccelarateDomains 第 3 次 list 的 Error 经 `catch(() => [])` 转为 **resolve([])（非 reject）**——实测 d3=[] | listUsableAccelarateDomains 第 3 次锚定 |

## 替身策略关键决策（执行期确认记录）

| # | 决策 | 实测确认 |
|---|---|---|
| D-01 | package.json 注入走 resolve 层补丁重定向（方案 A）：require-cache 替身对"解析目标不存在"的文件天然无效（Module._resolveFilename 先于 cache 查询抛 MODULE_NOT_FOUND） | USER_AGENT `9.9.9-test` 动态拼接断言通过 |
| D-02 | platform 真实加载不替身 | getClient2 userAgent 动态拼接断言通过 |
| D-03 | ali-oss 双入口分注（`ali-oss` / `ali-oss/dist/aliyun-oss-sdk`），注入先于 reg.load | FakeAliOss/FakeSdkOss 各通道命中 |
| D-04 | global.ALY 升级纳入替身（util.xUserAgent spy + OSS 构造），setup 赋值 teardown 还原 | getClient 通道 xUserAgent 覆写断言通过 |
| D-06 | $timeout 替身：pending 队列 + flushAll 循环出队 + cancel + **1000 轮上限防死循环** | 删除/复制编排 dig 链全量驱动，未触上限 |
| D-07 | 批次二走 invokeController 模式（angular-stub，13 项 locals 全量；global.os/stubLocalStorage 构造期前置） | filesCtrl 构造 + init/addEvents 链路就绪（files.js:46/57） |
| D-08 | 批次解耦：files.test.mjs 不加载真实 oss2.js，ossSvs2 用手工 spy（录制参数回放 Promise，支持 listFilesError 失败注入） | 29 例零真实网络、加载链稳定 |
| 行为锚点 | files.js:5 canSetHeader 短路链返回短路操作数原值（空数组 → 0、缺 has → undefined），非布尔——falsy 语义与模板一致，按实测锚定，**非缺陷不登记候选** | filter 空选择用例（t.is 0 / t.true !undefined） |

## 终态收口

- `npm test` 全量 **246 tests passed**（148 + 69 + 29，≥208 达标），EXIT=0
- `npm run lint` 零错误，EXIT=0
- git 终态核对：交付物为 `test/unit/components/services/oss2.test.mjs`（批次一，已随 caf0a87 提交）、`test/unit/main/files/files.test.mjs`（批次二新增）、本文档（TC-02 补录 + 替身决策节补齐）；`app/` 与 `test/helpers/*` 零变更