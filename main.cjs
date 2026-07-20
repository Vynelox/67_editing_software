const path = require('path');
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const config = require('./config.json');

/*
Good question — let me break this down from first principles.
What's a "lifecycle"?
A lifecycle is the sequence of states something goes through from creation to destruction. Think of it like stages of life:
plain
birth → childhood → adulthood → death
For software objects, it's similar:
plain
created → initialized → running → shutting down → destroyed
What's a "lifecycle object"?
A lifecycle object is an object that:
Tracks which stage it's currently in
Notifies other code when it transitions between stages
Provides hooks for you to run code at specific stages
It's the central coordinator that says "I'm starting up now," "I'm ready," "I'm quitting."
*/


const DOWNSCALE_FACTOR = config.DOWNSCALE_FACTOR;
const SHADER_WINDOW = config.shader_window;
const BASE_WINDOW_TRANSPARENCY = config.base_window_transparency;
const SHADER_WINDOW_CLICKTHROUGH = config.shader_window_clickthrough;
const SYNC_WINDOWS = config.sync_windows;
const ENSHITTIFY = config.enshittify;
const SLIDESHOW = config.slideshow;
const lowest_possible_opacity = 0.004;

//These two lines declare variables to hold references
//to the application's two windows.
let app_window = null;      // Window A: main app (invisible but interactive)
let shader_window = null;   // Window B: shader overlay

/*
okay so basically there's two types of lines of code: regular lines and promise lines.
if a line doesn't return a promose, it could be a 1 billion year long calculation,
putting await won't skip it. but if you use specific functions like fetch or new promise,
it doesn't matter if it takes a nanosecond to execute, if there's no await,
the next line returns the promise object. if there is an await, the next line will wait
for the promise object to finish and then give the true answer.

oh and if you make a promise on line 1 and by line 2 its already resolved, even if you
log it at line 10,000, if there's no await, it still gives the promise object even though
it's already resolved
*/

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
    const appOpacity = BASE_WINDOW_TRANSPARENCY < lowest_possible_opacity ? lowest_possible_opacity : BASE_WINDOW_TRANSPARENCY;
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

    
    shader_window.setIgnoreMouseEvents(SHADER_WINDOW_CLICKTHROUGH, { forward: SHADER_WINDOW_CLICKTHROUGH });

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
    ipcMain.handle('get-window-source-id', () => {
      if (app_window && app_window.webContents) {
        try {
          // Try with argument first (per Electron docs)
          const id = app_window.webContents.getMediaSourceId(app_window.webContents);
          console.log('✅ getMediaSourceId(arg) succeeded:', id);
          return id;
        } catch (e) {
          console.warn('⚠️ getMediaSourceId(arg) failed:', e.message);
          try {
            // Fallback: try without argument
            const id = app_window.webContents.getMediaSourceId();
            console.log('✅ getMediaSourceId(no arg) succeeded:', id);
            return id;
          } catch (e2) {
            console.error('🚨 CRITICAL: getMediaSourceId() failed both ways:', e2.message);
            return null;
          }
        }
      }
      console.warn('⚠️ app_window or webContents not available');
      return null;
    });
    
    ipcMain.handle('get-window-bounds', () => {
      if (app_window && !app_window.isDestroyed()) {
        const bounds = app_window.getBounds();
        console.log('Window bounds:', bounds);
        return bounds;
      }
      return null;
    });
    
    ipcMain.handle('create-window-stream', async () => {
      if (!app_window || app_window.isDestroyed()) {
        console.error('🚨 Window not available for stream creation');
        return null;
      }
      
      try {
        // Give DWM time to stabilize before enumerating sources (this avoids the deadlock)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const sources = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 0, height: 0 }, // Don't fetch thumbnails to save time
        });
        
        // Find the source that matches our app_window
        // The source ID from getMediaSourceId() is base64, but desktopCapturer uses 'window:PID:ID' format
        // We need to find the window that matches our app_window's bounds
        const targetBounds = app_window.getBounds();
        console.log('Target window bounds:', targetBounds);
        console.log('Available sources:', sources.map(s => ({ id: s.id, name: s.name })));
        
        // Try to find by matching the window ID pattern
        // getMediaSourceId returns base64 encoding of window ID, but desktopCapturer uses 'window:PID:ID'
        // The source ID might be in the format 'window:1234' where 1234 is the window ID
        
        // Try to extract potential matches by looking for window IDs in the sources
        const matchingSource = sources.find(s => {
          // Check if source id contains our target window's bounds information
          // This is a heuristic - we'll match the window that has similar dimensions
          return false; // Placeholder - we need to match by other means
        });
        
        // Since the ID formats are incompatible, let's try to match by finding the window
        // that has the same title or is the first window source
        
        // Fallback: Use the first window source that matches our dimensions
        const windowSources = sources.filter(s => s.id.startsWith('window:'));
        if (windowSources.length === 0) {
          console.error('🚨 No window sources found');
          return null;
        }
        
        // Try to find a match by checking the window title
        const targetTitle = app_window.getTitle();
        console.log('Target window title:', targetTitle);
        
        const matched = windowSources.find(s => {
          // Match by title or by size
          if (s.name && s.name.includes(targetTitle)) {
            console.log('✅ Matched by title:', s.name);
            return true;
          }
          // Fallback: if only one window source, use it
          if (windowSources.length === 1) {
            console.log('✅ Using only window source:', s.id);
            return true;
          }
          return false;
        });
        
        if (matched) {
          console.log('✅ Found matching window source:', matched.id);
          console.log('🔧 Creating stream from source...');
          const stream = await desktopCapturer.getSources({
            types: ['window'],
            thumbnailSize: { width: 0, height: 0 },
          });
          console.log('🔧 Stream created, finding target track...');
          const matchedTrack = stream.find(s => s.id === matched.id);
          if (matchedTrack) {
            console.log('✅ Found matched track');
            return matchedTrack;
          }
        }
        
        // Last resort: use the first window source
        console.log('⚠️ No match found, using first window source as fallback:', windowSources[0].id);
        console.log('🔧 Creating stream from fallback source...');
        const stream = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 0, height: 0 },
        });
        const fallbackTrack = stream.find(s => s.id === windowSources[0].id);
        if (fallbackTrack) {
          console.log('✅ Found fallback track');
          return fallbackTrack;
        }
      } catch (e) {
        console.error('🚨 Failed to create window stream:', e.message);
        return null;
      }
    });
    
    ipcMain.on('send-video-chunk', (_event, payload) => {
      console.log('🌉 Main Process: Received chunk, forwarding to shader_window');
      if (shader_window && !shader_window.isDestroyed()) {
        shader_window.webContents.send('video-chunk', payload);
      }
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

    ipcMain.handle('get-window-source-id', () => {
      if (app_window && app_window.webContents) {
        // Pass app_window.webContents as the required requestWebContents argument
        return app_window.webContents.getMediaSourceId(app_window.webContents);
      }
      return null;
    });

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