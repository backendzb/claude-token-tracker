'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getUsage: (options) => ipcRenderer.invoke('get-usage', options),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getSessions: (options) => ipcRenderer.invoke('get-sessions', options),
  getSessionDetail: (sessionId) => ipcRenderer.invoke('get-session-detail', sessionId),
  getBuckets: (options) => ipcRenderer.invoke('get-buckets', options),
  exportData: (format, options) => ipcRenderer.invoke('export-data', { format, options }),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  onDataChanged: (callback) => ipcRenderer.on('data-changed', callback),
  switchContext: (sessionId, cwd) => ipcRenderer.invoke('switch-context', { sessionId, cwd }),
  updateTheme: (theme) => ipcRenderer.invoke('update-theme', theme),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_e, data) => callback(data)),
});
