const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startWindowCapture: async () => {
    const sources = await desktopCapturer.getSources({ 
      types: ['window'], 
      thumbnailSize: { width: 0, height: 0 } 
    });
    
    // Find the main app window
    const mainWindow = sources.find(source => 
      source.name.includes('67 editing software') || 
      source.name.includes('Electron') ||
      source.name === ''
    ) || sources[0];
    
    return { sourceId: mainWindow.id, name: mainWindow.name };
  },
  
  getCaptureStream: (sourceId) => {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: 1280,
          maxWidth: 1920,
          minHeight: 720,
          maxHeight: 1080
        }
      }
    });
  }
});