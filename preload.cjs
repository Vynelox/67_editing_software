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
  // Send structured video payloads to main process
  sendVideoChunk: (payload) => ipcRenderer.send('send-video-chunk', payload),
});