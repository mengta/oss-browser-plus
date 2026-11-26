'use strict';

// P5-01 E03：稳定语义选择器常量表（R-10 缓解落点，design 1.2.2 资产迁移）
// 原则：优先稳定语义属性（ng-click/ng-model/name/placeholder/uib-tooltip 等框架绑定与表单语义），
// 禁止依赖升级中易变的样式类名或 DOM 顺序；选择器失效时单点修订常量值而非散改用例。
// DOM 顺序/文本型旧 spectron 选择器（span=BUCKET、div.item-block-name=...）已改写为
// Playwright getByText/locator 语义等价形式。

module.exports = {
  // 窗口/品牌
  navbarBrand: '.navbar-brand',
  navbarBrandText: 'OSS浏览器',

  // 登录/顶栏（B1/B4-01 起由 Vue 承载）
  loginId: '[data-testid="login-id"]',
  loginSecret: '[data-testid="login-secret"]',
  loginSubmit: '[data-testid="login-submit"]',
  logoutBtn: '[data-testid="topbar-logout"]',
  logoutConfirm: '[data-testid="dialog-ok"]',
  langSettings: '[data-testid="topbar-lang"]',

  // 视图切换（B3-20：Vue ListViewOptions）
  setListView: '[data-testid="view-list"]',
  setBlockView: '[data-testid="view-blocks"]',

  // Bucket 搜索与导航（B3-20：Vue 地址栏/桶工具栏）
  bucketSearch: '[data-testid="bucket-search"]',
  goUp: '[data-testid="address-go-up"]',
  addressUrl: '[data-testid="address-input"]',

  // 对象操作（B3-20：Vue 工具栏/弹窗/右键菜单）
  createFolderBtn: '[data-testid="file-mkdir"]',
  folderNameInput: '[data-testid="add-folder-name"]',
  modalOk: '[data-testid="add-folder-submit"]',
  modalClose: '[data-testid="delete-files-close"]',
  deleteMenuItem: '[data-testid="ctx-delete"]',
  dangerConfirm: '[data-testid="delete-files-confirm"]',
  alertSuccess: '[data-testid="toast-success"]',

  // 上传（等价原版 mock.uploads 调试入口，Vue FilesPage 提供同名 ng-model 属性）
  uploadInput: '[ng-model="mock.uploads"]',

  // B2 迁移弹窗（Vue 承载，data-testid 见各 SFC；入口按钮属 top 栏 Angular，B4 迁移时改写）
  settingsModal: '[data-testid="settings-modal"]',
  settingsClose: '[data-testid="settings-close"]',
  settingsSmtpHost: '[data-testid="settings-smtp-host"]',
  settingsSmtpFrom: '[data-testid="settings-smtp-from"]',
  settingsSmtpTest: '[data-testid="settings-smtp-test"]',
  aboutModal: '[data-testid="about-modal"]',
  favListModal: '[data-testid="fav-modal"]',
  usersModal: '[data-testid="users-modal"]',
  updateAclModal: '[data-testid="acl-editor"]',
  updateHttpHeadersModal: '[data-testid="http-headers-editor"]',
  diffModal: '[data-testid="diff-editor"]',

  // 文本语义定位辅助（替代 spectron span=/div.item-block= 文本选择器）
  bucketByName: (name) => `[data-testid="bucket-table"] a:text-is("${name}")`,
  blockItemByName: (name) => `[data-testid="file-card"] .card-name:text-is("${name}")`,
  blockItem: (name) => `[data-testid="file-card"]:has-text("${name}")`,
};