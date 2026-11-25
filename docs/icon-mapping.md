# 图标对照表（Q-05：FA4 → 内联 SVG）

> 表头五列（tasks.md B2-11）：FA4 class / SVG 名称 / 使用页面·组件 / 替换批次 / 视觉核对结论。
> 资产来源：`app/renderer/icons/registry.js`（内联 SVG path 单一来源）+ `app/renderer/assets/icons/*.svg`。

| FA4 class | SVG 名称 | 使用页面·组件 | 替换批次 | 视觉核对结论 |
|---|---|---|---|---|
| fa.fa-question-circle | question-circle | LoginPage / CredentialForm / AuthTokenForm（帮助与提示入口） | B1 | 与迁移前一致（B1-21 逐页截图核对通过） |
| fa.fa-cloud-download | cloud-download | LoginPage（导入/下载入口） | B1 | 与迁移前一致 |
| fa.fa-eye / fa.fa-eye-slash | eye / eye-slash | CredentialForm（密码/Secret 显隐切换） | B1 | 与迁移前一致 |
| fa.fa-warning | warning | auth 错误提示与 ToastHost | B1 | 与迁移前一致 |
| fa.fa-check | check | ToastHost 成功提示 | B1 | 与迁移前一致 |
| fa.fa-trash | trash | AkHistoriesPanel（历史删除） | B1 | 与迁移前一致 |
| fa.fa-search | search | ImportConfigPanel / 搜索输入基座 | B1 | 与迁移前一致 |
| fa.fa-inbox | inbox | EmptyState 空态图标 | B1 | 与迁移前一致 |
| fa.fa-history | history | AkHistoriesPanel（AK 历史标题） | B1 | 与迁移前一致 |

## B2 批次（modals / editors）登记

| FA4 class | SVG 名称 | 使用页面·组件 | 替换批次 | 视觉核对结论 |
|---|---|---|---|---|
| —（无使用点） | — | SettingsModal / UsersModal / UserAkModal / UserUpdateModal / AboutModal / FavListModal / UpdateAclModal / UpdateHttpHeadersModal / DiffModal / editors/*（AclEditor / HttpHeadersEditor / PolicyEditor） | B2 | B2 全部弹窗为表单类布局，迁移前 Angular 版图标仅为标题装饰（fa-cog / fa-shield / fa-sheild / fa-plus / fa-plus-square 等），Vue 版统一以标题文本承载，无信息丢失；`rg "fa-" app/renderer/` 零命中；无缺失图标 |

## 收口结论

- B2 页面 `fa-*` class 零残留（B2-12 验收满足）。
- FA4 依赖与 `dist/css/lib.css` 中的 FA4 规则、`dist/fonts` 字体在 B2-15 移除。
- registry 未知 name 回退占位（`FALLBACK_PATH`），不抛错。
