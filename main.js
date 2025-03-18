const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const screenshot = require('screenshot-desktop');
const nodemailer = require('nodemailer');
// Load environment variables from .env file
require('dotenv').config();
let questionNumber = 1;

const RENDER_URL = 'https://electron-project.onrender.com';

let mainWindow = null;
let isOverlayVisible = true; // Default to visible

// Movement and sizing settings
const MOVE_STEP = 100; // Pixels to move per key press
const RESIZE_STEP = 20; // Pixels to resize per key press

// Email settings - using environment variables
const EMAIL_CONFIG = {
  recipient: process.env.EMAIL_RECIPIENT || '', // From environment variable
  // SMTP configuration - using environment variables
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER || '', // From environment variable
      pass: process.env.EMAIL_PASS || ''  // From environment variable
    }
  }
};

// Create a temp directory if it doesn't exist
const tempDir = path.join(app.getPath('temp'), 'electron-screenshots');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Create a screenshots directory for saving
const screenshotsDir = path.join(app.getPath('documents'), 'ElectronScreenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Configure email transporter using the provided SMTP settings
const transporter = nodemailer.createTransport(EMAIL_CONFIG.smtp);

// Function to capture and save screenshot locally
async function captureAndSaveScreenshot() {
  try {
    // Let the user know something is happening
    if (mainWindow && !mainWindow.isDestroyed()) {
      const wasInvisible = !isOverlayVisible;
      
      // Flash the window to indicate screenshot is being taken
      mainWindow.setOpacity(0.9);
      setTimeout(() => {
        if (wasInvisible) {
          mainWindow.setOpacity(0);
        } else {
          mainWindow.setOpacity(1);
        }
      }, 300);
    }
    
    console.log('Taking screenshot...');
    
    // Generate filename with question number and date
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
    const screenshotPath = path.join(screenshotsDir, `question-${questionNumber}-${dateStr}.png`);
    
    // Capture the screenshot
    await screenshot({ filename: screenshotPath });
    
    console.log(`Screenshot for question ${questionNumber} saved to: ${screenshotPath}`);
    
    // Increment the question number for the next screenshot
    questionNumber++;
    
    // Update the question number in the renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        if (typeof updateQuestionNumber === 'function') {
          updateQuestionNumber(${questionNumber});
        }
      `).catch(err => console.error('Error updating question number in renderer:', err));
    }
    
  } catch (error) {
    console.error('Error capturing or saving screenshot:', error);
  }
}

// Function to capture and send screenshot
async function captureAndSendScreenshot() {
  try {
    // Let the user know something is happening
    if (mainWindow && !mainWindow.isDestroyed()) {
      const wasInvisible = !isOverlayVisible;
      
      // Flash the window to indicate screenshot is being taken
      mainWindow.setOpacity(0.9);
      setTimeout(() => {
        if (wasInvisible) {
          mainWindow.setOpacity(0);
        } else {
          mainWindow.setOpacity(1);
        }
      }, 300);
    }
    
    console.log('Taking screenshot...');
    
    // Capture the screenshot
    const screenshotPath = path.join(tempDir, `screenshot-${Date.now()}.png`);
    await screenshot({ filename: screenshotPath });
    
    console.log('Screenshot taken, sending email...');
    
    // Send email with screenshot
    const mailOptions = {
      from: EMAIL_CONFIG.smtp.auth.user,
      to: EMAIL_CONFIG.recipient,
      subject: `Question ${questionNumber} Screenshot`,
      text: `This is question ${questionNumber} screenshot taken at ${new Date().toLocaleString()}`,
      attachments: [
        {
          filename: `question-${questionNumber}.png`,
          path: screenshotPath
        }
      ]
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`Email sent with screenshot for question ${questionNumber}`);
    
    // Increment the question number for the next screenshot
    questionNumber++;
    
    // Update the question number in the renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        if (typeof updateQuestionNumber === 'function') {
          updateQuestionNumber(${questionNumber});
        }
      `).catch(err => console.error('Error updating question number in renderer:', err));
    }
    
    // Clean up the screenshot file
    setTimeout(() => {
      try {
        if (fs.existsSync(screenshotPath)) {
          fs.unlinkSync(screenshotPath);
        }
      } catch (error) {
        console.error('Error cleaning up screenshot:', error);
      }
    }, 5000); // Clean up after 5 seconds
    
  } catch (error) {
    console.error('Error capturing or sending screenshot:', error);
  }
}

