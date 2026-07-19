const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const config = require('./config.json');

// Disable Windows 11 OS-level rounded corners on frameless windows
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'Windows11RoundedCorners');
}
const DOWNSCALE_FACTOR = config.DOWNSCALE_FACTOR;
const SHADER_WINDOW = config.shader_window;
const BASE_WINDOW_TRANSPARENCY = config.base_window_transparency;
const SHADER_WINDOW_CLICKTHROUGH = config.shader_window_clickthrough;
const SYNC_WINDOWS = config.sync_windows;
const ENSHITTIFY = config.enshittify;
const SLIDESHOW = config.slideshow;

let app_window = null;      // Window A: main app (invisible but interactive)
let shader_window = null;   // Window B: shader overlay
let windowSourceId = null;

app.whenReady().then(async () => {
  if (SHADER_WINDOW) {
    shader_window = new BrowserWindow({
      width: 1280,
      height: 800,
      x: 0,  // Start at same position as Window A
      y: 0,
      frame: false, // Frameless overlay
      transparent: true, // Transparent background
      backgroundColor: '#00000000', // Explicitly transparent black background
      hasShadow: false, // Remove shadow to avoid extra DWM compositor work
      skipTaskbar: false,  // Show in taskbar with custom icon for alt-tab
      icon: path.join(__dirname, 'src/67_editing_software.ico'),
      show: true,  // Show immediately
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // --- Window A: Main App (Invisible but Interactive) ---
    const appOpacity = BASE_WINDOW_TRANSPARENCY <= 0.004 ? 0 : BASE_WINDOW_TRANSPARENCY;
    app_window = new BrowserWindow({//BASE WINDOW
      width: 1280,
      height: 800,
      frame: false,
      skipTaskbar: true,  // Hide from taskbar - parent (shader_window) is the taskbar entry
      opacity: appOpacity,  // 0 = fully invisible, click-through enabled
      parent: shader_window,  // Make Window A a child of Window B so it stays above
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    const forwardClicks = appOpacity <= 0.01 ? true : SHADER_WINDOW_CLICKTHROUGH;
    shader_window.setIgnoreMouseEvents(forwardClicks, { forward: forwardClicks });

    const ensureOverlayVisible = () => {
      if (!shader_window.isDestroyed() && !shader_window.isVisible()) {
        shader_window.showInactive();
        shader_window.setVisibleOnAllWorkspaces(true);
      }
    };

    app_window.on('focus', ensureOverlayVisible);
    app_window.on('show', ensureOverlayVisible);
    app_window.on('restore', ensureOverlayVisible);
    app_window.on('activate', ensureOverlayVisible);

    if (SYNC_WINDOWS) {
      let isSyncing = false;
      let hadParent = true;

      const sync_windows = () => {
        if (isSyncing || shader_window.isDestroyed()) return;
        isSyncing = true;
        const bounds = app_window.getBounds();
        shader_window.setBounds(bounds, false);
        isSyncing = false;
      };

      app_window.on('will-move', () => {
        if (!shader_window.isDestroyed() && hadParent) {
          shader_window.setParentWindow(null);
          shader_window.setAlwaysOnTop(true, 'screen-saver', 1);
          hadParent = false;
        }
      });

      app_window.on('moved', () => {
        if (!shader_window.isDestroyed()) {
          sync_windows();
          shader_window.setAlwaysOnTop(false);
          shader_window.setParentWindow(app_window);
          hadParent = true;
        }
      });

      app_window.on('will-resize', () => {
        if (!shader_window.isDestroyed() && hadParent) {
          shader_window.setParentWindow(null);
          shader_window.setAlwaysOnTop(true, 'screen-saver', 1);
          hadParent = false;
        }
      });

      app_window.on('resized', () => {
        if (!shader_window.isDestroyed()) {
          sync_windows();
          shader_window.setAlwaysOnTop(false);
          shader_window.setParentWindow(app_window);
          hadParent = true;
        }
      });

      app_window.on('move', sync_windows);
      app_window.on('resize', sync_windows);

      app_window.on('maximize', () => {
        if (!shader_window.isDestroyed()) shader_window.maximize();
      });
      app_window.on('unmaximize', () => {
        if (!shader_window.isDestroyed()) shader_window.unmaximize();
      });
      app_window.on('minimize', () => {
        if (!shader_window.isDestroyed()) shader_window.minimize();
      });
      app_window.on('restore', () => {
        if (!shader_window.isDestroyed()) {
          shader_window.restore();
          shader_window.showInactive();
        }
      });

      sync_windows();
    }

    shader_window.loadURL('http://localhost:5173/shader_window.html');

    // IPC handlers for WebCodecs video pipeline - route structured payloads as-is
    ipcMain.handle('get-window-source-id', () => windowSourceId);
    ipcMain.on('send-video-chunk', (_event, payload) => {
      if (shader_window && !shader_window.isDestroyed()) {
        shader_window.webContents.send('video-chunk', payload);
      }
    });

    app_window.webContents.on('did-finish-load', () => {
      console.log('🔧 Main window loaded (invisible but interactive)');
      windowSourceId = app_window.webContents.getMediaSourceId();
      console.log('🎯 Directly acquired source ID:', windowSourceId);
    });
  } else {
    app_window = new BrowserWindow({
      width: 1280,
      height: 800,
      frame: false,
      skipTaskbar: false,
      opacity: 1,  // Visible when no overlay
      icon: path.join(__dirname, 'src/67_editing_software.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    ipcMain.handle('get-window-source-id', () => windowSourceId);

    app_window.webContents.on('did-finish-load', () => {
      console.log('🔧 Main window loaded (no shader overlay)');
    });
  }

  ipcMain.on('window-minimize', () => app_window.minimize());
  ipcMain.on('window-maximize', () => {
    if (app_window.isMaximized()) app_window.unmaximize();
    else app_window.maximize();
  });
  ipcMain.on('window-close', () => {
    if (shader_window && !shader_window.isDestroyed()) shader_window.close();
    app_window.close();
  });

  app_window.loadURL('http://localhost:5173');

  shader_window.on('closed', () => {
    shader_window = null;
  });
  app_window.on('closed', () => {
    app_window = null;
  });
});