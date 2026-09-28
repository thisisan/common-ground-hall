import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const profiles = JSON.parse(readFileSync(new URL('../assets/resident-profiles.json', import.meta.url)));
const photos = JSON.parse(readFileSync(new URL('../assets/resident-photos.json', import.meta.url)));

test('public wall uses the hall brand and contains no student submission or setup flow', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('common-ground:previews', JSON.stringify([{name:'Old browser preview'}])));
  await page.goto('/?join=1');
  await expect(page).toHaveTitle('SKY Lee Social Wall · Simon K. Y. Lee Hall, HKU');
  await expect(page.locator('#profile-grid .profile-card')).toHaveCount(profiles.length);
  await expect(page.locator('form, #join-dialog, #settings-button, #admin-button, #create-avatar-button, #display-button')).toHaveCount(0);
  await expect(page.getByText('Old browser preview')).toHaveCount(0);
  await expect(page.locator('.filters button')).toHaveText(['All', 'Arts & Design', 'Business', 'Engineering', 'Science', 'Medic', 'Law', 'Others']);
});

test('filters and search work together and reset the empty state', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  for (const category of ['Engineering', 'Medic', 'Law', 'Others']) {
    await page.getByRole('button', { name: category, exact: true }).click();
    await expect(page.locator('.profile-card')).toHaveCount(profiles.filter(p => p.category === category).length);
  }
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('searchbox').fill('old music');
  await expect(page.locator('.profile-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Meet Anh Minh', exact: true }).click();
  await expect(page.locator('#profile-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#profile-dialog')).toBeHidden();
  await page.getByRole('searchbox').fill('no matching resident 999');
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.getByRole('button', { name: 'Show all', exact: true }).click();
  await expect(page.locator('.profile-card')).toHaveCount(profiles.length);
  expect(errors).toEqual([]);
});

test('every imported profile keeps its full responses and correct picture, with Raven image removed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#profile-grid .resident-photo')).toHaveCount(Object.keys(photos).length);
  expect(photos['resident-2']).toBeUndefined();
  for (const p of profiles) {
    await page.getByRole('button', { name: `Contact ${p.name}`, exact: true }).click();
    await expect(page.locator('#profile-detail h3')).toHaveText(p.name);
    await expect(page.locator('#profile-detail .profile-field p')).toHaveText([p.intro,p.help,p.meet,p.contact]);
    if (photos[p.id]) await expect(page.locator('#profile-detail .resident-photo')).toHaveAttribute('src',photos[p.id]);
    else await expect(page.locator('#profile-detail .resident-initials')).toHaveCount(1);
    await page.keyboard.press('Escape');
  }
});

test('mobile keeps filters reachable and has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', {name:'Others',exact:true}).click();
  await expect(page.locator('[data-filter="Others"]')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'All',exact:true}).click();
  await page.getByRole('button',{name:'Contact Raven',exact:true}).click();
  await expect(page.locator('#profile-detail .resident-initials')).toHaveText('R');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
