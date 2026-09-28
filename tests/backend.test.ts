import { test, expect } from 'bun:test';
import { createHallBackend, passwordHash } from '../backend/hall';
import { defaultAvatar } from '../avatar-schema.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const password = 'test-only-password-not-for-deployment';
const hash = passwordHash(password);
const profile = { name: 'Test Resident', curriculum: 'History', category: 'Others', year: 'Year 2', intro: 'A friendly neighbor', help: 'Essay feedback', meet: 'Study buddies', handle: 'resident', xhs: 'https://www.xiaohongshu.com/user/profile/abc123', linkedin: 'https://www.linkedin.com/in/test-resident', avatarConfig: defaultAvatar, consent: true };
function setup(path = ':memory:') {
  const backend = createHallBackend({ dbPath: path, adminPasswordHash: hash, allowedOrigins: ['https://thisisan.github.io'] });
  async function call(action?: string, values = {}, origin?: string) {
    const r = await backend.handle(new Request('https://hall.omgs.app/api/hall', { method: action ? 'POST' : 'GET', headers: { ...(origin ? { Origin: origin } : {}), ...(action ? { 'Content-Type': 'text/plain' } : {}) }, ...(action ? { body: JSON.stringify({ action, ...values }) } : {}) }));
    return { status: r.status, body: await r.json() as any, headers: r.headers };
  }
  return { ...backend, call, login: async () => (await call('login', { password })).body.token };
}
test('submissions persist pending and cannot set their own approval status', async () => {
  const b = setup();
  const sessionToken = await b.login();
  expect((await b.call('submit', { requestId: crypto.randomUUID(), profile })).status).toBe(401);
  const result = await b.call('submit', { sessionToken, requestId: crypto.randomUUID(), profile: { ...profile, status: 'published', featured: true } });
  expect(result.status).toBe(201);
  expect((await b.call()).body.profiles).toHaveLength(0);
  expect((await b.call('admin-list')).status).toBe(401);
  const rows = (await b.call('admin-list', { sessionToken })).body.profiles;
  expect(rows).toHaveLength(1); expect(rows[0].status).toBe('pending'); expect(rows[0].featured).toBe(false);
  b.close();
});
test('authorized publish, edit, archive, restore and confirmed delete', async () => {
  const b = setup(); const sessionToken = await b.login();
  const submitted = await b.call('submit', { sessionToken, requestId: crypto.randomUUID(), profile });
  const id = submitted.body.id;
  expect((await b.call('publish', { id, version: 1 })).status).toBe(401);
  expect((await b.call('publish', { id, version: 1, sessionToken })).status).toBe(200);
  expect((await b.call()).body.profiles[0].linkedin).toBe(profile.linkedin);
  const updated = await b.call('update', { id, version: 2, sessionToken, profile: { ...profile, name: 'Updated Neighbor' }, featured: true });
  expect(updated.body.profile.featured).toBe(true);
  expect((await b.call('archive', { id, version: 2, sessionToken })).status).toBe(409);
  await b.call('archive', { id, version: 3, sessionToken });
  expect((await b.call()).body.profiles).toHaveLength(0);
  await b.call('restore', { id, version: 4, sessionToken });
  expect((await b.call('admin-list', { sessionToken })).body.profiles[0].status).toBe('pending');
  expect((await b.call('delete', { id, version: 5, sessionToken })).status).toBe(400);
  expect((await b.call('delete', { id, version: 5, sessionToken, confirmation: 'DELETE' })).status).toBe(200);
  expect((await b.call('admin-list', { sessionToken })).body.profiles).toHaveLength(0);
  b.close();
});
test('idempotency avoids duplicate profiles on retry and rejects changed payloads', async () => {
  const b = setup(); const sessionToken = await b.login(); const requestId = crypto.randomUUID();
  const first = await b.call('submit', { sessionToken, requestId, profile });
  const retry = await b.call('submit', { sessionToken, requestId, profile });
  expect(retry.body.id).toBe(first.body.id); expect(retry.body.alreadyReceived).toBe(true);
  expect((await b.call('submit', { sessionToken, requestId, profile: { ...profile, name: 'Different' } })).status).toBe(409);
  b.close();
});
test('consent, social domains, avatar settings and text lengths are validated', async () => {
  const b = setup(); const sessionToken = await b.login();
  for (const invalid of [{ consent: false }, { linkedin: 'javascript:alert(1)' }, { xhs: 'https://xiaohongshu.com.evil.test/user/profile/x' }, { avatarConfig: { ...defaultAvatar, hair: 999 } }, { name: 'x'.repeat(61) }]) {
    expect((await b.call('submit', { sessionToken, requestId: crypto.randomUUID(), profile: { ...profile, ...invalid } })).status).toBe(400);
  }
  b.close();
});
test('approved data survives a backend restart', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'hall-persistence-')); const path = join(folder, 'data.db');
  let b = setup(path); const sessionToken = await b.login(); const id = (await b.call('submit', { sessionToken, requestId: crypto.randomUUID(), profile })).body.id;
  await b.call('publish', { id, version: 1, sessionToken: await b.login() }); b.close();
  b = setup(path); expect((await b.call()).body.profiles[0].id).toBe(id); b.close(); rmSync(folder, { recursive: true });
});
test('logout revokes sessions, incorrect password fails, missing setup fails closed', async () => {
  const b = setup();
  expect((await b.call('login', { password: 'wrong' })).status).toBe(401);
  const sessionToken = await b.login(); await b.call('logout', { sessionToken });
  expect((await b.call('admin-list', { sessionToken })).status).toBe(401);
  b.close();
  const empty = createHallBackend({ dbPath: ':memory:', adminPasswordHash: '' });
  const r = await empty.handle(new Request('https://hall.omgs.app/api/hall', { method: 'POST', body: JSON.stringify({ action: 'login', password }) }));
  expect(r.status).toBe(503); empty.close();
});
test('CORS allows the GitHub site, refuses other origins, and limits request size', async () => {
  const b = setup();
  expect((await b.call(undefined, {}, 'https://thisisan.github.io')).headers.get('Access-Control-Allow-Origin')).toBe('https://thisisan.github.io');
  expect((await b.call('submit', { requestId: crypto.randomUUID(), profile }, 'https://evil.test')).status).toBe(403);
  const r = await b.handle(new Request('https://hall.omgs.app/api/hall', { method: 'POST', body: 'x'.repeat(760000) }));
  expect(r.status).toBe(413); b.close();
});
test('admin attempts are rate limited', async () => {
  const b = setup(); for (let i = 0; i < 20; i++) await b.call('login', { password: 'wrong' });
  expect((await b.call('login', { password })).status).toBe(429); b.close();
});

