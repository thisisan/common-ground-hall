import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const html = new URL('../dist/index.html', import.meta.url);
const port = Number(process.env.PORT || 4173);
createServer(async (request, response) => {
  if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (request.url !== '/' && !request.url?.startsWith('/?') && request.url !== '/index.html') { response.writeHead(404); response.end('Not found'); return; }
  try { const content = await readFile(html); response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(content); }
  catch { response.writeHead(503); response.end('Run npm run build first.'); }
}).listen(port, '0.0.0.0', () => console.log(`Common Ground: http://localhost:${port}`));
