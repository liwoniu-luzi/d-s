const { app, BrowserWindow, Tray, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// 1. 动态获取软件所在实际根目录（支持任意盘符与跨电脑复制）
const isDev = !app.isPackaged;
const APP_DIR = isDev ? path.join(__dirname, '..') : path.dirname(app.getPath('exe'));

// 2. 定义完全自闭环的存储与缓存目录
const DATA_DIR = path.join(APP_DIR, 'data');
const CACHE_DIR = path.join(APP_DIR, 'cache');
const WEBVIEW_CACHE = path.join(CACHE_DIR, 'webview');
const TEMP_DIR = path.join(CACHE_DIR, 'temp');
const NPM_CACHE = path.join(CACHE_DIR, 'npm');
const NODE_DIR = path.join(APP_DIR, 'runtime', 'node');
const GIT_DIR = path.join(APP_DIR, 'runtime', 'git', 'cmd');
const NPM_GLOBAL_BIN = path.join(APP_DIR, 'runtime', 'npm_global', 'bin');

// 3. 隔离桌面客户端自身的所有系统写入（严禁向 C 盘 AppData 写入）
app.setPath('userData', WEBVIEW_CACHE);
app.setPath('temp', TEMP_DIR);

// 4. 注入便携式隔离环境变量
process.env.DSH_HOME = DATA_DIR;
process.env.npm_config_cache = NPM_CACHE;
process.env.npm_config_userconfig = path.join(DATA_DIR, '.npmrc');
process.env.TEMP = TEMP_DIR;
process.env.TMP = TEMP_DIR;

// 将内置的 node 和 git 放在 PATH 最前列，确保全新系统直接调用内置工具
const oldPath = process.env.PATH || '';
process.env.PATH = `${NODE_DIR};${GIT_DIR};${NPM_GLOBAL_BIN};${oldPath}`;

let mainWindow = null;
let backendProcess = null;
let tray = null;
const DSH_PORT = 3080;
const DSH_URL = `http://127.0.0.1:${DSH_PORT}`;

// 启动 DSH 后台服务进程
function startBackend() {
  const nodeExe = path.join(NODE_DIR, 'node.exe');
  const dshEntry = path.join(APP_DIR, 'app', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');

  backendProcess = spawn(nodeExe, [dshEntry, 'web', '--port', DSH_PORT.toString()], {
    cwd: path.join(APP_DIR, 'app'),
    env: { ...process.env },
    windowsHide: true,
    stdio: 'ignore'
  });

  backendProcess.on('error', (err) => {
    dialog.showErrorBox("启动失败", `无法启动后端引擎: ${err.message}`);
  });
}

// 轮询等待后台 Web 服务就绪
function waitForServer(url, timeoutMs = 20000, callback) {
  const startTime = Date.now();
  const interval = setInterval(() => {
    http.get(url, (res) => {
      if (res.statusCode === 200 || res.statusCode === 302) {
        clearInterval(interval);
        callback();
      }
    }).on('error', () => {
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        dialog.showErrorBox("超时", "DSH 后台启动超时，请检查防火墙或端口是否被占用。");
      }
    });
  }, 300);
}

// 创建主桌面窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "DeepSeek Harness",
    icon: path.join(APP_DIR, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    show: false
  });

  waitForServer(DSH_URL, 20000, () => {
    mainWindow.loadURL(DSH_URL);
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  });

  // 外部链接在默认浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide(); // 点击关闭最小化到系统托盘
    }
  });
}

// 创建系统托盘
function createTray() {
  const iconPath = path.join(APP_DIR, 'assets', 'icon.ico');
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主界面', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: '退出软件', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip('DeepSeek Harness');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
  createTray();
});

// 应用退出时强制杀死后台 Node 进程，防止残留
app.on('before-quit', () => {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch (e) {}
  }
});
