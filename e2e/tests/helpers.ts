import { expect, type Browser, type Page } from '@playwright/test';

const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:58025';
export const PASSWORD = 'e2e-only-password-1';
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@e2e.sellnest.invalid';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'e2e-only-admin-password';

export const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Polls Mailpit for the newest message to `to` and returns the first link containing `path`. */
export async function linkFromEmail(to: string, path: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const search = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()) as { messages: { ID: string }[] };
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string };
      const match = message.Text.match(new RegExp(`https?://\\S*${path}\\S*`));
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email with ${path} reached ${to}`);
}

export async function signIn(page: Page, email: string, password = PASSWORD, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Signs up through the UI, verifies by the real email link, signs in and completes the profile. */
export async function createVerifiedUser(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `${name.toLowerCase()}-${unique()}@e2e.sellnest.invalid`;
  await page.goto('/register');
  await page.getByLabel('Your name').fill(`${name} Tester`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.goto(await linkFromEmail(email, '/verify-email'));
  await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();

  await signIn(page, email);
  await page.waitForURL(/\/welcome/);
  await page.getByLabel('Your usual area').selectOption({ label: 'Daffodil Smart City (DIU)' });
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/welcome'));
  return { context, page, email };
}

/** A small generated photo, so the suite needs no binary fixtures. */
export async function photo(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 750;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#A8BCA1';
    ctx.fillRect(0, 0, 1000, 750);
    ctx.fillStyle = '#202927';
    ctx.fillRect(250, 200, 500, 350);
    return canvas.toDataURL('image/jpeg', 0.9);
  });
  return { name: 'item.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') };
}

/** Same-origin mutation using the page's session cookie, for races the UI cannot produce. */
export function apiCall(page: Page, path: string, data?: unknown) {
  const origin = new URL(page.url()).origin;
  return page.request.post(`/api/v1${path}`, { data: data ?? {}, headers: { Origin: origin } });
}
