# E2E 测试说明（Playwright _electron）

> 冒烟九项用例（smoke-01~09）对应升级文档第 9 章核心功能冒烟清单；选择器常量表见 `helpers/selectors.js`。

## 运行前置

1. 构建产物就位：`npm run build`（globalSetup 会检查 dist/main.js，缺失时报错并提示先构建）
2. Playwright 已随 devDependencies 安装（`@playwright/test`）

## 凭证注入方法（环境变量，禁止写入任何文件）

无凭证运行时，凭证依赖用例自动 skipped 且套件退出码 0（降级策略）；注入后按全自动执行。

| 环境变量 | 用途 | 必填 |
|---|---|---|
| OSS_E2E_AK | OSS AccessKeyId | smoke-01/02/03/04/05/07 必填 |
| OSS_E2E_SK | OSS AccessKeySecret | 同上 |
| OSS_E2E_REGION | 地域（默认 oss-cn-hangzhou） | 可选 |
| OSS_E2E_BUCKET | 测试专用 Bucket 名 | 必填 |
| OSS_E2E_FOLDER | 测试目录（默认 e2e-test-folder） | 可选 |
| SMTP_E2E_HOST | SMTP 服务器 | smoke-07 必填 |
| SMTP_E2E_PORT | 端口（默认 465） | 可选 |
| SMTP_E2E_USER | SMTP 用户名 | smoke-07 必填 |
| SMTP_E2E_PASS | SMTP 密码 | smoke-07 必填 |
| SMTP_E2E_FROM | 发件人（默认同 USER） | 可选 |
| SMTP_E2E_TO | 收件人（默认同 FROM） | 可选 |

git-bash 注入示例：

```bash
export OSS_E2E_AK=xxx OSS_E2E_SK=xxx OSS_E2E_BUCKET=my-test-bucket && npx playwright test
```

## 运行

```bash
npx playwright test              # 全量（无凭证时自动降级 skipped）
npx playwright test smoke-06     # 单项（无凭证依赖用例可直接跑）
npx playwright test --list       # 列出全部用例不执行
```

## 半自动项人工步骤说明

以下断言链中无法全自动的部分（对应升级文档第 9 章"半自动"分级），按步骤人工核对：

### smoke-03 上传/下载（含断点续传）
1. `npx playwright test smoke-03` 完成上传/下载全自动部分；
2. 断点续传人工步骤：上传大文件（>10MB 触发分片）过程中点击任务"停止"→ 重新"启动"同一任务 → 观察任务从 checkpoint 续传（已上传分片不重传）直至完成；
3. 分片计算/断点集合/进度状态已由 `test/unit/ossstore/upload-job.test.mjs`、`download-job.test.mjs` 单测全自动覆盖。

### smoke-05 ACL/STS
1. `npx playwright test smoke-05` 完成右键菜单语义可达性验证；
2. ACL 人工步骤：右键 Bucket/对象 → 设置 ACL（私有/公共读/公共读写）→ 保存 → 重新打开核对回显；
3. STS 人工步骤：右键"授权"→ 生成 readOnly 授权链接 → 以第三方浏览器（未登录态）打开链接核对受限访问生效；
4. 策略组装逻辑已由 `test/unit/components/services/sts.test.js` 单测覆盖。

### smoke-07 SMTP
1. 注入 SMTP_E2E_* 凭证后 `npx playwright test smoke-07` 完成表单打开/定位全自动部分；
2. 人工步骤：设置页填写 SMTP 表单 → 保存 → 点击"发送测试邮件" → 登录收件邮箱核对收到测试邮件。

### smoke-08 自定义构建
1. 先执行打包（如 `make win64`）再 `npx playwright test smoke-08` 完成产物 resources/custom 字段一致性断言；
2. 人工步骤：启动打包产物 exe → 核对窗口标题与图标为 custom/ 中自定义值（title/logo 生效核对）。

### smoke-09 release-notes
全自动部分：静态服务 release-notes.md HTTP 200 且非空；关于弹窗 markdown 渲染视觉为人工抽查项（归入 P3 人工冒烟清单）。

## Linux CI 注意事项

Linux 无显示环境（CI）需 xvfb：`xvfb-run npx playwright test`（仅记录，未在本次范围内实施 CI 配置）。