// Serveur LOCAL de test (Node >= 18). En production, Vercel utilise api/ + public/.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle } = require('./lib/app');
const store = require('./lib/store-file');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return handle(req, res, store);
  const p = url.pathname === '/' ? '/index.html' : url.pathname === '/admin' ? '/admin.html' : url.pathname;
  const f = path.normalize(path.join(PUBLIC, p));
  if (!f.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`Client     : http://localhost:${PORT}`);
  console.log(`Entreprise : http://localhost:${PORT}/admin   (code : ${process.env.ADMIN_PIN || 'speedcore'})`);
});
