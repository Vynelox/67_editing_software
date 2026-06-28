const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false, // <--- THIS REMOVES THE NATIVE WINDOWS BAR
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Point Electron to your local React dev server!
  win.loadURL('http://localhost:5173');
  
  // Open DevTools so you can debug if something breaks
  win.webContents.openDevTools();
});