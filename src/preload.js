const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  initialState: () => ipcRenderer.invoke('initial-state'),
  rendererReady: () => ipcRenderer.send('renderer-ready'),
  chooseGame: () => ipcRenderer.invoke('choose-game'),
  scanMaps: (gamePath) => ipcRenderer.invoke('scan-maps', gamePath),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  setFullscreen: (enabled) => ipcRenderer.invoke('set-fullscreen', enabled),
  quitApp: () => ipcRenderer.send('quit-app'),
  launchSession: (settings) => ipcRenderer.invoke('launch-session', settings)
});
