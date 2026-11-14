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

// electron-log收集和引入
var log = require("electron-log");
log.transports.file.level = false;
log.transports.console.level = false;

if (ALLOW_INSECURE_TLS) {
  // 审计日志：开关开启时记录时间戳（P2 阶段 console 输出；P4-03 升级 electron-log 5.x 后切 log.info）
  console.log(
    "[audit][tls] OSS_BROWSER_ALLOW_INSECURE_TLS=1 enabled at " +
      new Date().toISOString()
  );
}

///*****************************************
//静态服务
var PORTS = [7123, 7124, 7125, 7126];

for (var port of PORTS) {
  try {
    //var subp = require('child_process').fork('./server.js',[port]);
    require("./server.js").listen(port);
    console.log("listening on port " + port);
    break;
  } catch (e) {
    console.log(e);
  }
}

if (ALLOW_INSECURE_TLS) {
  // 自签证书支持（仅开关开启时）
  app.commandLine.appendSwitch("ignore-certificate-errors");
}
///*****************************************

var custom = {};

try {
  custom = require(path.join(__dirname, "../custom"));
} catch (e) {
  console.log("没有自定义模块");
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
      plugins: true,
      // D9 过渡态显式声明（升级文档 D9：渲染层直接依赖 Node API，contextBridge 改造列入第 11 章）
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  };

  if (process.platform == "linux") {
    opt.icon = custom.logo_png || path.join(__dirname, "icons", "icon.png");
  }

  // Create the browser window.   http://electron.atom.io/docs/api/browser-window/
  win = new BrowserWindow(opt);

  win.setTitle(custom.title || "OSS Browser");
  win.loadURL(`file://${__dirname}/index.html`);

  win.setMenuBarVisibility(false);

  // Emitted when the window is closed.
  win.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  // drawin 就是 MacOS
  if (process.env.NODE_ENV == "development") {
    console.log("开发模式");

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
  return port;
});

ipcMain.handle("app:open-dev-tools", () => {
  process.env["DEBUG"] = "ali-oss";
  win.webContents.openDevTools();
});

ipcMain.handle("app:refresh-page", () => {
  win.reload();
});

ipcMain.handle("app:install-restart", (event, version) => {
  //Copy
  //var from = path.join(os.homedir(), '.oss-browser', version+'-app.asar');
  var from = path.join(path.dirname(__dirname), version + "-app.asar");
  var to = path.join(path.dirname(__dirname), "app.asar");

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
});

// remote.dialog 替代（D8：remote 模块于 Electron 14 起移除）
// 渲染进程经 ipcRenderer.invoke('dialog:show-open-dialog', options) 调用，
// 返回 { canceled, filePaths }（与 dialog.showOpenDialog 结构一致）
ipcMain.handle("dialog:show-open-dialog", async (event, options) => {
  var callerWin = BrowserWindow.fromWebContents(event.sender);
  return dialog.showOpenDialog(callerWin, options);
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
app.on("ready", createWindow);

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
