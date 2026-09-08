import { test, expect } from '@playwright/test';

const feedUrl = 'https://script.google.com/macros/s/test-wall/exec';
const profile = { id: 'test-1', name: 'New Neighbor', curriculum: 'Chemistry', category: 'Science', year: 'Year 2', intro: 'I like coffee', help: 'Chemistry', meet: 'Study buddies', handle: 'neighbor', avatar: 1 };
async function configure(page, formUrl = '') {
  await page.getByRole('button', { name: 'Wall setup' }).click();
  await page.locator('[name=hallName]').fill('Maple Hall');
  await page.locator('[name=feedUrl]').fill(feedUrl);
  await page.locator('[name=formUrl]').fill(formUrl);
  await page.getByRole('button', { name: 'Save settings' }).click();
}

test('filters, search, complete profile and keyboard dismissal', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.profile-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Engineering', exact: true }).click();
  await expect(page.locator('.profile-card')).toHaveCount(3);
  await page.getByRole('searchbox').fill('laptop');
  await expect(page.locator('.profile-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Meet Marcus Lee', exact: true }).click();
  await expect(page.locator('#profile-dialog')).toBeVisible();
  await expect(page.locator('#profile-dialog')).toContainText('Hackathon teammates');
  await page.keyboard.press('Escape');
  await expect(page.locator('#profile-dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Meet Marcus Lee', exact: true })).toBeFocused();
  await page.getByRole('searchbox').fill('no-one-at-all');
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.getByRole('button', { name: 'Show everyone' }).click();
  await expect(page.locator('.profile-card')).toHaveCount(12);
  expect(errors).toEqual([]);
});

test('sample form requires consent, displays safely, and persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join the wall', exact: true }).click();
  await page.locator('[name=name]').fill('Taylor <b>Hall</b>');
  await page.locator('[name=curriculum]').fill('History');
  await page.locator('[name=intro]').fill('A friendly neighbor');
  await page.locator('[name=help]').fill('Essay feedback');
  await page.locator('[name=meet]').fill('Hiking buddies');
  await page.getByRole('button', { name: 'Try another avatar' }).click();
  await page.getByRole('button', { name: 'Add my sample profile' }).click();
  await expect(page.locator('#join-dialog')).toBeVisible();
  await page.locator('[name=consent]').check();
  await page.getByRole('button', { name: 'Add my sample profile' }).click();
  await expect(page.locator('.profile-card')).toHaveCount(13);
  await expect(page.locator('.profile-card').first()).toContainText('Taylor <b>Hall</b>');
  await expect(page.locator('.profile-card b')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.profile-card')).toHaveCount(13);
});

test('feed is requested only by refresh; changes replace data and errors retain it', async ({ page }) => {
  let requests = 0;
  let payload = { profiles: [profile] };
  let failure = false;
  await page.route('https://script.google.com/**', route => {
    requests++;
    return route.fulfill({ status: failure ? 503 : 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.clock.install();
  await page.goto('/');
  await configure(page);
  await expect(page.locator('.profile-card')).toHaveCount(0);
  await page.clock.fastForward(120000);
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click();
  await expect(page.locator('.profile-card')).toHaveCount(1);
  expect(requests).toBe(1);
  await page.clock.fastForward(120000);
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click();
  await expect(page.locator('#toast')).toContainText('All caught up');
  await expect(page.locator('.profile-card')).toHaveCount(1);
  payload = { profiles: [{ ...profile, intro: 'Updated intro' }, { ...profile, id: 'test-2', name: 'Another Resident' }] };
  await page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click();
  await expect(page.locator('.profile-card')).toHaveCount(2);
  await expect(page.locator('.profile-card').first()).toContainText('Updated intro');
  failure = true;
  await page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click();
  await expect(page.locator('#feed-status')).toContainText('Current wall kept');
  await expect(page.locator('.profile-card')).toHaveCount(2);
  failure = false; payload = { profiles: [] };
  await page.getByRole('button', { name: 'Refresh wall', exact: true }).first().click();
  await expect(page.locator('.profile-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('2 removed');
  const before = requests;
  await page.reload(); await page.clock.fastForward(120000);
  expect(requests).toBe(before);
});

test('display mode rotates current profiles and pauses without feed calls', async ({ page }) => {
  const requests = [];
  page.on('request', r => { if (r.url().includes('script.google.com')) requests.push(r.url()); });
  await page.clock.install();
  await page.goto('/');
  // Headless fullscreen is platform-dependent; exercise the same CSS fallback used by iframe previews.
  await page.evaluate(() => { document.documentElement.requestFullscreen = () => Promise.reject(new Error('Not available')); });
  await page.getByRole('button', { name: 'Display mode' }).click();
  await expect(page.locator('.profile-card')).toHaveCount(4);
  await expect(page.locator('#display-page')).toHaveText('1 / 3');
  await page.clock.fastForward(12000);
  await expect(page.locator('#display-page')).toHaveText('2 / 3');
  await page.getByRole('button', { name: 'Pause rotation' }).click();
  await page.clock.fastForward(36000);
  await expect(page.locator('#display-page')).toHaveText('2 / 3');
  await page.getByRole('button', { name: 'Exit display' }).click();
  await expect(page.locator('.profile-card')).toHaveCount(12);
  expect(requests).toHaveLength(0);
});

test('configured Google Form gets an actual QR code and join target', async ({ page }) => {
  await page.goto('/');
  await configure(page, 'https://forms.gle/hall-example');
  await expect(page.locator('#join-qr svg')).toHaveCount(1);
  const popupPromise = page.waitForEvent('popup');
  await page.route('https://forms.gle/**', r => r.fulfill({ body: 'Google Form placeholder for test' }));
  await page.getByRole('button', { name: 'Join the wall', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL('https://forms.gle/hall-example');
});

test('desktop and mobile layout render without overflow or missing avatars', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.profile-card')).toHaveCount(12);
  const loaded = await page.locator('img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0));
  expect(loaded).toBe(true);
  await page.screenshot({ path: 'evidence/desktop.png', fullPage: true, animations: 'disabled' });
  await page.screenshot({ path: 'evidence/desktop-first-screen.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/mobile.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => { document.documentElement.requestFullscreen = () => Promise.reject(new Error('Not available')); });
  await page.getByRole('button', { name: 'Display mode' }).click();
  await expect(page.locator('.profile-card')).toHaveCount(4);
  await page.screenshot({ path: 'evidence/display.png', animations: 'disabled' });
});
