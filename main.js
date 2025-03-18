const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

const RENDER_URL = 'https://electron-project.onrender.com';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // Set proper Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https://electron-project.onrender.com https://cdn.socket.io; " +
          "script-src 'self' https://cdn.socket.io; " +
          "style-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' https://electron-project.onrender.com wss://electron-project.onrender.com ws://electron-project.onrender.com;"
        ]
      }
    });
  });

  // Enable DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Log loading events
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('Started loading...');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Finished loading');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Load the receiver page
  mainWindow.loadURL(RENDER_URL + '/receiver');
}

app.whenReady().then(() => {
  createWindow();

  // Register Command+B (or Control+B) shortcut
  globalShortcut.register('CommandOrControl+B', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});