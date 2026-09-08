import { createHallBackend } from '../backend/hall';
import { resolve } from 'node:path';
const backend = createHallBackend();
const port = Number(process.env.PORT || 4174);
Bun.serve({ port, hostname: '0.0.0.0', async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === '/api/hall') return backend.handle(request);
  if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404 });
  if (url.pathname === '/' || url.pathname === '/index.html') return new Response(Bun.file(resolve('dist/index.html')), { headers: { 'Content-Type': 'text/html' } });
  return new Response('Not found', { status: 404 });
} });
console.log(`Common Ground backend and wall: http://localhost:${port}`);
