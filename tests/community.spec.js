import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { scryptSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sampleProfiles } from '../data.js';
import { defaultAvatar } from '../avatar-schema.js';
const backendURL = 'http://127.0.0.1:4175';
test.describe.configure({ mode: 'serial' });
const password = 'browser-test-password';
let server, folder;
test.beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), 'hall-browser-'));
  server = spawn('bun', ['scripts/serve-backend.ts'], { env: { ...process.env, PORT: '4175', HALL_DB_PATH: join(folder, 'test.db'), HALL_ADMIN_PASSWORD_HASH: `scrypt:test-salt:${scryptSync(password, 'test-salt', 64).toString('hex')}`, HALL_ALLOWED_ORIGINS: 'http://127.0.0.1:4173' }, stdio: 'ignore' });
  await expect.poll(async () => { try { return (await fetch(`${backendURL}/api/hall?view=health`)).status; } catch { return 0; } }).toBe(200);
});
test.afterAll(async () => { if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); } if (folder) rmSync(folder, { recursive: true, force: true }); });
async function call(action, values = {}) { const r = await fetch(`${backendURL}/api/hall`, { method: 'POST', body: JSON.stringify({ action, ...values }) }); return await r.json(); }
// Drive the repeating platform+account editor: one row per entry, adding rows as needed.
async function setSocials(page, scope, entries) {
  const rows = page.locator(`${scope} .social-row`);
  for (const [index, [platform, value]] of entries.entries()) {
    if (await rows.count() <= index) await page.locator(`${scope} .social-add`).click();
    await rows.nth(index).locator('.social-platform').selectOption(platform);
    await rows.nth(index).locator('.social-value').fill(value);
  }
}

