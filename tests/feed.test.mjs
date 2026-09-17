import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { normalizeProfiles, validateSettings } from '../data.js';
import { validateSubmission } from '../profile-schema.js';
import { socialHref } from '../social-schema.js';
import { defaultAvatar } from '../avatar-schema.js';

const headers = ['Timestamp', 'Your name', 'Your course', 'Curriculum group', 'Year of study', 'I am', 'I can help with', 'I want to meet', 'Find me at', 'Avatar', 'Consent', 'Approved', 'Email Address'];
const row = (name, approved, consent = 'I agree') => ['2026-09-08T00:00:00Z', name, 'Physics', 'Science', 'Year 2', 'Hello', 'Maths', 'Runners', '@hello', '2', consent, approved, 'private@example.com'];
function runFeed(rows) {
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => rows.map(r => [...r]) }) }) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (algorithm, value) => createHash(algorithm).update(value).digest(), base64EncodeWebSafe: value => value.toString('base64url') }
  });
  vm.runInContext(readFileSync(new URL('../google-apps-script.gs', import.meta.url), 'utf8'), context);
  return context.doGet();
}
test('Sheet feed shares only approved, consented profile fields', () => {
  const result = runFeed([headers, row('Approved', true), row('Pending', false), row('No consent', true, ''), row('Rejected', 'no')]);
  assert.equal(result.profiles.length, 1);
  assert.equal(result.profiles[0].name, 'Approved');
  assert.equal(result.profiles[0].avatar, 1);
  assert.ok(!JSON.stringify(result).includes('private@example.com'));
  assert.ok(!JSON.stringify(result).includes('Timestamp'));
});
test('Sheet feed rejects missing moderation columns instead of publishing everything', () => {
  assert.match(runFeed([headers.filter(h => h !== 'Approved')]).error, /Missing required column/);
});
test('IDs stay stable across reorder and content edits', () => {
  const a = row('Alex', true); const b = row('Jamie', true);
  const before = runFeed([headers, a, b]); a[5] = 'Updated introduction';
  const after = runFeed([headers, b, a]);
  assert.equal(before.profiles[0].id, after.profiles[1].id);
});
test('Malformed feeds and duplicate IDs are rejected, and unsafe handles are removed', () => {
  assert.throws(() => normalizeProfiles({ error: 'No sheet', profiles: [] }));
  assert.throws(() => normalizeProfiles({ profiles: [{ id: '1', name: 'A' }, { id: '1', name: 'B' }] }));
  const [p] = normalizeProfiles({ profiles: [{ name: '<script>hello</script>', handle: 'https://evil.test', category: '<img>', avatar: -1 }] });
  assert.equal(p.handle, ''); assert.equal(p.category, 'Other'); assert.equal(p.avatar, 0);
});
test('Settings accept Google endpoints and reject arbitrary or unsafe schemes', () => {
  assert.ok(validateSettings({ feedUrl: 'https://script.google.com/macros/s/example/exec' }).feedUrl);
  assert.throws(() => validateSettings({ feedUrl: 'https://evil.test/exec' }));
  assert.throws(() => validateSettings({ formUrl: 'javascript:alert(1)' }));
  assert.throws(() => validateSettings({ feedUrl: 'https://user:pass@script.google.com/macros/s/example/exec' }));
});

// --- Generic social accounts -------------------------------------------------
const base = { name: 'Sam Reed', curriculum: 'History', category: 'Other', year: 'Year 2', intro: 'Hello', help: 'Notes', meet: 'Friends', consent: true, avatarConfig: defaultAvatar };

test('Several different social platforms are accepted and mirrored to legacy fields', () => {
  const p = validateSubmission({ ...base, socials: [
    { platform: 'instagram', value: '@sam.reed' },
    { platform: 'tiktok', value: 'sam.reed' },
    { platform: 'linkedin', value: 'https://www.linkedin.com/in/sam-reed' },
    { platform: 'discord', value: 'sam.reed' }
  ] });
  assert.deepEqual(p.socials.map(s => s.platform), ['instagram', 'tiktok', 'linkedin', 'discord']);
  assert.equal(p.socials[0].value, 'sam.reed');                       // leading @ stripped
  assert.equal(p.handle, 'sam.reed');                                 // legacy mirror
  assert.equal(p.linkedin, 'https://www.linkedin.com/in/sam-reed');
  assert.equal(p.xhs, '');
  assert.equal(socialHref(p.socials[1]), 'https://www.tiktok.com/@sam.reed');
  assert.equal(socialHref(p.socials[3]), '');                         // discord has no public link
});

test('Legacy handle/xhs/linkedin profiles migrate into the socials list', () => {
  const p = validateSubmission({ ...base, handle: 'old.handle', linkedin: 'https://www.linkedin.com/in/old-user' });
  assert.deepEqual(p.socials, [
    { platform: 'instagram', value: 'old.handle' },
    { platform: 'linkedin', value: 'https://www.linkedin.com/in/old-user' }
  ]);
});

test('An explicit socials list wins over legacy fields, so removals stick', () => {
  // The admin editor drops the mirrors, but even if one leaks through, an
  // explicitly-set platform must not be overwritten by the stale legacy value.
  const p = validateSubmission({ ...base, handle: 'stale.handle', socials: [{ platform: 'instagram', value: 'fresh.handle' }] });
  assert.deepEqual(p.socials, [{ platform: 'instagram', value: 'fresh.handle' }]);
  assert.equal(p.handle, 'fresh.handle');
});

test('Duplicate platforms, over-long lists and unknown platforms are rejected', () => {
  const socials = [{ platform: 'instagram', value: 'a.one' }, { platform: 'instagram', value: 'a.two' }];
  assert.throws(() => validateSubmission({ ...base, socials }), /already added an? Instagram/i);
  const many = ['instagram', 'tiktok', 'x', 'threads', 'snapchat', 'telegram'].map(platform => ({ platform, value: 'validname' }));
  assert.throws(() => validateSubmission({ ...base, socials: many }), /at most 5/);
  assert.throws(() => validateSubmission({ ...base, socials: [{ platform: 'myspace', value: 'x' }] }), /Choose a social platform/);
});

test('Unsafe or wrong-domain social values are rejected on submit', () => {
  for (const entry of [
    { platform: 'linkedin', value: 'javascript:alert(1)' },
    { platform: 'linkedin', value: 'https://linkedin.com.evil.test/in/x' },
    { platform: 'xhs', value: 'https://xiaohongshu.com.evil.test/user/profile/x' },
    { platform: 'website', value: 'http://insecure.example.com' },
    { platform: 'instagram', value: 'not a handle!' },
    { platform: 'x', value: 'waaaaaaaaaaytoolongforx' }
  ]) assert.throws(() => validateSubmission({ ...base, socials: [entry] }), /./, `expected rejection for ${entry.platform}:${entry.value}`);
});

test('Untrusted feed rows drop bad accounts instead of failing the whole wall', () => {
  const [p] = normalizeProfiles({ profiles: [{ name: 'Feed User', socials: [
    { platform: 'instagram', value: 'good.handle' },
    { platform: 'linkedin', value: 'javascript:alert(1)' },
    { platform: 'nope', value: 'x' }
  ] }] });
  assert.deepEqual(p.socials, [{ platform: 'instagram', value: 'good.handle' }]);
  assert.equal(p.linkedin, '');
});
