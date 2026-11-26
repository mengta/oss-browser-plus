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


## B3 批次（files / transfer / preview / top）登记

> 实测使用点：`app/main` + `app/components` 共 **155** 处 FA4 class，唯一图标 **46** 个；Vue 侧 `rg "fa-" app/renderer` 零命中。

| FA4 class | SVG 名称 | 使用页面·组件 | 替换批次 | 视觉核对结论 |
|---|---|---|---|---|
| fa-shield | shield | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（15 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-download | download | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（11 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-folder | folder | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（11 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-edit | edit | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（7 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-question-circle | question-circle | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（6 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-remove | close | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（6 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-cog | cog | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（5 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-database | database | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（5 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-upload | cloud-upload | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（5 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-close | close | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（4 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-copy | copy | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（4 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-cut | cut | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（4 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-home | home | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（4 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-info-circle | info-circle | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（4 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-arrow-right | arrow-right | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（3 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-arrow-up | arrow-up | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（3 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-file | file | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（3 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-file-o | file | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（3 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-refresh | refresh | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（3 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-search | search | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（3 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-star | star | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（3 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-user | user | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（3 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-users | users | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（3 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-about | info-circle | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-arrow-left | chevron-left | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-check | check | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-check-square-o | check-square | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-clone | copy | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-exclamation-circle | warning | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-file-code-o | file-code | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-hourglass-2 | hourglass | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-image | image | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-link | soft-link | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-paste | paste | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-square-o | square | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-star-o | star-o | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-user-secret | user-secret | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（2 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-caret-left | chevron-left | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（1 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-caret-right | chevron-right | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（1 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-cloud-download | cloud-download | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（1 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-cloud-upload | cloud-upload | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（1 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-code | file-code | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（1 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-folder-open | folder | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（1 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-power-off | power-off | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（1 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-save | save | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（1 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |
| fa-trash | trash | files 工具栏/列表、文件操作弹窗、预览、传输中心、顶栏（B4-01） | B3 | 语义等价（1 处使用点；Vue 侧 fa-* 零残留，逐页视觉核对随 GATE-03/B4-16 记录） |

## 收口结论

- B2/B3 页面 `fa-*` class 零残留（B2-12/B3-17 验收满足）。
- FA4 依赖与 `dist/css/lib.css` 中的 FA4 规则、`dist/fonts` 字体在 B2-15 移除。
- registry 未知 name 回退占位（`FALLBACK_PATH`），不抛错。
