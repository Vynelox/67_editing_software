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

  // --- Window B: Transparent Overlay ---
  overlayWin = new BrowserWindow({
    width: 1280,
    height: 800,
    x: win.getBounds().x,
    y: win.getBounds().y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false, // shown after it loads
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

  // Once overlay is loaded and ready, show it
  overlayWin.webContents.on('did-finish-load', () => {
    overlayWin.show();
    console.log('🔧 Overlay window loaded and shown');
  });

  // --- Sync overlay position/size with main window ---
  const syncBounds = () => {
    if (!win || !overlayWin) return;
    const bounds = win.getBounds();
    overlayWin.setBounds(bounds);
  };

  win.on('move', syncBounds);
  win.on('resize', syncBounds);

  // --- Capture loop: capturePage() on main window, send pixels to overlay ---
  const startCaptureLoop = () => {
    let isCapturing = false;

    const capture = () => {
      if (!win || !overlayWin || overlayWin.isDestroyed()) return;
      if (isCapturing) {
        requestAnimationFrame(capture);
        return;
      }

      isCapturing = true;

      win.webContents.capturePage().then((image) => {
        const size = image.getSize();
        const buffer = image.toBitmap(); // Raw RGBA pixels as Buffer
        const rawBuffer = buffer.buffer
          ? buffer.buffer
          : buffer; // Get ArrayBuffer from Node Buffer

        // Send the raw pixel data to the overlay window
        overlayWin.webContents.send('frame', rawBuffer, size.width, size.height);

        isCapturing = false;
        requestAnimationFrame(capture);
      }).catch((err) => {
        console.error('🔧 Capture error:', err);
        isCapturing = false;
        requestAnimationFrame(capture);
      });
    };

    capture();
  };

  // Start capture loop after main window loads
  win.webContents.on('did-finish-load', () => {
    console.log('🔧 Main window loaded, starting capture loop');
    startCaptureLoop();
  });

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