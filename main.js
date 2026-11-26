// TLS 显式开关（D7）：默认关闭走系统证书校验；OSS_BROWSER_ALLOW_INSECURE_TLS=1 开启（Apsara Stack 自签证书场景）
// 赋值时序：必须保持在 require("electron") 之前
var ALLOW_INSECURE_TLS = process.env.OSS_BROWSER_ALLOW_INSECURE_TLS == "1";
if (ALLOW_INSECURE_TLS) {
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
}

var electron = require("electron");
// Module to control application life.

var app = electron.app;
var Menu = electron.Menu;
var ipcMain = electron.ipcMain;
var dialog = electron.dialog;
var BrowserWindow = electron.BrowserWindow;

var fs = require("fs");
var os = require("os");
var path = require("path");
var nativeImage = require("electron").nativeImage;

// P4（R-P4-02/03/06）：统一日志模块（info+ 落盘、5MB×5、7 天、脱敏），禁止 silent
var loggerModule = require("./node/lib/logger");
var log = loggerModule.logger("main");
loggerModule.init({
  fileLevel: "info",
  consoleLevel: process.env.NODE_ENV === "production" ? "warn" : "info",
});

if (ALLOW_INSECURE_TLS) {
  // 审计日志（D7）：开关开启时输出
  log.info("app.tls_insecure", "OSS_BROWSER_ALLOW_INSECURE_TLS=1 enabled", {
    at: new Date().toISOString(),
  });
}

///*****************************************
// 静态服务（P4/R-P4-01）：Promise 化逐端口尝试；失败不阻塞建窗，端口查询返回 UNAVAILABLE
var PORTS = [7123, 7124, 7125, 7126];
var staticServer = require("./node/capabilities/static-server");
var staticServerReady = staticServer.start(PORTS).catch(function (err) {
  log.error("port.unavailable", "static server unavailable", {
    code: err && err.code,
    portErrors: err && err.portErrors,
  });
  return 0;
});

if (ALLOW_INSECURE_TLS) {
  // 自签证书支持（仅开关开启时）
  app.commandLine.appendSwitch("ignore-certificate-errors");
}
///*****************************************

var custom = {};

try {
  custom = require(path.join(__dirname, "../custom"));
} catch (e) {
  log.debug("custom.missing", "no custom module");
}
//let logo = nativeImage.createFromPath('icons/logo.ico');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var win;

if (process.platform == "darwin") {
  app.dock.setIcon(
    custom.logo_png || path.join(__dirname, "icons", "icon.png")
  );
}

