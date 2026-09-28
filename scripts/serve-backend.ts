import { createHallBackend } from '../backend/hall';
import { residentProfiles } from '../residents.js';
import { resolve } from 'node:path';
const backend = createHallBackend({ seedProfiles: process.env.HALL_SKIP_SEED ? undefined : residentProfiles });
const port = Number(process.env.PORT || 4174);
Bun.serve({ port, hostname: '0.0.0.0', async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === '/api/hall') return backend.handle(request);
  if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404 });
  if (url.pathname === '/' || url.pathname === '/index.html') return new Response(Bun.file(resolve('dist/index.html')), { headers: { 'Content-Type': 'text/html' } });
  return new Response('Not found', { status: 404 });
} });
console.log(`SKY Lee Social Wall backend and wall: http://localhost:${port}`);
