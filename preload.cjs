const { contextBridge, ipcRenderer } = require('electron');

console.log('🔍 Preload script loaded!');

contextBridge.exposeInMainWorld('electronAPI', {
  startWindowCapture: async () => {
    console.log('🔍 startWindowCapture called');
    return await ipcRenderer.invoke('start-window-capture');
  }
  // getCaptureStream removed - getUserMedia must be called in the renderer
});

console.log('🔍 electronAPI exposed successfully');