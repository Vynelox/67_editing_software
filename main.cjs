const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const config = require('./config.json');
const DOWNSCALE_FACTOR = config.DOWNSCALE_FACTOR;
const SHADER_WINDOW = config.shader_window;
const BASE_WINDOW_TRANSPARENCY = config.base_window_transparency;
const SHADER_WINDOW_CLICKTHROUGH = config.shader_window_clickthrough;
const SYNC_WINDOWS = config.sync_windows;
const ENSHITTIFY = config.enshittify;
const SLIDESHOW = config.slideshow;

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
    // opacity: 0 makes it invisible but still fully interactive
    // parent: shader_window ensures Window A is always above Window B (child windows are above parents in Electron)
    const appOpacity = BASE_WINDOW_TRANSPARENCY < 0.004 ? 0 : BASE_WINDOW_TRANSPARENCY;
    app_window = new BrowserWindow({
      width: 1280,
      height: 800,
      frame: false,
      skipTaskbar: true,  // Hide from taskbar - parent (shader_window) is the taskbar entry
      opacity: appOpacity,  // Use config value, clamped to avoid breakage
      parent: shader_window,  // Make Window A a child of Window B so it stays above
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
    // SPECIAL CASE: if app window is invisible (opacity 0), always forward clicks to it
    const forwardClicks = appOpacity === 0 ? true : SHADER_WINDOW_CLICKTHROUGH;
    shader_window.setIgnoreMouseEvents(forwardClicks, { forward: forwardClicks });

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
      let isSyncing = false;  // Prevent recursive syncing

      // Sync both position and size of shader window to app window
      const sync_windows = () => {
        if (isSyncing || shader_window.isDestroyed()) return;
        isSyncing = true;
        const [x, y] = app_window.getPosition();
        const [width, height] = app_window.getSize();
        shader_window.setPosition(x, y);
        shader_window.setSize(width, height);
        isSyncing = false;
      };

      // Sync on move (position + size)
      app_window.on('move', sync_windows);

      // Sync on resize (position + size)
      app_window.on('resize', sync_windows);

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

      // Sync windows once at startup
      sync_windows();
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
          //only do this if enshittify is true, because the following operation makes
          //the whole image look shit:
          let buffer; //use let instead of const otherwise the if statement will fuck you up
          let finalWidth, finalHeight;
          if (ENSHITTIFY){
            const smallImage = image.resize({
            width: captureWidth,
            height: captureHeight,
            quality: 'good'
          });
            buffer = smallImage.toBitmap();
            finalWidth = image.getSize().width;
            finalHeight = image.getSize().height;
          }
          else{
            buffer = image.toBitmap();
            // 👈 CRITICAL: Get the ACTUAL native dimensions of the captured image
            finalWidth = image.getSize().width;
            finalHeight = image.getSize().height;
          }
          

          

          // Send the buffer
          shader_window.webContents.send('frame-data', buffer, finalWidth, finalHeight); //w, h

          isCapturing = false;
          if(SLIDESHOW){
            setTimeout(capture, 100); // ~60 FPS target
          }
          else{
            setTimeout(capture, 0); // ~60 FPS target
          }

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
