const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const config = require('./config.json');
const DOWNSCALE_FACTOR = config.DOWNSCALE_FACTOR;
const SHADER_WINDOW = config.shader_window;
const BASE_WINDOW_TRANSPARENCY = config.base_window_transparency;

let win = null;      // Window A: main app (invisible but interactive)
let overlayWin = null; // Window B: shader overlay

app.whenReady().then(() => {
  // --- Window A: Main App (Invisible but Interactive) ---
  // opacity: 0 makes it invisible but still fully interactive
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    opacity: SHADER_WINDOW ? BASE_WINDOW_TRANSPARENCY : 1,  // Use config value when shader window enabled, visible otherwise
    icon: path.join(__dirname, 'src/67_editing_software.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // --- Window B: Shader Overlay Window (Conditional) ---
  if (SHADER_WINDOW) {
    overlayWin = new BrowserWindow({
      width: 1280,
      height: 800,
      x: 0,  // Start at same position as Window A
      y: 0,
      frame: false, // Frameless overlay
      transparent: true, // Transparent background
      alwaysOnTop: false,  // Window A is on top (invisible but receives input)
      skipTaskbar: true, // Hide from taskbar
      show: true,  // Show immediately
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // Load overlay HTML via Vite dev server
    overlayWin.loadURL('http://localhost:5173/overlay.html');

    // --- Capture loop ---
    const startCaptureLoop = () => {
      let isCapturing = false;

      const capture = () => {
        if (!win || !overlayWin || overlayWin.isDestroyed() || isCapturing) {
          setTimeout(capture, 16);
          return;
        }

        isCapturing = true;

        win.webContents.capturePage().then((image) => {
          const bounds = win.getBounds();
          const captureWidth = Math.floor(bounds.width * DOWNSCALE_FACTOR);
          const captureHeight = Math.floor(bounds.height * DOWNSCALE_FACTOR);

          // Resize the image
          const smallImage = image.resize({
            width: captureWidth,
            height: captureHeight,
            quality: 'good'
          });

          const buffer = smallImage.toBitmap();

          // Send the buffer
          overlayWin.webContents.send('frame-data', buffer, captureWidth, captureHeight);

          isCapturing = false;
          setTimeout(capture, 16); // ~60 FPS target
        }).catch((err) => {
          console.error('🔧 Capture error:', err);
          isCapturing = false;
          setTimeout(capture, 100);
        });
      };

      capture();
    };

    // Start capture loop after main window loads
    win.webContents.on('did-finish-load', () => {
      console.log('🔧 Main window loaded (invisible but interactive)');
      startCaptureLoop();
    });
  } else {
    // No overlay - window A is visible normally
    win.webContents.on('did-finish-load', () => {
      console.log('🔧 Main window loaded (no shader overlay)');
    });
  }

  // DEBUG: export a single screenshot 5 seconds after load
  const fs = require('fs');
  setTimeout(async () => {
    try {
      console.log('🔍 Taking debug screenshot...');
      const image = await win.webContents.capturePage();
      const desktopPath = path.join(require('os').homedir(), 'Desktop', 'window-a-capture.png');
      fs.writeFileSync(desktopPath, image.toPNG());
      console.log('🔍 Debug screenshot saved to:', desktopPath);
    } catch (err) {
      console.error('🔍 Debug screenshot failed:', err);
    }
  }, 5000);

  // --- Window control IPC handlers ---
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window-close', () => {
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.close();
    win.close();
  });

  win.loadURL('http://localhost:5173');

  // Handle overlay close gracefully
  overlayWin.on('closed', () => {
    overlayWin = null;
  });
  win.on('closed', () => {
    win = null;
  });
});