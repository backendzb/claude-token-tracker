'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, nativeImage, Notification, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const {
  loadAllUsageData, getProjectList,
  loadSessionList, loadSessionDetail, loadBucketData,
  exportToCSV, exportToJSON,
  loadConversation, getSessionIndex,
} = require('./data-loader');

let mainWindow;
let tray = null;
let isQuitting = false;
let fileWatcher = null;

// ---- 设置持久化 ----
const SETTINGS_FILE = path.join(app.getPath('userData'), 'tracker-settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  } catch {
    return { dailyBudget: 0, monthlyBudget: 0, requestThreshold: 0, shortcut: 'Ctrl+Shift+T' };
  }
}

function saveSettings(settings) {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch {}
}

// ---- 窗口状态持久化 ----
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, 'utf-8'));
  } catch {
    return { width: 1280, height: 860 };
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    const maximized = mainWindow.isMaximized();
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify({ ...bounds, maximized }));
  } catch {}
}

// ---- 窗口创建 ----
function createWindow() {
  const state = loadWindowState();
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: 'Claude Token Tracker',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#0d1117',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#161b22',
      symbolColor: '#8b949e',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (state.maximized) mainWindow.maximize();
  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  let saveTimeout;
  const debouncedSave = () => { clearTimeout(saveTimeout); saveTimeout = setTimeout(saveWindowState, 500); };
  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);

  mainWindow.on('close', (e) => {
    saveWindowState();
    if (isQuitting) return;
    e.preventDefault();
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      icon: nativeImage.createFromPath(path.join(__dirname, 'icon.ico')),
      title: 'Claude Token Tracker',
      message: '要最小化到托盘还是退出程序？',
      buttons: ['最小化到托盘', '退出', '取消'],
      defaultId: 0,
      cancelId: 2,
    }).then(({ response }) => {
      if (response === 0) mainWindow.hide();
      else if (response === 1) { isQuitting = true; app.quit(); }
    });
  });
}

// ---- 托盘 ----
function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.ico'));
  tray.setToolTip('Claude Token Tracker');
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  updateTrayTooltip();
  setInterval(updateTrayTooltip, 60000);
}

async function updateTrayTooltip() {
  if (!tray) return;
  try {
    const buckets = await loadBucketData({});
    const active = buckets.find(b => b.isActive);
    if (active) {
      const cost = active.costUSD.toFixed(4);
      const rate = active.burnRate.toFixed(4);
      const remain = active.projection ? `${active.projection.remainingMinutes}min` : '-';
      tray.setToolTip(`Claude Tracker\n当前窗口: $${cost} | $${rate}/h | 剩余 ${remain}`);
    } else {
      tray.setToolTip('Claude Token Tracker — 无活跃窗口');
    }
  } catch (err) {
    console.error('[main] Tray tooltip update failed:', err.message);
    tray.setToolTip('Claude Token Tracker');
  }
}

// ---- 文件监听（实时刷新） ----
function startFileWatcher() {
  const os = require('os');
  const watchDirs = [
    path.join(os.homedir(), '.config', 'claude', 'projects'),
    path.join(os.homedir(), '.claude', 'projects'),
  ];
  let debounceTimer = null;

  for (const dir of watchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.jsonl')) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          // 通知渲染进程刷新
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('data-changed');
          }
          // 检查预算
          checkBudgetAlerts();
        }, 2000);
      });
      if (!fileWatcher) fileWatcher = watcher;
    } catch (err) {
      console.error('[main] File watcher error:', err.message);
    }
  }
}

// ---- 预算告警 ----
let lastAlertDay = '';
let lastAlertMonth = '';

async function checkBudgetAlerts() {
  const settings = loadSettings();
  if (!settings.dailyBudget && !settings.monthlyBudget && !settings.requestThreshold) return;

  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const today = new Date(todayStr + 'T00:00:00.000Z');
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const allRecords = await loadAllUsageData({ since: monthStart.toISOString() });
    const todayRecords = allRecords.filter(r => r.timestamp >= today.toISOString());

    const todayCost = todayRecords.reduce((s, r) => s + r.cost_usd, 0);
    const monthCost = allRecords.reduce((s, r) => s + r.cost_usd, 0);

    // 日预算告警
    if (settings.dailyBudget > 0 && todayCost >= settings.dailyBudget && lastAlertDay !== todayStr) {
      lastAlertDay = todayStr;
      showNotification('日预算告警', `今日费用 $${todayCost.toFixed(4)} 已达到预算 $${settings.dailyBudget}`);
    }

    // 月预算告警
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    if (settings.monthlyBudget > 0 && monthCost >= settings.monthlyBudget && lastAlertMonth !== monthKey) {
      lastAlertMonth = monthKey;
      showNotification('月预算告警', `本月费用 $${monthCost.toFixed(4)} 已达到预算 $${settings.monthlyBudget}`);
    }

    // 单次请求告警（检查最近一条）
    if (settings.requestThreshold > 0 && todayRecords.length > 0) {
      const latest = todayRecords[todayRecords.length - 1];
      if (latest.cost_usd >= settings.requestThreshold) {
        showNotification('高费用请求', `单次请求费用 $${latest.cost_usd.toFixed(4)} (${latest.model})`);
      }
    }
  } catch (err) {
    console.error('[main] Budget check failed:', err.message);
  }
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'icon.ico'),
  });
  n.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  n.show();
}

