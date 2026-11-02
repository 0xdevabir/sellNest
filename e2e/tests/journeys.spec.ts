import { expect, test, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, apiCall, createVerifiedUser, photo, signIn, unique } from './helpers';

// One story, in order: each step relies on the state the previous one left behind.
test.describe.configure({ mode: 'serial' });

const title = `E2E desk lamp ${unique()}`;
let seller: Page;
let buyer: Page;
let admin: Page;
let listingUrl: string;

async function publishListing(page: Page, name: string) {
  await page.goto('/sell');
  await page.getByRole('button', { name: 'Start a new listing' }).click();
  await page.waitForURL(/\/sell\/[0-9a-f-]{36}/);

  await page.getByLabel('Choose photos').setInputFiles(await photo(page));
  await expect(page.getByLabel('Remove photo 1')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Title').fill(name);
  await page.getByLabel('Category').selectOption({ index: 1 });
  await page.getByLabel('Condition').selectOption({ index: 1 });
  await page.getByLabel('Description').fill('A working lamp used on one study desk for a year. No faults. The cable is original.');
  await page.getByLabel('Price (৳)', { exact: true }).fill('1500');
  await page.getByLabel('Open to offers').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Area').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
}

test('1-2. Seller and buyer sign up, verify email and complete their profiles', async ({ browser }) => {
  seller = (await createVerifiedUser(browser, 'Seller')).page;
  buyer = (await createVerifiedUser(browser, 'Buyer')).page;
  const adminContext = await browser.newContext();
  admin = await adminContext.newPage();
  await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
});

test('3. Seller publishes a listing with a photo; a new account waits for review', async () => {
  await publishListing(seller, title);
  await seller.waitForURL(/\/account$/);
  await expect(seller.getByText(title)).toBeVisible();
  await expect(seller.getByRole('listitem').filter({ hasText: title }).getByText('In review')).toBeVisible();
});

test('4. Moderator approves the listing from the queue', async () => {
  await admin.goto('/admin/moderation');
  const row = admin.getByRole('listitem').filter({ hasText: title });
  await row.getByRole('button', { name: 'Approve' }).click();
  await admin.getByRole('alertdialog').or(admin.getByRole('dialog')).getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByRole('listitem').filter({ hasText: title })).toHaveCount(0);
});

