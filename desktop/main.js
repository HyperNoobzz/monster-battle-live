// Monster Battle Live — desktop app (Electron)
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const net = require('net');
const { createBridge } = require('../bridge/bridge');

let win = null, bridge = null, port = 0;

function freePort(preferred) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', () => { const s2 = net.createServer(); s2.listen(0, '127.0.0.1', () => { const p = s2.address().port; s2.close(() => resolve(p)); }); });
    s.listen(preferred, '127.0.0.1', () => s.close(() => resolve(preferred)));
  });
}

const SIZES = [['Small (540×960)', 540, 960], ['Medium (720×1280)', 720, 1280], ['Full HD (1080×1920)', 1080, 1920]];

function buildMenu() {
  const send = ch => () => win && win.webContents.send(ch);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'Game', submenu: [
      { label: 'Settings && Simulator (press S)', click: send('toggle-panel') },
      { type: 'separator' },
      { label: 'Reload game', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
      { type: 'separator' },
      { role: 'quit' }
    ]},
    { label: 'Window', submenu: [
      { label: 'Always on top', type: 'checkbox', click: i => win.setAlwaysOnTop(i.checked) },
      { label: 'Full screen', accelerator: 'F11', click: () => win.setFullScreen(!win.isFullScreen()) },
      { type: 'separator' },
      ...SIZES.map(([label, w, h]) => ({ label, click: () => { win.setFullScreen(false); win.setContentSize(w, h); win.center(); } })),
      { type: 'separator' },
      { label: 'Developer tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => win.webContents.toggleDevTools() }
    ]},
    { label: 'Help', submenu: [
      { label: 'How to stream this game', click: () => win && win.webContents.send('show-help') },
      { label: 'Node.js TikTok connector (project page)', click: () => shell.openExternal('https://github.com/zerodytrash/TikTok-Live-Connector') }
    ]}
  ]));
}

async function createWindow() {
  port = await freePort(8080);
  bridge = createBridge({
    port,
    log: m => console.log(m),
    onStatus: s => { if (win && !win.isDestroyed()) win.webContents.send('bridge-status', s); }
  });

  win = new BrowserWindow({
    width: 540, height: 960, useContentSize: true, minWidth: 270, minHeight: 480,
    backgroundColor: '#0b0d16', title: 'Monster Battle Live',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.setAspectRatio(9 / 16);
  win.loadFile(path.join(__dirname, '..', 'index.html'), { query: { ws: `ws://127.0.0.1:${port}`, desktop: '1' } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  buildMenu();
}

ipcMain.handle('tiktok-connect', (_e, username) => { bridge.connect(username); return bridge.getStatus(); });
ipcMain.handle('tiktok-disconnect', () => { bridge.disconnect(); return bridge.getStatus(); });
ipcMain.handle('tiktok-status', () => bridge.getStatus());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (bridge) bridge.close(); app.quit(); });
