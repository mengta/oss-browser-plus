# Vue3 能力等价映射表（spec 6.5 / T-V3-P0-23）

> 字段：编号 / 名称 / 当前实现 / 目标实现（Vue 3）/ 状态（待实施|实施中|已完成|已验收）。P0 阶段仅建立骨架，逐项状态随 B1~B4 更新。

## 页面模块（5）

| 编号 | 名称 | 当前实现 | 目标实现（Vue 3） | 状态 |
|---|---|---|---|---|
| M-01 | _ | app/main/_ | 路由/页面模块（批次待定） | 待实施 |
| M-02 | auth | app/main/auth | 路由/页面模块（批次待定） | 待实施 |
| M-03 | files | app/main/files | 路由/页面模块（批次待定） | 待实施 |
| M-04 | modals | app/main/modals | 路由/页面模块（批次待定） | 待实施 |
| M-05 | main | app/main/main | 路由/页面模块（批次待定） | 待实施 |

## 指令（14）

| 编号 | 名称 | 当前实现 | 目标实现（Vue 3） | 状态 |
|---|---|---|---|---|
| D-01 | auto-height | app/components/directives/auto-height.js | 组件/组合式函数 | 待实施 |
| D-02 | bottom-loader | app/components/directives/bottom-loader.js | 组件/组合式函数 | 待实施 |
| D-03 | cleanable-input | app/components/directives/cleanable-input.js | 组件/组合式函数 | 待实施 |
| D-04 | clipboard-button | app/components/directives/clipboard-button.js | 组件/组合式函数 | 待实施 |
| D-05 | drop-zone | app/components/directives/drop-zone.js | 组件/组合式函数 | 待实施 |
| D-06 | file-dialog-button | app/components/directives/file-dialog-button.js | 组件/组合式函数 | 待实施 |
| D-07 | flv-player | app/components/directives/flv-player.js | 组件/组合式函数 | 待实施 |
| D-08 | is-loading | app/components/directives/is-loading.js | 组件/组合式函数 | 待实施 |
| D-09 | long-scroll-list | app/components/directives/long-scroll-list.js | 组件/组合式函数 | 待实施 |
| D-10 | my-timer | app/components/directives/my-timer.js | 组件/组合式函数 | 待实施 |
| D-11 | no-data | app/components/directives/no-data.js | 组件/组合式函数 | 待实施 |
| D-12 | oss-file-selector | app/components/directives/oss-file-selector.js | 组件/组合式函数 | 待实施 |
| D-13 | qrcode | app/components/directives/qrcode.js | 组件/组合式函数 | 待实施 |
| D-14 | toast-list | app/components/directives/toast-list.js | 组件/组合式函数 | 待实施 |

## 服务（28）

| 编号 | 名称 | 当前实现 | 目标实现（Vue 3） | 状态 |
|---|---|---|---|---|
| S-01 | auth | app/components/services/auth.js | Pinia/composable/白名单封装 | 待实施 |
| S-02 | authinfo | app/components/services/authinfo.js | Pinia/composable/白名单封装 | 待实施 |
| S-03 | auto-upgrade | app/components/services/auto-upgrade.js | Pinia/composable/白名单封装 | 待实施 |
| S-04 | base-http | app/components/services/base-http.js | Pinia/composable/白名单封装 | 待实施 |
| S-05 | cipher | app/components/services/cipher.js | Pinia/composable/白名单封装 | 待实施 |
| S-06 | delay-done | app/components/services/delay-done.js | Pinia/composable/白名单封装 | 待实施 |
| S-07 | dialog.s | app/components/services/dialog.s.js | Pinia/composable/白名单封装 | 待实施 |
| S-08 | diff-modal | app/components/services/diff-modal.js | Pinia/composable/白名单封装 | 待实施 |
| S-09 | fav | app/components/services/fav.js | Pinia/composable/白名单封装 | 待实施 |
| S-10 | file.s | app/components/services/file.s.js | Pinia/composable/白名单封装 | 待实施 |
| S-11 | i18n | app/components/services/i18n.js | Pinia/composable/白名单封装 | 待实施 |
| S-12 | index-db | app/components/services/index-db.js | Pinia/composable/白名单封装 | 待实施 |
| S-13 | job-util | app/components/services/job-util.js | Pinia/composable/白名单封装 | 待实施 |
| S-14 | mailer | app/components/services/mailer.js | Pinia/composable/白名单封装 | 待实施 |
| S-15 | oss-download-manager | app/components/services/oss-download-manager.js | Pinia/composable/白名单封装 | 待实施 |
| S-16 | oss-upload-manager | app/components/services/oss-upload-manager.js | Pinia/composable/白名单封装 | 待实施 |
| S-17 | oss2 | app/components/services/oss2.js | Pinia/composable/白名单封装 | 待实施 |
| S-18 | prog-naming | app/components/services/prog-naming.js | Pinia/composable/白名单封装 | 待实施 |
| S-19 | project | app/components/services/project.js | Pinia/composable/白名单封装 | 待实施 |
| S-20 | ram | app/components/services/ram.js | Pinia/composable/白名单封装 | 待实施 |
| S-21 | safe-apply | app/components/services/safe-apply.js | Pinia/composable/白名单封装 | 待实施 |
| S-22 | safe-storage-client | app/components/services/safe-storage-client.js | Pinia/composable/白名单封装 | 待实施 |
| S-23 | secure-store | app/components/services/secure-store.js | Pinia/composable/白名单封装 | 待实施 |
| S-24 | settings | app/components/services/settings.js | Pinia/composable/白名单封装 | 待实施 |
| S-25 | sts | app/components/services/sts.js | Pinia/composable/白名单封装 | 待实施 |
| S-26 | sub-user-ak | app/components/services/sub-user-ak.js | Pinia/composable/白名单封装 | 待实施 |
| S-27 | upgrade | app/components/services/upgrade.js | Pinia/composable/白名单封装 | 待实施 |
| S-28 | util | app/components/services/util.js | Pinia/composable/白名单封装 | 待实施 |

## 过滤器（2）

| 编号 | 名称 | 当前实现 | 目标实现（Vue 3） | 状态 |
|---|---|---|---|---|
| F-01 | formater | app/components/filters/formater.js | Vue 方法/格式化函数 | 待实施 |
| F-02 | list-filter | app/components/filters/list-filter.js | Vue 方法/格式化函数 | 待实施 |
