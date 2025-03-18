const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

// Change this to your deployed server URL once you have it
const SERVER_URL = process.env.SERVER_URL || 'https://electron-project.onrender.com';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL(`${SERVER_URL}/receiver`);
  // mainWindow.webContents.openDevTools(); // Uncomment for debugging
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