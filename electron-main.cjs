// Electron Main Entry Point for Windows (.exe) desktop packaging
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Custom User Agent to prevent Google OAuth from blocking embedded Electron webviews ("disallowed_useragent")
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Common MIME types for static HTTP server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

let server = null;

function findDistDir() {
  const possiblePaths = [
    path.join(__dirname, 'dist'),
    path.join(process.cwd(), 'dist'),
    __dirname
  ];
  const found = possiblePaths.find(p => fs.existsSync(path.join(p, 'index.html')));
  return found || __dirname;
}

function startStaticServer(distDir, callback) {
  server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    let filePath = path.join(distDir, reqUrl);

    // Prevent directory traversal
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      // Fallback to index.html for SPA route or missing static file
      if (err || stats.isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('404 Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
      });
    });
  });

  // Listen on port 3000 or dynamic available port on localhost
  server.listen(3000, '127.0.0.1', () => {
    const port = server.address().port;
    callback(`http://localhost:${port}`);
  }).on('error', () => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      callback(`http://localhost:${port}`);
    });
  });
}

function createWindow(targetUrl) {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 400,
    minHeight: 600,
    title: 'Plock — Planner & Diary',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  win.loadURL(targetUrl);
}

// Ensure EVERY WebContents (including Google Auth OAuth popups) uses Chrome User-Agent and allows popups
app.on('web-contents-created', (event, contents) => {
  contents.userAgent = CHROME_USER_AGENT;
  
  contents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false
        }
      }
    };
  });
});

app.whenReady().then(() => {
  const distDir = findDistDir();
  startStaticServer(distDir, (url) => {
    createWindow(url);
  });
});

app.on('window-all-closed', () => {
  if (server) {
    try { server.close(); } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});




