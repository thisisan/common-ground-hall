// SITE_URL is the published origin. Optional SITE_BYPASS_TOKEN is used only for
// that origin; it is never saved, printed, or sent to third-party sites.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = new URL(process.env.SITE_URL);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  if (process.env.SITE_BYPASS_TOKEN) {
    await page.route(`${url.origin}/**`, route => route.continue({
      headers: { ...route.request().headers(), 'OAI-Sites-Authorization': `Bearer ${process.env.SITE_BYPASS_TOKEN}` }
    }));
  }
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(url.href, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.equal(await page.title(), 'Common Ground · Your hall, together');
  assert.equal(await page.locator('.profile-card').count(), 12);
  assert.equal(await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true);
  await page.getByRole('searchbox').fill('laptop');
  assert.equal(await page.locator('.profile-card').count(), 1);
  await page.getByRole('button', { name: 'Meet Marcus Lee', exact: true }).click();
  assert.equal(await page.locator('#profile-dialog').isVisible(), true);
  await page.keyboard.press('Escape');
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click();
  assert.equal(await page.locator('#settings-dialog').isVisible(), true);
  await page.keyboard.press('Escape');
  // Keep the deployment evidence free of transient notices.
  await page.locator('#toast').evaluate(el => el.hidden = true);
  await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
  await page.screenshot({ path: new URL('../evidence/hosted-desktop.png', import.meta.url).pathname, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ url: url.href, httpStatus: 200, profiles: 12, search: 'passed', profileDialog: 'passed', refreshSetup: 'passed', avatars: 'loaded', mobileOverflow: false, browserErrors: errors }));
} finally {
  await browser.close();
}
