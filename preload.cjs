const { contextBridge, ipcRenderer } = require('electron');

console.log('🔧 Preload script loaded (with overlay IPC)');

// Expose only the frame channel to the overlay window
contextBridge.exposeInMainWorld('electronAPI', {
  onFrame: function (callback) {
    ipcRenderer.on('frame', function (_event, buffer, width, height) {
      callback(buffer, width, height);
    });
  },
});