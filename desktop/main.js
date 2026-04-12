const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let javaProcess;
const BACKEND_PORT = 8080;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    title: "Global Missile Warfare",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#0a0a1a'
  });

  // Loading screen or directly load the URL
  // We'll wait for the server to be ready
  checkBackendReady(() => {
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function checkBackendReady(callback) {
  const req = http.get(`http://localhost:${BACKEND_PORT}`, (res) => {
    callback();
  });

  req.on('error', () => {
    setTimeout(() => checkBackendReady(callback), 1000);
  });
}

function startBackend() {
  // Option B: Using the bundled JRE
  const jrePath = path.join(__dirname, 'jre', 'bin', 'java.exe');
  const jarPath = path.join(__dirname, 'game-backend.jar');

  javaProcess = spawn(jrePath, ['-jar', jarPath], {
    cwd: __dirname
  });

  javaProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  javaProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
}

app.on('ready', () => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (javaProcess) javaProcess.kill();
    app.quit();
  }
});

app.on('will-quit', () => {
  if (javaProcess) javaProcess.kill();
});
