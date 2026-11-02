import { expect, test } from '@playwright/test';

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
  await page.getByRole('navigation', { name: /main|primary|mobile/i }).getByRole('link', { name: /Messages/ }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Finbox/);
});