test('Avatartion studio lets residents customize, download and use an avatar', async ({ page }) => {
  await page.goto('/');
  await page.locator('#avatar-studio-button').evaluate(button => button.click());
  const before = await page.locator('#studio-preview').getAttribute('src');
  await page.getByRole('button', { name: 'Hair 5', exact: true }).click();
  expect(await page.locator('#studio-preview').getAttribute('src')).not.toBe(before);
  await page.getByRole('button', { name: 'Outfit', exact: true }).click();
  await page.getByRole('button', { name: 'Outfit 9', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save SVG' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('my-hall-avatar.svg');
  expect(await page.locator('#avatar-editor img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: 'evidence/avatar-studio.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#avatar-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/avatar-studio-mobile.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Use this avatar' }).click();
  await expect(page.locator('#join-dialog')).toBeVisible();
  await expect(page.locator('#join-socials .social-row')).toHaveCount(1);
  await expect(page.locator('#join-socials .social-platform')).toHaveValue('instagram');
  await expect(page.locator('#join-socials .social-add')).toBeVisible();
});

test('real database flow: submit, admin edit/publish, refresh, social links and archive', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const sessionToken = (await call('login', { password })).token;
  for (const [index, sample] of sampleProfiles.slice(0, 6).entries()) {
    const profile = { ...sample, consent: true, avatarConfig: { ...defaultAvatar, hair: index + 1, outfit: index + 3 } };
    const result = await call('submit', { requestId: crypto.randomUUID(), profile });
    if (index < 2) await call('publish', { id: result.id, version: 1, sessionToken });
    if (index === 5) await call('archive', { id: result.id, version: 1, sessionToken });
  }
  await page.addInitScript(url => localStorage.setItem('common-ground:settings', JSON.stringify({ hallName: 'Common Ground', backendUrl: url, feedUrl: '', formUrl: '' })), backendURL);
  await page.goto('/');
  await expect(page.locator('#profile-grid .profile-card')).toHaveCount(0);
  // The join entry point is parked in the public UI; exercise its retained component.
  await page.locator('[data-join]').first().evaluate(button => button.click());
  for (const [name, value] of Object.entries({ name: 'Taylor Park', curriculum: 'Psychology', intro: 'A movie fan who loves hiking.', help: 'Research and essay feedback', meet: 'Film-night friends' })) await page.locator(`#join-form [name=${name}]`).fill(value);
  // Three different platforms, entered through the generic social editor.
  await setSocials(page, '#join-socials', [['instagram', '@taylorpark'], ['xhs', 'https://www.xiaohongshu.com/user/profile/abc123'], ['linkedin', 'https://www.linkedin.com/in/taylor-park']]);
  await page.locator('#join-form [name=consent]').check();
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page.locator('#toast')).toContainText('Introduction received');
  await page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click();
  await expect(page.locator('#profile-grid .profile-card')).toHaveCount(2);
  await expect(page.locator('#profile-grid')).not.toContainText('Taylor Park');
  await page.getByRole('button', { name: 'Admin board' }).click();
  await page.locator('#admin-login-form [name=password]').fill(password);
  await page.getByRole('button', { name: 'Sign in to your hall' }).click();
  await expect(page.locator('#admin-workspace')).toBeVisible();
  // Wall setup — including the Google Form and Apps Script feed links — opens from the dashboard.
  await page.locator('#admin-settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await expect(page.locator('#settings-form [name=formUrl]')).toBeVisible();
  await expect(page.locator('#settings-form [name=feedUrl]')).toBeVisible();
  await expect(page.locator('#settings-form [name=backendUrl]')).toHaveValue(backendURL);
  await page.locator('#settings-dialog [data-close]').click();
  await expect(page.locator('#settings-dialog')).toBeHidden();
  await expect(page.locator('#admin-workspace')).toBeVisible();
  await expect(page.locator('#pending-total')).toHaveText('4');
  await page.locator('#toast').evaluate(el => el.hidden = true);
  await page.screenshot({ path: 'evidence/admin-board.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/admin-board-mobile.png', animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.admin-row').filter({ hasText: 'Taylor Park' }).getByRole('button', { name: 'Review' }).click();
  await page.locator('#admin-edit-form [name=intro]').fill('A movie fan, hiker and matcha enthusiast.');
  // The resident's three accounts round-trip into the admin editor, and a fourth can be added.
  await expect(page.locator('#admin-socials .social-row')).toHaveCount(3);
  await setSocials(page, '#admin-socials', [['instagram', 'taylorpark'], ['xhs', 'https://www.xiaohongshu.com/user/profile/abc123'], ['linkedin', 'https://www.linkedin.com/in/taylor-park'], ['tiktok', 'taylor.park']]);
  await page.locator('#admin-edit-form [name=featured]').check();
  await page.getByRole('button', { name: 'Save profile changes' }).click();
  await expect(page.locator('#toast')).toContainText('Profile changes saved');
  await page.locator('#toast').evaluate(el => el.hidden = true);
  await page.screenshot({ path: 'evidence/admin-review.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Approve & publish' }).click();
  await expect(page.locator('#published-total')).toHaveText('3');
  await page.getByRole('button', { name: 'Back to wall' }).click();
  await expect(page.locator('#profile-grid .profile-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click();
  await expect(page.locator('#profile-grid .profile-card')).toHaveCount(3);
  const card = page.locator('#profile-grid .profile-card').first();
  await expect(card).toContainText('Taylor Park');
  await expect(card).toContainText('matcha enthusiast');
  await expect(card.getByRole('link', { name: 'Find Taylor Park on Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/taylorpark/');
  await expect(card.getByRole('link', { name: 'Find Taylor Park on XHS / 小红书' })).toHaveAttribute('href', 'https://www.xiaohongshu.com/user/profile/abc123');
  await expect(card.getByRole('link', { name: 'Find Taylor Park on LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/in/taylor-park');
  await expect(card.getByRole('link', { name: 'Find Taylor Park on TikTok' })).toHaveAttribute('href', 'https://www.tiktok.com/@taylor.park');
  await page.getByRole('button', { name: 'Admin board' }).click();
  await expect(page.locator('#admin-workspace')).toBeVisible();
  await page.locator('[data-admin-status=published]').click();
  await page.locator('.admin-row').filter({ hasText: 'Taylor Park' }).getByRole('button', { name: 'Manage' }).click();
  await page.getByRole('button', { name: 'Archive profile', exact: true }).click();
  await expect(page.locator('#archived-total')).toHaveText('2');
  await page.getByRole('button', { name: 'Back to wall' }).click();
  await expect(page.locator('#profile-grid .profile-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click();
  await expect(page.locator('#profile-grid .profile-card')).toHaveCount(2);
  expect(errors).toEqual([]);
});
