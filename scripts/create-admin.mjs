import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { randomBytes, scryptSync } from 'node:crypto';
const root = new URL('../', import.meta.url);
const env = new URL('.env.local', root);
try { await access(env); throw new Error('.env.local already exists. Refusing to replace admin access.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16).toString('hex');
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const config = JSON.parse(await readFile(new URL('config.json', root), 'utf8'));
const origins = ['https://thisisan.github.io', config.backendUrl].filter(Boolean).join(',');
await mkdir(new URL('.omg/', root), { recursive: true, mode: 0o700 });
await writeFile(env, `HALL_ADMIN_PASSWORD_HASH=${hash}\nHALL_ALLOWED_ORIGINS=${origins}\n`, { mode: 0o600, flag: 'wx' });
await writeFile(new URL('.omg/admin-access.txt', root), `SKY Lee Social Wall staff access\n\nPassword: ${password}\n\nOpen the hall website with ?admin=1 at the end of its URL. This password belongs only to the hall admin board, not your omg.dev account. Store it in your password manager.\n`, { mode: 0o600, flag: 'wx' });
console.log('Created .env.local (server hash) and .omg/admin-access.txt (private admin password). Neither is included in Git or website builds.');
