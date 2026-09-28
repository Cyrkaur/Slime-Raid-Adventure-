/**
 * Raid of the Gel — Electron desktop shell (C1)
 * Serves the game root over localhost so vendor/ + import maps work offline,
 * then opens a BrowserWindow (no external CDN required when vendor/ is present).
 */
'use strict';

const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PREF_PORT = 18090;
let mainWindow = null;
let server = null;
let port = PREF_PORT;

/** Game root: project dir in dev; app.asar / app folder when packaged. */
function getRoot() {
  try {
    if (app && app.isPackaged) return app.getAppPath();
  } catch (e) { /* ignore */ }
  return path.resolve(__dirname, '..');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.map': 'application/json'
};

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0].split('#')[0]);
  const rel = decoded.replace(/^\/+/, '') || 'index.html';
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

function startServer() {
  const ROOT = getRoot();
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        let filePath = safeJoin(ROOT, req.url || '/');
        if (!filePath) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        // Prefer asar-unpacked for large media when packaged
        if (app.isPackaged && process.resourcesPath) {
          const rel = path.relative(ROOT, filePath);
          const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', rel);
          if (fs.existsSync(unpacked) && fs.statSync(unpacked).isFile()) {
            filePath = unpacked;
          }
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const data = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': contentType(filePath),
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
      } catch (e) {
        res.writeHead(500);
        res.end(String(e && e.message ? e.message : e));
      }
    });

    const tryListen = (p, attemptsLeft) => {
      server.once('error', (err) => {
        if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
          tryListen(p + 1, attemptsLeft - 1);
        } else {
          reject(err);
        }
      });
      server.listen(p, '127.0.0.1', () => {
        port = p;
        resolve(p);
      });
    };
    tryListen(PREF_PORT, 20);
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
}

function resolveAppIcon() {
  const root = getRoot();
  // Prefer packaged resources, then repo build/icons
  const candidates = [
    path.join(process.resourcesPath || '', 'icons', 'icon.png'),
    path.join(__dirname, 'icons', 'icon.png'),
    path.join(root, 'build', 'icons', 'icon.png'),
    path.join(__dirname, 'icons', 'icon.icns'),
    path.join(root, 'build', 'icons', 'icon.icns')
  ];
  for (let i = 0; i < candidates.length; i++) {
    try {
      if (candidates[i] && fs.existsSync(candidates[i])) return candidates[i];
    } catch (e) { /* ignore */ }
  }
  return undefined;
}

async function createWindow() {
  await startServer();

  const iconPath = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#02140c',
    title: 'Raid of the Gel',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false
  });
  if (process.platform === 'darwin' && iconPath && app.dock) {
    try { app.dock.setIcon(iconPath); } catch (eDock) { /* ignore */ }
  }

  Menu.setApplicationMenu(buildMenu());

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const url = 'http://127.0.0.1:' + port + '/index.html';
  await mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function shutdownServer() {
  if (server) {
    try { server.close(); } catch (e) { /* ignore */ }
    server = null;
  }
}

app.whenReady().then(createWindow).catch((err) => {
  console.error('[desktop] failed to start', err);
  app.quit();
});

app.on('window-all-closed', () => {
  shutdownServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((err) => console.error(err));
  }
});

app.on('before-quit', () => {
  shutdownServer();
});

// Avoid unused import warning in some linters
void pathToFileURL;