function createWindow() {
  var opt = {
    width: 1221,
    height: 700,
    minWidth: 1020,
    minHeight: 660,
    title: custom.title || "OSS Browser",
    icon: custom.logo_ico || path.join(__dirname, "icons", "icon.ico"),

    webPreferences: {
      // P3（R-P3-05）：禁用插件；渲染层能力统一经 preload 白名单
      plugins: false,
      // Vue3-P0-01/03 阶段 0：渲染层 Node 能力改由 preload 白名单承载；sandbox 定稿 false（P0-02 实验见 ledger §A.2）
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  };

  if (process.platform == "linux") {
    opt.icon = custom.logo_png || path.join(__dirname, "icons", "icon.png");
  }

  // VS Code 风格标题栏：Windows/Linux 去掉系统外框，由渲染层自绘窗口控制按钮；
  // macOS 保留交通灯（hiddenInset），顶栏左侧留出避让空间。
  if (process.platform == "darwin") {
    opt.titleBarStyle = "hiddenInset";
  } else {
    opt.frame = false;
  }

  // Create the browser window.   http://electron.atom.io/docs/api/browser-window/
  win = new BrowserWindow(opt);

  win.setTitle(custom.title || "OSS Browser");

  // P3（R-P3-05）：导航 / 新窗口 / webview / 权限请求收紧
  var appRoot = path.resolve(__dirname);
  win.webContents.on("will-navigate", function (event, url) {
    var localPath = "";
    try {
      localPath = require("url").fileURLToPath(String(url || ""));
    } catch (err) {
      localPath = "";
    }
    var isLocal = !!localPath && path.resolve(localPath).indexOf(appRoot) === 0;
    if (!isLocal) {
      event.preventDefault();
      log.warn("security.navigation_blocked", "blocked navigation", { url: String(url || "") });
    }
  });
  win.webContents.setWindowOpenHandler(function (details) {
    var target = String((details && details.url) || "");
    if (/^https?:/i.test(target)) {
      electron.shell.openExternal(target);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-attach-webview", function (event) {
    event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler(function (webContents, permission, callback) {
    log.warn("security.permission_denied", "permission request denied", { permission: permission });
    callback(false);
  });

  win.loadURL(`file://${__dirname}/index.html`);

  win.setMenuBarVisibility(false);

  // 自绘标题栏：最大化状态变化时通知渲染层切换图标
  var notifyMaximized = function () {
    if (!win || win.isDestroyed()) return;
    win.webContents.send("window:maximized-changed", win.isMaximized());
  };
  win.on("maximize", notifyMaximized);
  win.on("unmaximize", notifyMaximized);

  // Emitted when the window is closed.
  win.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  // drawin 就是 MacOS
  if (process.env.NODE_ENV == "development") {
    log.debug("app.dev_mode", "development mode");

    // Open the DevTools.
    win.webContents.openDevTools();
  } else {
    if (process.platform === "darwin") {
      // Create the Application's main menu
      var template = getMenuTemplate();
      //注册菜单, 打包后可以复制, 但是不能打开 devTools
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
  }
}

//监听web page里发出的message（每消息一通道 invoke/handle，D8 改造）
ipcMain.handle("app:get-static-server-port", () => {
  var activePort = staticServer.current();
  if (!activePort) {
    var err = new Error("static server unavailable");
    err.code = "UNAVAILABLE";
    throw err;
  }
  return activePort;
});

ipcMain.handle("app:open-dev-tools", () => {
  process.env["DEBUG"] = "ali-oss";
  win.webContents.openDevTools();
});

ipcMain.handle("app:refresh-page", () => {
  win.reload();
});

function windowFromEvent(event) {
  if (event && event.sender) {
    var fromSender = BrowserWindow.fromWebContents(event.sender);
    if (fromSender) return fromSender;
  }
  return win;
}

// VS Code 风格无边框标题栏：渲染层自绘最小化/最大化(还原)/关闭按钮
ipcMain.handle("window:minimize", (event) => {
  var target = windowFromEvent(event);
  if (target && !target.isDestroyed()) target.minimize();
  return true;
});

ipcMain.handle("window:toggle-maximize", (event) => {
  var target = windowFromEvent(event);
  if (!target || target.isDestroyed()) return false;
  if (target.isMaximized()) target.unmaximize();
  else target.maximize();
  return target.isMaximized();
});

ipcMain.handle("window:close", (event) => {
  var target = windowFromEvent(event);
  if (target && !target.isDestroyed()) target.close();
  return true;
});

ipcMain.handle("window:is-maximized", (event) => {
  var target = windowFromEvent(event);
  return !!(target && !target.isDestroyed() && target.isMaximized());
});

ipcMain.handle("app:install-restart", (event, version) => {
  // P3（R-P3-08）：主进程二次校验版本号与路径，sourcePath 只允许由资源目录推导
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    log.error("upgrade.verify_failed", "invalid version for install", { version: String(version) });
    return { ok: false, code: "BAD_VERSION", message: "invalid version" };
  }
  var resourcesDir = path.resolve(path.dirname(__dirname));
  var from = path.resolve(resourcesDir, version + "-app.asar");
  var to = path.resolve(resourcesDir, "app.asar");
  var prefix = resourcesDir + path.sep;
  if (from.indexOf(prefix) !== 0 || to.indexOf(prefix) !== 0) {
    log.error("upgrade.verify_failed", "install path escapes resources dir", { version: version });
    return { ok: false, code: "BAD_PATH", message: "path escapes resources dir" };
  }
  if (!fs.existsSync(from)) {
    return { ok: false, code: "PACKAGE_MISSING", message: "package not found" };
  }

  process.noAsar = true;

  moveFile(from, to, function (e) {
    if (e)
      fs.writeFileSync(
        path.join(os.homedir(), ".oss-browser", "upgrade-error.txt"),
        JSON.stringify(e)
      );
    app.relaunch();
    app.exit(0);
  });
  return { ok: true };
});

// remote.dialog 替代（D8：remote 模块于 Electron 14 起移除）
// P3（R-P3-08）：主进程白名单过滤（与 preload 侧形成双层），拒绝未知 properties / 路径穿越
var ALLOWED_DIALOG_PROPS = ["openFile", "openDirectory", "multiSelections"];

function sanitizeDialogOptions(options) {
  var src = options && typeof options === "object" ? options : {};
  var out = {};
  if (Array.isArray(src.properties)) {
    out.properties = src.properties.filter(function (p) {
      return ALLOWED_DIALOG_PROPS.indexOf(p) >= 0;
    });
  }
  if (typeof src.title === "string") out.title = src.title;
  if (typeof src.defaultPath === "string" && src.defaultPath.indexOf("..") < 0) {
    out.defaultPath = src.defaultPath;
  }
  if (Array.isArray(src.filters)) {
    out.filters = src.filters
      .filter(function (f) {
        return f && typeof f.name === "string" && Array.isArray(f.extensions);
      })
      .map(function (f) {
        return {
          name: f.name,
          extensions: f.extensions.filter(function (x) {
            return typeof x === "string" && !/[\\/]/.test(x);
          }),
        };
      });
  }
  return out;
}

ipcMain.handle("dialog:show-open-dialog", async (event, options) => {
  var callerWin = BrowserWindow.fromWebContents(event.sender);
  return dialog.showOpenDialog(callerWin, sanitizeDialogOptions(options));
});

// P3（R-P3-04）：外网地址探测（渲染层 CSP 收紧后由主进程代发，3s 超时）
// 必须使用 IPC 信封 { ok, data }：探测结果自身的 ok 表示 HTTP 可达性，
// 直接作为信封会让 403/非 2xx 被 preload 误判为通道失败（app:probe-url failed）。
var probeUrl = require("./node/capabilities/probe-url").probeUrl;
ipcMain.handle("app:probe-url", async (event, target, opts) => {
  try {
    var data = await probeUrl(target, opts);
    return { ok: true, data: data };
  } catch (err) {
    return {
      ok: false,
      code: (err && err.code) || "PROBE_FAILED",
      message: (err && err.message) || "probe failed",
    };
  }
});

// P4（R-P4-05）：渲染层错误上报（滑动窗口限流 + 5s 去重 + 脱敏落盘），不阻塞渲染层
var createRateLimiter = require("./node/lib/rate-limit").createRateLimiter;
var rendererErrorLimiter = createRateLimiter({ windowMs: 60000, maxPerWindow: 20, dedupeMs: 5000 });

ipcMain.on("app:renderer-error", (event, payload) => {
  try {
    var body = payload && typeof payload === "object" ? payload : { message: String(payload || "") };
    var fingerprint = (body.kind || "") + "|" + (body.message || "") + "|" + String(body.stack || "").slice(0, 200);
    var decision = rendererErrorLimiter.allow(fingerprint);
    if (!decision.allowed) return;
    log.error("renderer.error", String(body.message || "renderer error"), {
      kind: body.kind || "unknown",
      url: body.url,
      stack: body.stack,
    });
  } catch (err) {
    // 上报链路自身失败不影响业务
  }
});

// Vue3-P0-07 / Q-10 例外（design O-07）：Electron 45 preload 不再导出 clipboard，
// 剪贴板读写经主进程承接；仅新增此 2 条通道，既有 5 通道语义零改动
ipcMain.handle("clipboard:read-text", () => {
  return electron.clipboard.readText();
});

ipcMain.handle("clipboard:write-text", (event, text) => {
  if (typeof text !== "string") {
    throw new Error("text must be a string");
  }
  electron.clipboard.writeText(text);
});

// Vue3-P0-09 / Q-10 例外（design O-09）：safeStorage 仅主进程可用（Electron 45 preload 导出集不含），
// 三条通道承接原渲染层 SafeStorageClient 的 OS/keychain 原语，异常内部消化保持 null/false 语义
ipcMain.handle("credentials:is-available", () => {
  try {
    var ss = electron.safeStorage;
    return !!(ss && typeof ss.isEncryptionAvailable === "function" && ss.isEncryptionAvailable() === true);
  } catch (err) {
    return false;
  }
});

ipcMain.handle("credentials:is-available-async", async () => {
  try {
    var ss = electron.safeStorage;
    return !!(ss && typeof ss.isEncryptionAvailable === "function" && ss.isEncryptionAvailable() === true);
  } catch (err) {
    return false;
  }
});

ipcMain.handle("credentials:protect", (event, plainB64) => {
  try {
    if (typeof plainB64 !== "string" || !electron.safeStorage) return null;
    return Buffer.from(electron.safeStorage.encryptString(plainB64)).toString("base64");
  } catch (err) {
    return null;
  }
});

ipcMain.handle("credentials:release", (event, protectedB64) => {
  try {
    if (typeof protectedB64 !== "string" || !electron.safeStorage) return null;
    return electron.safeStorage.decryptString(Buffer.from(protectedB64, "base64"));
  } catch (err) {
    return null;
  }
});

// Vue3-P0-16（design O-11）：凭证三原语新增同步通道，保持 SecureStore/AuthInfo 的同步语义
ipcMain.on("credentials:is-available", (event) => {
  var value = false;
  try {
    var ss = electron.safeStorage;
    value = !!(ss && typeof ss.isEncryptionAvailable === "function" && ss.isEncryptionAvailable() === true);
  } catch (err) {
    value = false;
  }
  event.returnValue = { ok: true, data: value };
});

ipcMain.on("credentials:protect", (event, plainB64) => {
  var value = null;
  try {
    if (typeof plainB64 === "string" && electron.safeStorage) {
      value = Buffer.from(electron.safeStorage.encryptString(plainB64)).toString("base64");
    }
  } catch (err) {
    value = null;
  }
  event.returnValue = { ok: true, data: value };
});

ipcMain.on("credentials:release", (event, protectedB64) => {
  var value = null;
  try {
    if (typeof protectedB64 === "string" && electron.safeStorage) {
      value = electron.safeStorage.decryptString(Buffer.from(protectedB64, "base64"));
    }
  } catch (err) {
    value = null;
  }
  event.returnValue = { ok: true, data: value };
});

function moveFile(from, to, fn) {
  if (process.platform != "win32") {
    fs.rename(from, to, fn);
    return;
  }

  var readStream = fs.createReadStream(from);
  var writeStream = fs.createWriteStream(to);

  readStream.on("data", function (chunk) {
    if (writeStream.write(chunk) === false) {
      readStream.pause();
    }
  });
  readStream.on("error", function (err) {
    fn(err);
  });
  readStream.on("end", function () {
    writeStream.end();
    setTimeout(function () {
      fs.unlinkSync(from);
      fn();
    }, 200);
  });

  writeStream.on("drain", function () {
    readStream.resume();
  });
  writeStream.on("error", function (err) {
    fn(err);
  });
}

//singleton（Electron 4+：makeSingleInstance 移除，改 requestSingleInstanceLock + second-instance）
var gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// P4（R-P4-01）：等待静态服务端口选择完成（失败不阻塞建窗，端口查询返回 UNAVAILABLE）
app.on("ready", function () {
  staticServerReady.then(function (activePort) {
    log.info("app.start", "application ready", {
      port: activePort || 0,
      platform: process.platform,
      version: app.getVersion(),
    });
    createWindow();
  });
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  //if (process.platform !== 'darwin') {
  app.quit();
  //}
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});

// SSL/TSL: 自签名证书支持（D7 开关化：默认拒绝，开关开启时放行）
app.on(
  "certificate-error",
  (event, webContents, url, error, certificate, callback) => {
    if (ALLOW_INSECURE_TLS) {
      // 开关开启：阻止默认拒绝行为并放行
      event.preventDefault();
      callback(true);
    } else {
      // 开关关闭：显式拒绝（等价 Electron 默认阻止行为）
      callback(false);
    }
  }
);

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function getMenuTemplate() {
  var name = app.getName();
  return [
    {
      label: name,
      submenu: [
        {
          label: `About ${name}`,
          role: "about",
        },
        {
          type: "separator",
        },
        {
          label: `Hide ${name}`,
          accelerator: "CmdOrCtrl+H",
          role: "hide",
        },
        {
          label: "Quit",
          accelerator: "Command+Q",
          click: function () {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          role: "undo",
        },
        {
          label: "Redo",
          accelerator: "Shift+CmdOrCtrl+Z",
          role: "redo",
        },
        {
          type: "separator",
        },
        {
          label: "Cut",
          accelerator: "CmdOrCtrl+X",
          role: "cut",
        },
        {
          label: "Copy",
          accelerator: "CmdOrCtrl+C",
          role: "copy",
        },
        {
          label: "Paste",
          accelerator: "CmdOrCtrl+V",
          role: "paste",
        },
        {
          label: "Select All",
          accelerator: "CmdOrCtrl+A",
          role: "selectAll",
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: "Minimize",
          accelerator: "CmdOrCtrl+M",
          click: function () {
            win.minimize();
          },
        },
        {
          label: "Close",
          accelerator: "CmdOrCtrl+W",
          click: function () {
            win.close();
          },
        },
      ],
    },
  ];
}

// Vue3-P0-12（design O-10 同源）：SMTP 测试邮件由主进程发（nodemailer），20s 超时，错误消息剔除密码
ipcMain.handle("mail:sendTest", async function (event, smtp, to) {
  try {
    var nodemailer = require("nodemailer");
    if (!smtp || typeof smtp !== "object") {
      return { ok: false, code: "INVALID_ARG", message: "smtp is required" };
    }
    var transportOptions = {
      host: smtp.host,
      port: smtp.port,
      secure: !!smtp.secure,
    };
    if (smtp.user) transportOptions.auth = { user: smtp.user, pass: smtp.pass };
    var transporter = nodemailer.createTransport(transportOptions);
    var sending = transporter.sendMail({
      from: smtp.from || smtp.user,
      to: to,
      subject: "OSS Browser SMTP Test",
      text: "This is a test mail from OSS Browser.",
    });
    var timer = new Promise(function (resolve, reject) {
      setTimeout(function () {
        var err = new Error("smtp timeout");
        err.code = "TIMEOUT";
        reject(err);
      }, 20000);
    });
    await Promise.race([sending, timer]);
    return { ok: true, data: true };
  } catch (err) {
    var message = (err && err.message) || String(err);
    if (smtp && typeof smtp.pass === "string" && smtp.pass) {
      message = message.split(smtp.pass).join("***");
    }
    return { ok: false, code: (err && err.code) || "SMTP_ERROR", message: message };
  }
});

// Vue3-P0-18：通用邮件发送（授权码/地址分享），与测试邮件同源实现，20s 超时且错误消息剔除密码
ipcMain.handle("mail:send", async function (event, smtp, info) {
  try {
    var nodemailer = require("nodemailer");
    if (!smtp || typeof smtp !== "object") {
      return { ok: false, code: "INVALID_ARG", message: "smtp is required" };
    }
    if (!info || typeof info !== "object" || typeof info.to !== "string" || !info.to) {
      return { ok: false, code: "INVALID_ARG", message: "info.to is required" };
    }
    var transportOptions = {
      host: smtp.host,
      port: smtp.port,
      secure: !!smtp.secure,
    };
    if (smtp.user) transportOptions.auth = { user: smtp.user, pass: smtp.pass };
    var transporter = nodemailer.createTransport(transportOptions);
    var sending = transporter.sendMail({
      from: smtp.from || smtp.user,
      to: info.to,
      subject: info.subject,
      html: info.html || info.content,
    });
    var timer = new Promise(function (resolve, reject) {
      setTimeout(function () {
        var err = new Error("smtp timeout");
        err.code = "TIMEOUT";
        reject(err);
      }, 20000);
    });
    await Promise.race([sending, timer]);
    return { ok: true, data: true };
  } catch (err) {
    var message = (err && err.message) || String(err);
    if (smtp && typeof smtp.pass === "string" && smtp.pass) {
      message = message.split(smtp.pass).join("***");
    }
    return { ok: false, code: (err && err.code) || "SMTP_ERROR", message: message };
  }
});

// Vue3-P0-11（design O-10）：OSS/STS/RAM 由主进程承载（Electron 45 preload 无法加载 ali-oss/aliyun-sdk）；
// 逐方法通道按 manifest 白名单生成，preload 侧仅做 invoke 包装，不接触 SDK
var CAPABILITY_CHANNELS = [
  "oss:createFolder",
  "oss:createBucket",
  "oss:restoreFile",
  "oss:loadStorageStatus",
  "oss:getMeta",
  "oss:getFileInfo",
  "oss:setMeta",
  "oss:setMeta2",
  "oss:checkFileExists",
  "oss:checkFolderExists",
  "oss:listAllBuckets",
  "oss:listAllFiles",
  "oss:listFiles",
  "oss:getContent",
  "oss:saveContent",
  "oss:getImageBase64Url",
  "oss:loadObjectSymlinkMeta",
  "oss:putObjectSymlinkMeta",
  "oss:moveFile",
  "oss:copyFiles",
  "oss:stopCopyFiles",
  "oss:deleteFiles",
  "oss:deleteMultiFiles",
  "oss:deleteFolder",
  "oss:stopDeleteFiles",
  "oss:listAllUploads",
  "oss:abortAllUploads",
  "oss:deleteBucket",
  "oss:listAllCustomDomains",
  "oss:listUsableAccelarateDomains",
  "oss:getBucketACL",
  "oss:updateBucketACL",
  "oss:getACL",
  "oss:updateACL",
  "oss:getOssEndpoint",
  "oss:signatureUrl",
  "oss:signatureUrl2",
  "sts:assumeRole",
  "ram:listUsers",
  "ram:listGroups",
  "ram:listRoles",
  "ram:createPolicy",
  "ram:getPolicy",
  "ram:attachPolicyToRole",
  "ram:attachPolicyToGroup",
  "ram:attachPolicyToUser",
  "ram:detachPolicyFromUser",
  "ram:listPoliciesForUser",
  "ram:getUser",
  "ram:createUser",
  "ram:updateUser",
  "ram:deleteUser",
  "ram:createAccessKey",
  "ram:updateAccessKey",
  "ram:deleteAccessKey",
  "ram:listAccessKeys",
  "transfer:createUpload",
  "transfer:createDownload",
  "transfer:pause",
  "transfer:resume",
  "transfer:cancel",
  "transfer:clear",
  "transfer:getTasks",
  "transfer:retry",
  "transfer:clearFailed",
  "transfer:errorDetail",
  "transfer:scanFolder",
  "transfer:ensureDirs",
  "upgrade:check",
  "upgrade:download",
  "upgrade:install",
];
var capabilityDispatch = require("./node/capabilities/dispatch");
CAPABILITY_CHANNELS.forEach(function (channel) {
  var parts = channel.split(":");
  ipcMain.handle(channel, function (event, auth, args) {
    capabilityDispatch.setSender(event.sender);
    return capabilityDispatch.dispatch(parts[0], parts[1], auth, args).then(
      function (data) {
        return { ok: true, data: data };
      },
      function (err) {
        var code = (err && err.code) || "INTERNAL";
        log.error("ipc.error", "capability dispatch failed", {
          channel: channel,
          code: code,
          requestId: err && err.requestId,
        });
        return {
          ok: false,
          code: code,
          message: (err && err.message) || String(err),
          requestId: err && err.requestId,
          ecCode: err && err.ecCode,
          // Vue3-B3-09：批量删除逐项失败明细（可序列化数组）
          failures: err && err.failures,
        };
      }
    );
  });
});
