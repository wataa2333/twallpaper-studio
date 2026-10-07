const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  exportImage: payload => ipcRenderer.invoke('export-image',payload),
  saveConfig: config => ipcRenderer.invoke('save-config',config),
  openConfig: () => ipcRenderer.invoke('open-config'),
  screenSize: () => ipcRenderer.invoke('screen-size'),
  github: () => ipcRenderer.invoke('github'),
  owner: () => ipcRenderer.invoke('owner'),
});
