# TM-B0：ESLint 7 基线快照（工具链现代化 · 批次零）

> 上游依据：`.codeartsdoer/specs/toolchain-modernization/tasks.md` 任务 1.2/1.3/1.4、design 2.1.3-（3）权威对齐法。
> 用途：批次一（ESLint 9 flat config 迁移）完成后，以 `--print-config` 快照 diff 对齐验证新旧配置等效性（本目录为 golden 权威基线，**迁移前采集，迁移后不得修改本目录内容**）。

## 采集环境（2026-11-16）

- OS：Windows 11 / git-bash
- Node：`v24.11.0`；npm：`11.6.1`
- eslint：`7.32.0`（迁移前版本，`npm ls eslint --depth=0` 实测）
- 配置：`.eslintrc.json`（94 行：extends `@alicloud/eslint-config/es5`、parser `babel-eslint`、35 条规则显式置 0 + `semi: 2`）
- 仓库状态：main（v1.20.5 之后、工具链现代化改动提交前），工作区干净

## 采集命令（原文）

```bash
npx eslint --print-config app/index.js > docs/upgrade-snapshots/TM-B0/eslint-baseline-app.json
npx eslint --print-config test/import-config-parser.mjs > docs/upgrade-snapshots/TM-B0/eslint-baseline-test.json
```

## 复现验证（迁移前 ESLint 7 环境执行，diff 为空即可复现）

```bash
npx eslint --print-config app/index.js | diff - docs/upgrade-snapshots/TM-B0/eslint-baseline-app.json && echo SNAPSHOT-REPRODUCIBLE-APP
npx eslint --print-config test/import-config-parser.mjs | diff - docs/upgrade-snapshots/TM-B0/eslint-baseline-test.json && echo SNAPSHOT-REPRODUCIBLE-TEST
```

## 2026-11-16 实测结果

- `APP-EXIT=0` / `TEST-EXIT=0`；两份快照均非空（含 `parser` / `rules` / `env` / `globals` 键）
- 复现验证：`SNAPSHOT-REPRODUCIBLE-APP` 与 `SNAPSHOT-REPRODUCIBLE-TEST` 均输出（重跑 diff 为空）
- app 域快照要点：`parser = babel-eslint`（**含本机绝对路径**，见下方注意事项）；`rules` 共 **214 条**最终生效规则（@alicloud/es5 基线合并 35 条置 0 豁免与 `semi`）；`env`/`globals` 在位
- test 域快照要点：overrides 语义生效——`ecmaVersion 2022` / `sourceType module` / **20 个 test globals**

## 跨机复现注意事项

快照为 `--print-config` 原始输出，其中 `parser` 字段含**本机绝对路径**
（`E:\workspace\oss-browser-plus-develop\node_modules\babel-eslint\lib\index.js`）。
跨机复现 diff 时需对路径字段做归一化（或仅比对相对键：`rules` / `env` / `globals` / `parserOptions`），
同机同路径复现则无需处理（本机已验证 diff 为空）。