const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');

console.log('🔍 Preload path:', path.join(__dirname, 'preload.cjs'));
console.log('🔍 Preload exists:', fs.existsSync(path.join(__dirname, 'preload.cjs')));

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    icon: path.join(__dirname, 'src/67_editing_software.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Handle window capture request from preload
  ipcMain.handle('start-window-capture', async () => {
    console.log('🔍 Main process: start-window-capture called');
    const sources = await desktopCapturer.getSources({ 
      types: ['window'], 
      thumbnailSize: { width: 0, height: 0 } 
    });
    
    console.log('🔍 Found sources:', sources.map(s => s.name));
    
    // Find the main app window
    const mainWindow = sources.find(source => 
      source.name.includes('67 editing software') || 
      source.name.includes('Electron') ||
      source.name === ''
    ) || sources[0];
    
    console.log('🔍 Selected window:', mainWindow.name);
    
    return { sourceId: mainWindow.id, name: mainWindow.name };
  });

  // Window control handlers
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window-close', () => win.close());

  win.loadURL('http://localhost:5173');
});