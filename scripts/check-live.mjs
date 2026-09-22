// SITE_URL is the published origin. Optional SITE_BYPASS_TOKEN is used only for
// that origin; it is never saved, printed, or sent to third-party sites.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const profiles = JSON.parse(await readFile(new URL('../assets/resident-profiles.json', import.meta.url)));
const photos = JSON.parse(await readFile(new URL('../assets/resident-photos.json', import.meta.url)));

const url = new URL(process.env.SITE_URL);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  if (process.env.SITE_BYPASS_TOKEN) {
    await page.route(`${url.origin}/**`, route => route.continue({
      headers: { ...route.request().headers(), 'OAI-Sites-Authorization': `Bearer ${process.env.SITE_BYPASS_TOKEN}` }
    }));
  }
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(url.href, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.equal(await page.title(), 'Social Wall · Simon K. Y. Lee Hall, HKU');
  assert.equal(await page.locator('.profile-card').count(), profiles.length);
  for (const selector of ['#create-avatar-button', '#display-button', '#avatar-studio-button', '[data-join]']) {
    assert.equal(await page.locator(selector).evaluateAll(elements => elements.every(el => !el.getClientRects().length)), true);
  }
  assert.equal(await page.locator('#profile-grid .resident-photo').count(), Object.keys(photos).length);
  assert.equal(await page.locator('#profile-grid .resident-initials').count(), profiles.length - Object.keys(photos).length);
  for (const profile of profiles) {
    await page.getByRole('button', { name: `Contact ${profile.name}`, exact: true }).click();
    const detail = page.locator('#profile-detail');
    assert.equal(await detail.locator('h3').textContent(), profile.name);
    assert.deepEqual(await detail.locator('.profile-field p').allTextContents(), [profile.intro, profile.help, profile.meet, profile.contact]);
    if (photos[profile.id]) assert.equal(await detail.locator('.resident-photo').getAttribute('src'), photos[profile.id]);
    else assert.equal(await detail.locator('.resident-initials').count(), 1);
    await page.keyboard.press('Escape');
  }
  assert.equal(await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true);
  await page.getByRole('searchbox').fill('old music');
  assert.equal(await page.locator('.profile-card').count(), 1);
  await page.getByRole('button', { name: 'Meet Anh Minh', exact: true }).click();
  assert.equal(await page.locator('#profile-dialog').isVisible(), true);
  await page.keyboard.press('Escape');
  await page.getByRole('searchbox').fill('');
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click()]);
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.profile-card').count(), profiles.length);
  for (const category of ['Medic', 'Law']) {
    await page.getByRole('button', { name: category, exact: true }).click();
    assert.equal(await page.locator('.profile-card').count(), profiles.filter(profile => profile.category === category).length);
  }
  await page.getByRole('button', { name: 'Everyone', exact: true }).click();
  assert.equal(await page.locator('.profile-card').count(), profiles.length);
  // Keep the deployment evidence free of transient notices.
  await page.locator('#toast').evaluate(el => el.hidden = true);
  await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: new URL('../evidence/hosted-desktop.png', import.meta.url).pathname, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: new URL('../evidence/hosted-mobile.png', import.meta.url).pathname, animations: 'disabled' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ url: url.href, httpStatus: 200, profiles: profiles.length, photos: Object.keys(photos).length, initials: 4, hiddenCommunityTools: 'passed', hallBranding: 'passed', separateMedicAndLawFilters: 'passed', search: 'passed', allProfileFieldsAndPhotoMappings: 'passed', refresh: 'passed', avatars: 'loaded', mobileOverflow: false, browserErrors: errors }));
} finally {
  await browser.close();
}
