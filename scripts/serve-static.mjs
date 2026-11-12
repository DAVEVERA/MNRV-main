import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, normalize, relative as relativePath, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf'
};

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = normalize(pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  const file = join(root, relative);
  const pathFromRoot = relativePath(root, file);

  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const details = await stat(file);
    if (!details.isFile()) throw new Error('not-file');
    response.writeHead(200, {
      'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Static server listening on http://127.0.0.1:${port}\n`);
});
