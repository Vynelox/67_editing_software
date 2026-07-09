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

  // --- Window B: Debug Window (will make transparent later) ---
  // For now: visible, opaque, with frame to verify it works
  overlayWin = new BrowserWindow({
    width: 1280,
    height: 800,
    x: win.getBounds().x + 50, // Offset slightly to see it
    y: win.getBounds().y + 50,
    frame: true, // Visible frame for debugging
    transparent: false, // Opaque for debugging
    alwaysOnTop: false, // Not always on top for debugging
    skipTaskbar: false, // Show in taskbar for debugging
    show: true, // Show immediately
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load overlay HTML via Vite dev server
  overlayWin.loadURL('http://localhost:5173/overlay.html');
  console.log('🔧 Overlay window created (debug mode - visible)');

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

  // --- Capture loop: capturePage() on main window, send pixels to overlay ---
  const startCaptureLoop = () => {
    const capture = () => {
      if (!win || !overlayWin || overlayWin.isDestroyed()) return;

      win.webContents.capturePage().then((image) => {
        const size = image.getSize();
        const buffer = image.toBitmap(); // Raw RGBA pixels as Buffer
        const rawBuffer = buffer.buffer
          ? buffer.buffer
          : buffer; // Get ArrayBuffer from Node Buffer

         // Send the raw pixel data to the overlay window
         overlayWin.webContents.send('frame-data', buffer, size.width, size.height);

         // Schedule next capture at ~30-60 FPS using setTimeout
        setTimeout(capture, 16); // ~60 FPS
      }).catch((err) => {
        console.error('🔧 Capture error:', err);
        setTimeout(capture, 100); // slower retry on error
      });
    };

    capture();
  };

  // Start capture loop after main window loads
  win.webContents.on('did-finish-load', () => {
    console.log('🔧 Main window loaded, starting capture loop');
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