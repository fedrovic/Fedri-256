const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 5000;
const publicDir = path.join(__dirname, '..', 'public');

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=UTF-8'
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    let safePath = path.normalize(path.join(publicDir, urlPath));
    if (!safePath.startsWith(publicDir)) {
      res.writeHead(400);
      return res.end('Bad request');
    }

    fs.stat(safePath, (err, stats) => {
      if (!err && stats.isDirectory()) {
        safePath = path.join(safePath, 'index.html');
      }

      fs.access(safePath, fs.constants.R_OK, (err) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
          return res.end('Not found');
        }
        sendFile(res, safePath);
      });
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('Server error');
  }
});

server.listen(port, () => {
  console.log(`Serving static files from ${publicDir} at http://localhost:${port}`);
});