test('analytics counts sessions and interactions without profile details; reports require staff', async () => {
  const b=setup();const session=crypto.randomUUID();const origin='https://thisisan.github.io';const event={session,source:'hku',event:'page_view'};
  expect((await b.call('track',event,origin)).status).toBe(200);
  expect((await b.call('track',event,origin)).status).toBe(200);
  expect((await b.call('track',{...event,event:'profile_open'},origin)).status).toBe(200);
  expect((await b.call('track',{...event,profileName:'Private Name'},origin)).status).toBe(400);
  expect((await b.call('track',{...event,source:'https://private.example/path'},origin)).status).toBe(400);
  expect((await b.call('track',event)).status).toBe(403);
  expect((await b.call('analytics')).status).toBe(401);
  const report=(await b.call('analytics',{sessionToken:await b.login()})).body;
  expect(report.daily.find((r:any)=>r.event==='visit').count).toBe(1);
  expect(report.daily.find((r:any)=>r.event==='page_view').count).toBe(2);
  expect(report.daily.find((r:any)=>r.event==='profile_open').count).toBe(1);
  expect(report.sources).toEqual([{source:'hku',count:1}]);expect(JSON.stringify(report)).not.toContain(session);b.close();
});

test('seeded snapshots retain full contact fields and deleted profiles stay deleted after restart', async () => {
  const folder=mkdtempSync(join(tmpdir(),'hall-seed-'));const dbPath=join(folder,'data.db');
  const seed={...profile,id:'resident-seed',intro:'x'.repeat(1200),contact:'Email: public@example.com\nWeChat: public-handle',photo:'',consent:true};
  let b=createHallBackend({dbPath,adminPasswordHash:hash,seedProfiles:[seed]});
  const get=async()=>await (await b.handle(new Request('https://hall.omgs.app/api/hall'))).json() as any;
  const post=async(action:string,values:any={})=>await (await b.handle(new Request('https://hall.omgs.app/api/hall',{method:'POST',body:JSON.stringify({action,...values})}))).json() as any;
  const rows=(await get()).profiles;expect(rows).toHaveLength(1);expect(rows[0].intro).toBe(seed.intro);expect(rows[0].contact).toBe(seed.contact);
  const {token}=await post('login',{password});await post('delete',{sessionToken:token,id:seed.id,version:1,confirmation:'DELETE'});b.close();
  b=createHallBackend({dbPath,adminPasswordHash:hash,seedProfiles:[seed]});expect((await get()).profiles).toHaveLength(0);b.close();rmSync(folder,{recursive:true});
});
