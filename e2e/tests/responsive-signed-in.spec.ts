import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, signIn } from './helpers';

const PAGES = ['/', '/explore', '/sell', '/inbox', '/notifications', '/account', '/account/drafts', '/account/favorites', '/account/offers', '/account/settings', '/admin', '/admin/moderation', '/admin/listings', '/admin/reports', '/admin/users', '/admin/categories', '/admin/locations', '/admin/settings', '/admin/audit'];

test('signed-in pages have no horizontal scroll on a phone or page errors', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  const overflowing: string[] = [];
  for (const path of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) overflowing.push(`${path} (+${overflow}px)`);
    if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/${info.project.name}${path.replaceAll('/', '_')}.png` });
  }
  expect(overflowing).toEqual([]);
  expect(errors).toEqual([]);
});