function createWindow() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 280, // Smaller width
    height: 400, // Smaller height
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false, // Prevents the window from stealing focus
    fullscreenable: false,
    resizable: false, // We'll handle resizing with shortcuts
    x: width - 300, // Position it on the right side
    y: height - 450, // Position it near the bottom
    type: 'panel', // Makes it a floating panel on macOS
    acceptFirstMouse: false, // Don't accept mouse events
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, 
      allowRunningInsecureContent: false 
    }
  });

  // Make window click-through (won't capture mouse events)
  mainWindow.setIgnoreMouseEvents(true);

  // Set to be on top of all other windows, including full-screen applications
  mainWindow.setAlwaysOnTop(true, 'screen-saver'); // highest level, above full-screen windows
  
  // Additional setting for macOS to ensure it stays above full-screen apps
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    app.dock.hide(); // Hide from dock for a true overlay experience
  }

  // Restore proper Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https://electron-project.onrender.com https://cdn.socket.io; " +
          "script-src 'self' 'unsafe-inline' https://cdn.socket.io; " + 
          "style-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' https://electron-project.onrender.com wss://electron-project.onrender.com;"
        ]
      }
    });
  });

  // Log loading events
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('Started loading...');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Finished loading');
    
    // Set initial question number
    mainWindow.webContents.executeJavaScript(`
      if (typeof updateQuestionNumber === 'function') {
        updateQuestionNumber(${questionNumber});
      }
    `).catch(err => console.error('Error setting initial question number:', err));
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Load the receiver page locally instead of from Render
  mainWindow.loadFile(path.join(__dirname, 'public', 'receiver.html'));

  // Custom function to toggle visibility without using show/hide
  global.toggleOverlayVisibility = () => {
    if (isOverlayVisible) {
      // Instead of hiding (which can cause issues), make fully transparent
      mainWindow.setOpacity(0);
      isOverlayVisible = false;
    } else {
      // Restore opacity
      mainWindow.setOpacity(1);
      isOverlayVisible = true;
      // Ensure on top
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  };
  
  // Function to move the window
  global.moveWindow = (direction) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    const [x, y] = mainWindow.getPosition();
    
    // Temporarily make the window more visible if it's not visible
    const wasInvisible = !isOverlayVisible;
    if (wasInvisible) {
      mainWindow.setOpacity(0.5); // Make semi-visible during movement
    }
    
    // Add a subtle flash effect to indicate movement
    mainWindow.setOpacity(0.8);
    setTimeout(() => {
      if (wasInvisible) {
        mainWindow.setOpacity(0); // Return to invisible if it was invisible before
      } else {
        mainWindow.setOpacity(1); // Return to fully visible
      }
    }, 300);
    
    switch (direction) {
      case 'up':
        mainWindow.setPosition(x, y - MOVE_STEP);
        break;
      case 'down':
        mainWindow.setPosition(x, y + MOVE_STEP);
        break;
      case 'left':
        mainWindow.setPosition(x - MOVE_STEP, y);
        break;
      case 'right':
        mainWindow.setPosition(x + MOVE_STEP, y);
        break;
    }
  };

  // Function to resize the window
  global.resizeWindow = (direction) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    const [width, height] = mainWindow.getSize();
    
    // Temporarily make the window more visible if it's not visible
    const wasInvisible = !isOverlayVisible;
    if (wasInvisible) {
      mainWindow.setOpacity(0.5); // Make semi-visible during resizing
    }
    
    // Add a subtle flash effect to indicate movement
    mainWindow.setOpacity(0.8);
    setTimeout(() => {
      if (wasInvisible) {
        mainWindow.setOpacity(0); // Return to invisible if it was invisible before
      } else {
        mainWindow.setOpacity(1); // Return to fully visible
      }
    }, 300);
    
    switch (direction) {
      case 'wider':
        mainWindow.setSize(width + RESIZE_STEP, height);
        break;
      case 'narrower':
        mainWindow.setSize(Math.max(200, width - RESIZE_STEP), height); // Minimum width of 200
        break;
      case 'taller':
        mainWindow.setSize(width, height + RESIZE_STEP);
        break;
      case 'shorter':
        mainWindow.setSize(width, Math.max(150, height - RESIZE_STEP)); // Minimum height of 150
        break;
    }
  };

  // Function to reset or set the question number
  global.setQuestionNumber = (number) => {
    if (number === undefined || number === null) {
      // If no number is provided, reset to 1
      questionNumber = 1;
    } else if (typeof number === 'number' && number > 0) {
      // Set to the provided number if it's valid
      questionNumber = number;
    }
    
    // Flash the window to indicate the question number has been set
    const wasInvisible = !isOverlayVisible;
    if (wasInvisible) {
      mainWindow.setOpacity(0.5);
    }
    
    // Flash 3 times quickly to indicate question number reset
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      mainWindow.setOpacity(flashCount % 2 === 0 ? 0.9 : 0.3);
      flashCount++;
      
      if (flashCount > 5) {
        clearInterval(flashInterval);
        if (wasInvisible) {
          mainWindow.setOpacity(0);
        } else {
          mainWindow.setOpacity(1);
        }
      }
    }, 100);
    
    // Update the display in the renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        if (typeof updateQuestionNumber === 'function') {
          updateQuestionNumber(${questionNumber});
        }
      `).catch(err => console.error('Error updating question number in renderer:', err));
    }
    
    console.log(`Question number set to: ${questionNumber}`);
  };
}

app.whenReady().then(() => {
  createWindow();

  // Use a special global shortcut for toggling visibility (Option+Space is less common)
  globalShortcut.register('Command+B', () => {
    global.toggleOverlayVisibility();
  });
  
  // Also register Command+Shift+O as an alternative that won't conflict with browsers
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    global.toggleOverlayVisibility();
  });
  
  // Register movement shortcuts with Command+Arrow keys
  globalShortcut.register('CommandOrControl+Up', () => {
    global.moveWindow('up');
  });
  
  globalShortcut.register('CommandOrControl+Down', () => {
    global.moveWindow('down');
  });
  
  globalShortcut.register('CommandOrControl+Left', () => {
    global.moveWindow('left');
  });
  
  globalShortcut.register('CommandOrControl+Right', () => {
    global.moveWindow('right');
  });
  
  // Register resize shortcuts with Command+Shift+Arrow keys
  globalShortcut.register('CommandOrControl+Shift+Right', () => {
    global.resizeWindow('wider');
  });
  
  globalShortcut.register('CommandOrControl+Shift+Left', () => {
    global.resizeWindow('narrower');
  });
  
  globalShortcut.register('CommandOrControl+Shift+Up', () => {
    global.resizeWindow('taller');
  });
  
  globalShortcut.register('CommandOrControl+Shift+Down', () => {
    global.resizeWindow('shorter');
  });
  
  // Register screenshot and email shortcut (Command+H)
  globalShortcut.register('CommandOrControl+H', () => {
    // Use save locally function by default since it doesn't require configuration
    // captureAndSaveScreenshot();
    
    // Uncomment this line and comment out the one above if you want to use email
    captureAndSendScreenshot();
  });
  
  // Reset question number to 1 (Command+0)
  globalShortcut.register('CommandOrControl+0', () => {
    global.setQuestionNumber(1);
  });
  
  // Set question number to 2-9 (Command+1 through Command+9)
  for (let i = 1; i <= 9; i++) {
    globalShortcut.register(`CommandOrControl+${i}`, () => {
      global.setQuestionNumber(i);
    });
  }
  
  // Set up a timer to ensure the window stays on top and visible
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed() && isOverlayVisible) {
      // Ensure we're always on top
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      
      // On macOS, ensure we're visible on all workspaces including full-screen apps
      if (process.platform === 'darwin') {
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      }
    }
  }, 2000); // Check every 2 seconds
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