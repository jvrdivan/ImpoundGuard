// scripts/dev-server.mjs
//
// Serves the built app and runs the api/ handlers in one process, so the full
// stack can be exercised locally without the Vercel CLI. Approximates what
// `vercel dev` does; it is a test harness, not a production server.
//
//   npm run build && DATABASE_URL=... node scripts/dev-server.mjs

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 5173);

const routes = {
  '/api/fleet': (await import('../api/fleet.js')).default,
  '/api/reset': (await import('../api/reset.js')).default,
  '/api/scan': (await import('../api/scan.js')).default,
  '/api/insights': (await import('../api/insights.js')).default,
};

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const handler = routes[url.pathname];

  if (handler) {
    req.body = await readBody(req);
    const shim = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) {
        res.writeHead(this.statusCode, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
        return this;
      },
    };
    try {
      await handler(req, shim);
    } catch (err) {
      console.error('handler threw:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Handler crashed.' }));
      }
    }
    return;
  }

  const filePath = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname);
  const resolved = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(dist, 'index.html');

  res.writeHead(200, { 'content-type': MIME[path.extname(resolved)] || 'application/octet-stream' });
  fs.createReadStream(resolved).pipe(res);
}).listen(port, () => console.log(`dev-server on http://localhost:${port}`));
