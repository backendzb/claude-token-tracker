'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('floatApi', {
  onUpdate: (callback) => ipcRenderer.on('float-update', (_e, data) => callback(data)),
  onTheme: (callback) => ipcRenderer.on('float-theme', (_e, theme) => callback(theme)),
  onOpacity: (callback) => ipcRenderer.on('float-opacity', (_e, opacity) => callback(opacity)),
  close: () => ipcRenderer.invoke('toggle-float-window'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('float-set-always-on-top', flag),
});
