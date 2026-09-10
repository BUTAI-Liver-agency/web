// Optional local preview only. GitHub Pages serves the static files directly.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const port = Number(flag('--port', process.env.PORT || '4173'));
const host = flag('--host', '0.0.0.0');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };
http.createServer(async (req, res) => {
  try {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    if (!['index.html', 'styles.css', 'script.js'].includes(relative) && !/^img\/[a-z0-9_-]+\.(png|jpg)$/i.test(relative)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const data = await readFile(path.join(root, relative));
    res.writeHead(200, { 'Content-Type': types[path.extname(relative)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, host, () => console.log(`Local: http://localhost:${port}/`));