test('5. Buyer searches near DIU, tolerating a typo, and sees the listing', async () => {
  // 'lamp' misspelled as 'lanp': the fuzzy search must still find it.
  await buyer.goto(`/explore?q=${encodeURIComponent(title.replace('lamp', 'lanp'))}`);
  await expect(buyer.getByRole('link', { name: new RegExp(title) }).first()).toBeVisible();
  await buyer.getByRole('link', { name: new RegExp(title) }).first().click();
  await buyer.waitForURL(/\/listings\//);
  listingUrl = buyer.url();
  await expect(buyer.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(buyer.getByText(/no payment|does not handle payment|pay/i).first()).toBeVisible();
});

test('6. Buyer saves the listing', async () => {
  await buyer.getByRole('button', { name: /^Save/ }).first().click();
  await buyer.goto('/account/favorites');
  await expect(buyer.getByRole('link', { name: new RegExp(title) }).first()).toBeVisible();
});

test('7. Buyer messages the seller and the seller gets it in the inbox', async () => {
  await buyer.goto(listingUrl);
  await buyer.getByRole('button', { name: 'Message seller' }).click();
  await buyer.waitForURL(/\/inbox\/[0-9a-f-]{36}/);
  await buyer.getByLabel('Write a message').fill('Is the lamp still available?');
  await buyer.getByRole('button', { name: 'Send' }).click();
  await expect(buyer.getByRole('log').getByText('Is the lamp still available?')).toBeVisible();

  await seller.goto('/inbox');
  await seller.getByRole('link', { name: /Buyer Tester/ }).first().click();
  await expect(seller.getByRole('log').getByText('Is the lamp still available?')).toBeVisible();
  await seller.getByLabel('Write a message').fill('Yes, it is.');
  await seller.getByRole('button', { name: 'Send' }).click();
  await expect(buyer.getByRole('log').getByText('Yes, it is.')).toBeVisible();
});

test('8. Offer, counter and accept; accepting does not mark the item sold', async () => {
  await buyer.goto(listingUrl);
  await buyer.getByRole('button', { name: 'Make an offer' }).click();
  await buyer.getByLabel('Your offer (৳)').fill('1200');
  await buyer.getByRole('button', { name: 'Send offer' }).click();
  await expect(buyer.getByRole('link', { name: /Your offer/ })).toBeVisible();

  await seller.goto('/account/offers');
  const received = seller.getByRole('listitem').filter({ hasText: title });
  await received.getByRole('button', { name: 'Counter' }).click();
  await seller.getByLabel('Your price (৳)').fill('1350');
  await seller.getByRole('button', { name: 'Send counter offer' }).click();
  await expect(seller.getByRole('listitem').filter({ hasText: title }).getByText('Waiting for buyer')).toBeVisible();

  await buyer.goto('/account/offers');
  await buyer.getByRole('button', { name: 'Offers you made' }).click();
  const made = buyer.getByRole('listitem').filter({ hasText: title });
  await made.getByRole('button', { name: 'Accept' }).click();
  await expect(buyer.getByText(/Agreed, but not sold yet/)).toBeVisible();

  await buyer.goto(listingUrl);
  await expect(buyer.getByRole('button', { name: 'Message seller' }).or(buyer.getByRole('link', { name: /message/i })).first()).toBeVisible();
  await seller.goto('/account');
  await expect(seller.getByRole('listitem').filter({ hasText: title }).getByText('Active', { exact: true })).toBeVisible();
});

test('9. Pausing and marking sold at once settles on one coherent status', async () => {
  const id = listingUrl.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0];
  test.skip(!id, 'Listing URL has no id to race on');
  await seller.goto('/account');
  const results = await Promise.all([apiCall(seller, `/listings/${id}/status`, { action: 'pause' }), apiCall(seller, `/listings/${id}/mark-sold`, {})]);
  const ok = results.filter((r) => r.ok()).length;
  expect(ok).toBeGreaterThanOrEqual(1);
  const rejected = results.filter((r) => !r.ok());
  for (const r of rejected) expect(r.status()).toBe(409);
  // Both orders are legal (pause then sell), but the server must settle on one coherent state.
  if (ok === 1 && results[0].ok()) await apiCall(seller, `/listings/${id}/mark-sold`, {});
  await seller.goto('/account');
  await expect(seller.getByRole('listitem').filter({ hasText: title }).getByText('Sold', { exact: true })).toBeVisible();
});

test('9b. Accepting and rejecting the same offer at once: exactly one wins', async () => {
  const name = `E2E race shelf ${unique()}`;
  await publishListing(seller, name);
  await seller.waitForURL(/\/account$/);
  await admin.goto('/admin/moderation');
  await admin.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Approve' }).click();
  await admin.getByRole('alertdialog').or(admin.getByRole('dialog')).getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);

  await buyer.goto(`/explore?q=${encodeURIComponent(name)}`);
  await buyer.getByRole('link', { name: new RegExp(name) }).first().click();
  await buyer.waitForURL(/\/listings\//);
  await buyer.getByRole('button', { name: 'Make an offer' }).click();
  await buyer.getByLabel('Your offer (৳)').fill('1200');
  const created = buyer.waitForResponse((r) => /\/listings\/[^/]+\/offers$/.test(r.url()) && r.request().method() === 'POST');
  await buyer.getByRole('button', { name: 'Send offer' }).click();
  const offer = (await (await created).json()) as { id: string };

  const results = await Promise.all([apiCall(seller, `/offers/${offer.id}/accept`), apiCall(seller, `/offers/${offer.id}/reject`)]);
  expect(results.filter((r) => r.ok())).toHaveLength(1);
  expect(results.find((r) => !r.ok())?.status()).toBe(409);
});

test('10. A listing sold through the UI leaves search and shows as sold', async () => {
  const name = `E2E sold chair ${unique()}`;
  await publishListing(seller, name);
  await seller.waitForURL(/\/account$/);
  await admin.goto('/admin/moderation');
  await admin.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Approve' }).click();
  await admin.getByRole('alertdialog').or(admin.getByRole('dialog')).getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);

  await seller.goto('/account');
  await seller.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Mark as sold' }).click();
  await seller.getByRole('dialog').getByRole('button', { name: 'Mark as sold' }).click();
  await expect(seller.getByRole('listitem').filter({ hasText: name }).getByText('Sold', { exact: true })).toBeVisible();

  await buyer.goto(`/explore?q=${encodeURIComponent(name)}`);
  await expect(buyer.getByRole('link', { name: new RegExp(name) })).toHaveCount(0);
});

test('11. Buyer reports content and a moderator resolves the report', async () => {
  await buyer.goto(listingUrl);
  await buyer.getByRole('button', { name: 'Report' }).click();
  await buyer.getByLabel('Details (optional)').fill(`Suspicious wording ${title}`);
  await buyer.getByRole('button', { name: 'Send report' }).click();
  await expect(buyer.getByText('Report sent to the moderators')).toBeVisible();

  await admin.goto('/admin/reports');
  const row = admin.getByRole('listitem').filter({ hasText: `Suspicious wording ${title}` });
  await row.getByRole('button', { name: 'Resolve' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Resolve report' }).click();
  await expect(admin.getByText('Report resolved')).toBeVisible();
  await expect(admin.getByRole('listitem').filter({ hasText: `Suspicious wording ${title}` })).toHaveCount(0);
});

test('12. Authorisation: a regular user cannot reach admin, even through the API', async () => {
  await buyer.goto('/admin');
  await expect(buyer).not.toHaveURL(/\/admin/);
  const res = await apiCall(buyer, '/admin/categories', { name: 'Nope', slug: 'nope' });
  expect(res.status()).toBe(403);
});
