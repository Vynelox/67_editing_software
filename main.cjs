const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

let win = null;      // Window A: main app
let overlayWin = null; // Window B: transparent overlay

app.whenReady().then(() => {
  // --- Window A: Main App ---
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    icon: path.join(__dirname, 'src/67_editing_software.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // --- Window B: Transparent overlay window ---
  overlayWin = new BrowserWindow({
    width: 1280,
    height: 800,
    x: win.getBounds().x,
    y: win.getBounds().y,
    frame: false, // Frameless overlay
    transparent: true, // Transparent background
    alwaysOnTop: true, // Stay on top of other windows
    skipTaskbar: true, // Hide from taskbar
    show: false, // Show after ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Make overlay click-through so all interactions pass to main window
  overlayWin.setIgnoreMouseEvents(true, { forward: true });

  // Load overlay HTML via Vite dev server
  overlayWin.loadURL('http://localhost:5173/overlay.html');

  // --- Sync overlay position/size with main window ---
  // Also re-assert alwaysOnTop during move to prevent overlay falling behind main window
  const syncBounds = () => {
    if (!win || !overlayWin || overlayWin.isDestroyed()) return;
    const bounds = win.getBounds();
    overlayWin.setBounds(bounds);
    // Re-assert alwaysOnTop with screen-saver level for stronger z-order
    overlayWin.setAlwaysOnTop(true, 'screen-saver', -1);
  };

  win.on('move', syncBounds);
  win.on('resize', syncBounds);

  // --- Capture loop: optimized with downscaling to 0.5x ---
  const startCaptureLoop = () => {
    const DOWNSCALE_FACTOR = 0.5;
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

        // Resize the image to reduce data size (Optimization 1)
        const smallImage = image.resize({
          width: captureWidth,
          height: captureHeight,
          quality: 'good'
        });

        const buffer = smallImage.toBitmap();

        // Send the downscaled buffer (Optimization 2: smaller data = faster IPC)
        overlayWin.webContents.send('frame-data', buffer, captureWidth, captureHeight);

        isCapturing = false;
        setTimeout(capture, 16); // ~60 FPS target
      }).catch((err) => {
        console.error('🔧 Capture error:', err);
        isCapturing = false;
        setTimeout(capture, 100); // slower retry on error
      });
    };

    capture();
  };

  // Start capture loop and show overlay after main window loads
  win.webContents.on('did-finish-load', () => {
    console.log('🔧 Main window loaded, starting capture loop');
    overlayWin.show(); // Show frameless overlay
    console.log('🔧 Overlay window shown (frameless, transparent, click-through)');
    startCaptureLoop();
  });

  // DEBUG: export a single screenshot 5 seconds after load to verify capture works
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