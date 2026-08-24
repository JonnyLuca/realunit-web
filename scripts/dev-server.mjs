import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from '../tests/pages.mjs';

// Cloudflare Pages serves the contents of public/ at the site root. Mirror that
// here so the test suite and local preview exercise the same URLs as production.
const root = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const port = process.env.PORT ? Number(process.env.PORT) : PORT;

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

const notFoundPage = join(root, '404.html');

function send(response, status, body = '') {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(body);
}

// Serve the custom 404 page with a real 404 status, exactly as Cloudflare Pages
// does for an unmatched path.
function sendNotFound(response) {
  if (existsSync(notFoundPage) && statSync(notFoundPage).isFile()) {
    response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    createReadStream(notFoundPage).pipe(response);
    return;
  }
  send(response, 404, 'Not Found');
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const cleanPath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(root, cleanPath === '/' ? 'index.html' : cleanPath);
  const resolved = resolve(filePath);

  if (!resolved.startsWith(root)) {
    return null;
  }

  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return join(resolved, 'index.html');
  }

  return resolved;
}

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, 'Method Not Allowed');
    return;
  }

  const filePath = resolveRequestPath(request.url || '/');

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    const pathname = decodeURIComponent(
      new URL(request.url || '/', `http://127.0.0.1:${port}`).pathname,
    );
    if (pathname.startsWith('/invite/')) {
      request.url = '/invite/index.html';
    } else if (pathname.startsWith('/promo/')) {
      request.url = '/promo/index.html';
    }
    if (request.url === '/invite/index.html' || request.url === '/promo/index.html') {
      const rewritten = resolveRequestPath(request.url);
      if (rewritten && existsSync(rewritten) && statSync(rewritten).isFile()) {
        response.writeHead(200, {
          'content-type': mimeTypes.get(extname(rewritten)) || 'application/octet-stream',
        });
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        createReadStream(rewritten).pipe(response);
        return;
      }
    }
    sendNotFound(response);
    return;
  }

  response.writeHead(200, {
    'content-type': mimeTypes.get(extname(filePath)) || 'application/octet-stream',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}`);
});
