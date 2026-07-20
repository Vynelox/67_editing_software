const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

console.log('🔧 Preload script loaded');

// 1. Read config.json safely
const configPath = path.join(__dirname, 'config.json');
let borderRadius = '0px'; // Default fallback
try {
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);
  
  // Explicitly check for undefined so that '0' is treated as a valid number
  const radiusVal = config.electron_window_border_radius !== undefined 
    ? config.electron_window_border_radius 
    : 0;
    
  borderRadius = `${radiusVal}px`;
} catch (err) {
  console.error('🔧 Failed to read config.json in preload:', err);
}

// 2. Inject the CSS variable safely AFTER the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --electron-window-border-radius: ${borderRadius};
    }
  `;
  
  // Double-check that document.head exists before appending
  if (document.head) {
    document.head.appendChild(style);
  }
});

// 3. Expose IPC for window controls AND WebCodecs video pipeline
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  onFrameData: function (callback) {
    ipcRenderer.on('frame-data', function (_event, buffer, width, height) {
      callback(buffer, width, height);
    });
  },
  // WebCodecs pipeline: receive structured video payloads from main process
  onVideoChunk: function (callback) {
    ipcRenderer.on('video-chunk', function (_event, payload) {
      callback(payload);
    });
  },
  // Get the window source ID for silent capture
  getWindowSourceId: () => ipcRenderer.invoke('get-window-source-id'),
  // Get window bounds for proper constraints
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  // Create MediaStream from window using desktopCapturer + getUserMedia in renderer
  createWindowStream: async () => {
    try {
      console.log('🔧 Creating window stream via desktopCapturer in renderer...');
      const { desktopCapturer } = require('electron');
      
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 0, height: 0 },
      });
      
      // Find window sources
      const windowSources = sources.filter(s => s.id.startsWith('window:'));
      if (windowSources.length === 0) {
        console.error('No window sources found');
        return null;
      }
      
      console.log('Available window sources:', windowSources.map(s => ({ id: s.id, name: s.name })));
      
      // Try to find the source that matches our app_window by title
      const targetTitle = '67 editing software';
      const matchingSource = windowSources.find(s => {
        return s.name && s.name.includes(targetTitle);
      });
      
      const source = matchingSource || windowSources[0];
      console.log('Using window source:', source.id, 'name:', source.name);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
          },
        },
      });
      
      console.log('✅ Stream created successfully, track count:', stream.getVideoTracks().length);
      return stream.getVideoTracks()[0];
    } catch (e) {
      console.error('🚨 Failed to create window stream:', e.message);
      return null;
    }
  },
  // Send structured video payloads to main process
  sendVideoChunk: (payload) => ipcRenderer.send('send-video-chunk', payload),
});