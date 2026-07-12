const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const config = require('./config.json');
const DOWNSCALE_FACTOR = config.DOWNSCALE_FACTOR;
const SHADER_WINDOW = config.shader_window;
const BASE_WINDOW_TRANSPARENCY = config.base_window_transparency;
const SHADER_WINDOW_CLICKTHROUGH = config.shader_window_clickthrough;
const SYNC_WINDOWS = config.sync_windows;
const SHADER_WINDOW_SKIP_TASKBAR = config.shader_window_skip_taskbar;
const BASE_WINDOW_SKIP_TASKBAR = config.base_window_skip_taskbar

let app_window = null;      // Window A: main app (invisible but interactive)
let shader_window = null; // Window B: shader overlay

app.whenReady().then(() => {
  // --- Window B: Shader Overlay Window (Conditional) ---
  // Create Window B first so it can be the parent
  // Parent-child relationship ensures Window A (child) is always above Window B (parent)
  if (SHADER_WINDOW) {
    shader_window = new BrowserWindow({
      width: 1280,
      height: 800,
      x: 0,  // Start at same position as Window A
      y: 0,
      frame: false, // Frameless overlay
      transparent: true, // Transparent background
      skipTaskbar: SHADER_WINDOW_SKIP_TASKBAR, // Hide from taskbar
      show: true,  // Show immediately
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // --- Window A: Main App (Invisible but Interactive) ---
    // opacity: 0 makes it invisible but still fully interactive
    // parent: shader_window ensures Window A is always above Window B (child windows are above parents in Electron)
    app_window = new BrowserWindow({
      width: 1280,
      height: 800,
      frame: false,
      skipTaskbar: false,
      opacity: BASE_WINDOW_TRANSPARENCY,  // Use config value for transparency
      parent: shader_window,  // Make Window A a child of Window B so it stays above
      icon: path.join(__dirname, 'src/67_editing_software.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // Set click-through based on config
    // When true: clicks pass through to Window A
    // When false: clicks are captured by Window B
    shader_window.setIgnoreMouseEvents(SHADER_WINDOW_CLICKTHROUGH, { forward: !SHADER_WINDOW_CLICKTHROUGH });

    // Ensure overlay is visible when main window is used
    const ensureOverlayVisible = () => {
      if (!shader_window.isDestroyed()) {
        shader_window.show();
        shader_window.setVisibleOnAllWorkspaces(true);
      }
    };

    app_window.on('focus', ensureOverlayVisible);
    app_window.on('show', ensureOverlayVisible);
    app_window.on('restore', ensureOverlayVisible);
    app_window.on('activate', ensureOverlayVisible);

    // Sync windows position, size, maximize, and minimize state when enabled
    if (SYNC_WINDOWS) {
      // Sync position
      app_window.on('move', () => {
        if (!shader_window.isDestroyed()) {
          const [x, y] = app_window.getPosition();
          shader_window.setPosition(x, y);
        }
      });

      // Sync size
      app_window.on('resize', () => {
        if (!shader_window.isDestroyed()) {
          const [width, height] = app_window.getSize();
          shader_window.setSize(width, height);
        }
      });

      // Sync maximize state
      app_window.on('maximize', () => {
        if (!shader_window.isDestroyed()) {
          shader_window.maximize();
        }
      });

      app_window.on('unmaximize', () => {
        if (!shader_window.isDestroyed()) {
          shader_window.unmaximize();
        }
      });

      // Sync minimize state
      app_window.on('minimize', () => {
        if (!shader_window.isDestroyed()) {
          shader_window.minimize();
        }
      });

      app_window.on('restore', () => {
        if (!shader_window.isDestroyed()) {
          shader_window.restore();
        }
      });
    }

    // Load overlay HTML via Vite dev server
    shader_window.loadURL('http://localhost:5173/overlay.html');

    // --- Capture loop ---
    const startCaptureLoop = () => {
      let isCapturing = false;

      const capture = () => {
        if (!app_window || !shader_window || shader_window.isDestroyed() || isCapturing) {
          setTimeout(capture, 16);
          return;
        }

        isCapturing = true;

        app_window.webContents.capturePage().then((image) => {
          const bounds = app_window.getBounds();
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
          shader_window.webContents.send('frame-data', buffer, captureWidth, captureHeight);

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
    app_window.webContents.on('did-finish-load', () => {
      console.log('🔧 Main window loaded (invisible but interactive)');
      startCaptureLoop();
    });
  } else {
    // No overlay - Window A is the only window
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

    app_window.webContents.on('did-finish-load', () => {
      console.log('🔧 Main window loaded (no shader overlay)');
    });
  }

  // DEBUG: export a single screenshot 5 seconds after load
  const fs = require('fs');
  setTimeout(async () => {
    try {
      console.log('🔍 Taking debug screenshot...');
      const image = await app_window.webContents.capturePage();
      const desktopPath = path.join(require('os').homedir(), 'Desktop', 'window-a-capture.png');
      fs.writeFileSync(desktopPath, image.toPNG());
      console.log('🔍 Debug screenshot saved to:', desktopPath);
    } catch (err) {
      console.error('🔍 Debug screenshot failed:', err);
    }
  }, 5000);

  // --- Window control IPC handlers ---
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

  // Handle overlay close gracefully
  shader_window.on('closed', () => {
    shader_window = null;
  });
  app_window.on('closed', () => {
    app_window = null;
  });
});
