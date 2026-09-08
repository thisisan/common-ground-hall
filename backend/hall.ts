import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { validateSubmission } from '../profile-schema.js';

export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function checkPassword(password: unknown, hash: string) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [algorithm, salt, digest] = hash.split(':');
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(digest || '')) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, 'hex'));
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
class HallError extends Error { constructor(public status: number, message: string) { super(message); } }

export function createHallBackend(options: { dbPath?: string; adminPasswordHash?: string; allowedOrigins?: string[] } = {}) {
  const path = options.dbPath || process.env.HALL_DB_PATH || '.vibes/data.db';
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS cg_profiles (id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', featured INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cg_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, credential_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cg_audit (id INTEGER PRIMARY KEY, profile_id TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cg_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);`);
  const getHash = () => options.adminPasswordHash ?? process.env.HALL_ADMIN_PASSWORD_HASH ?? '';
  const allowedOrigins = options.allowedOrigins || (process.env.HALL_ALLOWED_ORIGINS || 'https://thisisan.github.io').split(',').map(s => s.trim()).filter(Boolean);
  const rowData = (row: any) => ({ ...JSON.parse(row.data), id: row.id, status: row.status, featured: !!row.featured, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at });
  const audit = (id: string, action: string) => db.query('INSERT INTO cg_audit(profile_id,action,created_at) VALUES(?,?,?)').run(id, action, new Date().toISOString());
  const limited = (key: string, max: number, windowMs: number) => {
    const now = Date.now();
    db.query('DELETE FROM cg_limits WHERE expires_at < ?').run(now);
    const row = db.query('SELECT count FROM cg_limits WHERE key=?').get(key) as any;
    if (row?.count >= max) throw new HallError(429, 'Please wait a few minutes before trying again.');
    db.query('INSERT INTO cg_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, now + windowMs);
  };
  const requireAdmin = (token: unknown) => {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new HallError(401, 'Please sign in to manage this wall.');
    db.query('DELETE FROM cg_sessions WHERE expires_at < ?').run(Date.now());
    const row = db.query('SELECT * FROM cg_sessions WHERE token_hash=?').get(digest(token)) as any;
    if (!row || row.credential_hash !== digest(getHash())) throw new HallError(401, 'Your admin session expired. Please sign in again.');
  };
  async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get('origin');
    const ownOrigin = new URL(request.url).origin;
    const acceptedOrigin = !origin || origin === ownOrigin || allowedOrigins.includes(origin);
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
    if (origin && acceptedOrigin) headers['Access-Control-Allow-Origin'] = origin;
    const response = (data: unknown, status = 200) => Response.json(data, { status, headers });
    try {
      if (!acceptedOrigin) throw new HallError(403, 'This website is not allowed to access the hall backend.');
      if (request.method === 'GET') {
        const view = new URL(request.url).searchParams.get('view');
        if (view === 'health') return response({ ok: true, storage: 'sqlite', moderation: true, manualRefresh: true });
        const rows = db.query("SELECT * FROM cg_profiles WHERE status='published' ORDER BY featured DESC, created_at DESC, id ASC").all();
        return response({ profiles: rows.map(rowData), updatedAt: new Date().toISOString() });
      }
      if (request.method !== 'POST') throw new HallError(405, 'Method not allowed.');
      if (Number(request.headers.get('content-length') || 0) > 16384) throw new HallError(413, 'This submission is too large.');
      // Stream to a strict byte limit, even when Content-Length is omitted.
      const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      if (reader) while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 16384) { await reader.cancel(); throw new HallError(413, 'This submission is too large.'); } chunks.push(value); }
      let input: any;
      try { input = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new HallError(400, 'Please send a valid submission.'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HallError(400, 'Please send a valid submission.');
      const action = input.action;
      // Every visitor shares this conservative global budget; prevents spoofed
      // proxy/IP headers from bypassing the throttle.
      if (action === 'login') {
        const hash = getHash();
        if (!hash) throw new HallError(503, 'The organizer needs to finish setting up admin access.');
        limited('login', 20, 10 * 60 * 1000);
        if (!checkPassword(input.password, hash)) throw new HallError(401, 'That password isn’t correct.');
        const token = randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
        db.query('INSERT INTO cg_sessions VALUES(?,?,?)').run(digest(token), expiresAt, digest(hash));
        return response({ token, expiresAt });
      }
      if (action === 'submit') {
        if (input.website) throw new HallError(400, 'Please submit the resident form directly.');
        if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(input.requestId)) throw new HallError(400, 'Please reload the form and try again.');
        const profile = validateSubmission(input.profile);
        const existing = db.query('SELECT id,data FROM cg_profiles WHERE request_id=?').get(input.requestId) as any;
        if (existing) {
          if (existing.data !== JSON.stringify(profile)) throw new HallError(409, 'This submission was already received. Start a new form to send a different profile.');
          return response({ id: existing.id, status: 'pending', alreadyReceived: true });
        }
        limited('submissions', 120, 60 * 60 * 1000);
        const id = randomUUID(); const now = new Date().toISOString();
        db.transaction(() => {
          db.query('INSERT INTO cg_profiles(id,request_id,data,created_at,updated_at) VALUES(?,?,?,?,?)').run(id, input.requestId, JSON.stringify(profile), now, now);
          audit(id, 'submitted');
        })();
        return response({ id, status: 'pending' }, 201);
      }
      requireAdmin(input.sessionToken);
      if (action === 'logout') { db.query('DELETE FROM cg_sessions WHERE token_hash=?').run(digest(input.sessionToken)); return response({ ok: true }); }
      if (action === 'admin-list') {
        const rows = db.query('SELECT * FROM cg_profiles ORDER BY created_at DESC, id ASC').all();
        return response({ profiles: rows.map(rowData) });
      }
      if (!['update', 'publish', 'archive', 'restore', 'delete'].includes(action)) throw new HallError(400, 'Unknown admin action.');
      const result = db.transaction(() => {
        const row = db.query('SELECT * FROM cg_profiles WHERE id=?').get(String(input.id || '')) as any;
        if (!row) throw new HallError(404, 'This profile no longer exists.');
        if (input.version !== row.version) throw new HallError(409, 'This profile changed in another session. Reload the queue and try again.');
        if (action === 'delete') {
          if (input.confirmation !== 'DELETE') throw new HallError(400, 'Type DELETE to confirm permanent removal.');
          db.query('DELETE FROM cg_profiles WHERE id=?').run(row.id); audit(row.id, 'deleted'); return { ok: true };
        }
        let data = row.data; let status = row.status; let featured = row.featured;
        if (action === 'update') { data = JSON.stringify(validateSubmission(input.profile)); featured = input.featured === true ? 1 : 0; }
        if (action === 'publish') status = 'published';
        if (action === 'archive') status = 'archived';
        if (action === 'restore') status = 'pending';
        db.query('UPDATE cg_profiles SET data=?,status=?,featured=?,version=version+1,updated_at=? WHERE id=?').run(data, status, featured, new Date().toISOString(), row.id);
        audit(row.id, action);
        return { profile: rowData(db.query('SELECT * FROM cg_profiles WHERE id=?').get(row.id)) };
      })();
      return response(result);
    } catch (error: any) {
      const status = error instanceof HallError ? error.status : error.name === 'ProfileValidationError' ? 400 : 500;
      if (status === 500) console.error('[hall] Request failed:', error.name);
      return response({ error: status === 500 ? 'We couldn’t save that change. Please try again.' : error.message }, status);
    }
  }
  return { handle, close: () => db.close() };
}
