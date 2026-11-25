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

  // 登录表单（B1-18 起由 Vue 承载：app/renderer/pages/LoginPage.vue + CredentialForm.vue）
  // loginId/loginSecret/loginSubmit 改为 data-testid；logout/langSettings 仍由 Angular 顶部栏承载（B4 迁移）
  loginId: '[data-testid="login-id"]',
  loginSecret: '[data-testid="login-secret"]',
  loginSubmit: '[data-testid="login-submit"]',
  logoutBtn: '[ng-click="logout()"]',
  logoutConfirm: 'button[ng-click="ok()"]',
  langSettings: '[ng-model="langSettings.lang"]',

  // 视图切换
  setListView: '[ng-click="setListView(true)"]',
  setBlockView: '[ng-click="setListView(false)"]',

  // Bucket 搜索与导航
  bucketSearch: '[placeholder="Bucket名称"]',
  goUp: '[uib-tooltip="上一级"]',
  addressUrl: '.address-url',

  // 对象操作（右键菜单/模态框）
  createFolderBtn: 'button:has-text("创建目录")',
  folderNameInput: 'form[name=form1] #name1',
  modalOk: 'button:has-text("确定")',
  modalClose: 'button:has-text("关闭")',
  deleteMenuItem: 'a.dropdown-item:has-text("删除")',
  dangerConfirm: '.btn-danger:has-text("确定")',
  alertSuccess: '.alert:has-text("创建目录成功")',

  // 上传（input[type=file] 注入）
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
  bucketByName: (name) => `span:text-is("${name}")`,
  blockItemByName: (name) => `div.item-block-name:text-is("${name}")`,
  blockItem: (name) => `div.item-block:has-text("${name}")`,
};