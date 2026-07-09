const { contextBridge, ipcRenderer } = require('electron');

console.log('🔧 Preload script loaded (with overlay IPC)');

// Expose the frame-data channel to the overlay window
contextBridge.exposeInMainWorld('electronAPI', {
  onFrameData: function (callback) {
    ipcRenderer.on('frame-data', function (_event, buffer, width, height) {
      callback(buffer, width, height);
    });
  },
});
