const { contextBridge, ipcRenderer } = require('electron');

console.log('🔧 Preload script loaded');

// Expose IPC for window controls
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  onFrameData: function (callback) {
    ipcRenderer.on('frame-data', function (_event, buffer, width, height) {
      callback(buffer, width, height);
    });
  },
});
