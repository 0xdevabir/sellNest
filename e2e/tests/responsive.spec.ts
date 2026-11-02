import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, signIn } from './helpers';

for (const path of ['/', '/explore', '/login', '/register', '/safety', '/prohibited-items']) {
  test(`${path} has no horizontal scroll on a phone or console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('mobile bottom navigation reaches protected routes through sign-in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Messages|Inbox/ }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Finbox/);
});

test('signed-in phone header keeps desktop-only controls hidden', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/account');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Sell an item' })).toBeHidden();
  await expect(header.getByRole('link', { name: 'Messages' })).toBeHidden();
  await expect(header.getByRole('link', { name: 'Notifications' })).toBeVisible();
});
