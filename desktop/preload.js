const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  connect: username => ipcRenderer.invoke('tiktok-connect', username),
  disconnect: () => ipcRenderer.invoke('tiktok-disconnect'),
  status: () => ipcRenderer.invoke('tiktok-status'),
  onStatus: cb => ipcRenderer.on('bridge-status', (_e, s) => cb(s)),
  onTogglePanel: cb => ipcRenderer.on('toggle-panel', () => cb()),
  onShowHelp: cb => ipcRenderer.on('show-help', () => cb())
});