// ---- 全局快捷键 ----
function registerShortcut() {
  globalShortcut.unregisterAll();
  const settings = loadSettings();
  const key = settings.shortcut || 'Ctrl+Shift+T';
  try {
    globalShortcut.register(key, () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('[main] Failed to register shortcut:', err.message);
  }
}

// ---- 切换上下文 ----
function switchContext(sessionId, cwd) {
  const { exec } = require('child_process');
  const targetCwd = cwd && fs.existsSync(cwd) ? cwd : require('os').homedir();
  // 用临时 bat 文件避免 Windows 多层引号嵌套问题
  const batContent = `@echo off\ncd /d "${targetCwd}"\nclaude --resume ${sessionId}\n`;
  const batFile = path.join(app.getPath('temp'), `claude-resume-${Date.now()}.bat`);
  fs.writeFileSync(batFile, batContent);
  exec(`start "Claude - ${sessionId.slice(0, 8)}" cmd /k "${batFile}"`);
}

// ---- IPC Handlers ----

ipcMain.handle('get-usage', async (_event, options) => {
  try { return await loadAllUsageData(options); }
  catch (err) { console.error(err); return { error: err.message }; }
});

ipcMain.handle('get-projects', async () => {
  try { return await getProjectList(); }
  catch (err) { console.error(err); return { error: err.message }; }
});

ipcMain.handle('get-sessions', async (_event, options) => {
  try { return await loadSessionList(options); }
  catch (err) { console.error(err); return { error: err.message }; }
});

ipcMain.handle('get-session-detail', async (_event, sessionId) => {
  try { return await loadSessionDetail(sessionId); }
  catch (err) { console.error(err); return { error: err.message }; }
});

ipcMain.handle('get-buckets', async (_event, options) => {
  try { return await loadBucketData(options); }
  catch (err) { console.error(err); return { error: err.message }; }
});

ipcMain.handle('export-data', async (_event, { format, options }) => {
  try {
    const records = await loadAllUsageData(options);
    const content = format === 'csv' ? exportToCSV(records) : exportToJSON(records);
    const ext = format === 'csv' ? 'csv' : 'json';
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出数据',
      defaultPath: `claude-usage-${new Date().toISOString().slice(0, 10)}.${ext}`,
      filters: [
        { name: format.toUpperCase(), extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (canceled || !filePath) return { success: false };
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
});

// 设置 IPC
ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_event, settings) => {
  saveSettings(settings);
  registerShortcut();
  return { success: true };
});

// 对话记录 IPC
ipcMain.handle('get-session-index', async () => {
  try { return await getSessionIndex(); }
  catch (err) { console.error(err); return { error: err.message }; }
});

ipcMain.handle('load-conversation', async (_event, sessionId) => {
  try { return await loadConversation(sessionId); }
  catch (err) { console.error(err); return { error: err.message }; }
});

// 主题同步 — 更新标题栏颜色
ipcMain.handle('update-theme', (_event, theme) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.setTitleBarOverlay({
      color: theme === 'dark' ? '#161b22' : '#f6f8fa',
      symbolColor: theme === 'dark' ? '#8b949e' : '#656d76',
      height: 36,
    });
    mainWindow.setBackgroundColor(theme === 'dark' ? '#0d1117' : '#ffffff');
  } catch {}
});

// 切换上下文 IPC
ipcMain.handle('switch-context', (_event, { sessionId, cwd }) => {
  try {
    switchContext(sessionId, cwd);
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
});

// ---- 自动更新 ----
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    showNotification('发现新版本', `v${info.version} 可用，正在后台下载...`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', { status: 'downloading', version: info.version });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', { status: 'ready', version: info.version });
    }
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新就绪',
      message: `v${info.version} 已下载完成，是否立即安装并重启？`,
      buttons: ['立即安装', '稍后'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
  });

  // 启动后延迟检查更新，之后每小时检查一次
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 10000);
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 3600000);
}

// 手动检查更新 IPC
ipcMain.handle('check-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdatesAndNotify();
    const currentVersion = app.getVersion();
    if (result && result.updateInfo) {
      const newVersion = result.updateInfo.version;
      if (newVersion !== currentVersion) {
        return { hasUpdate: true, currentVersion, newVersion };
      }
    }
    return { hasUpdate: false, currentVersion };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('get-version', () => app.getVersion());

// ---- App Lifecycle ----

app.whenReady().then(() => {
  createWindow();
  createTray();
  startFileWatcher();
  registerShortcut();
  setupAutoUpdater();
  setTimeout(checkBudgetAlerts, 5000);
});

app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { /* 不退出，保持托盘 */ });
