import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { normalizeProfiles, validateSettings } from '../data.js';

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
