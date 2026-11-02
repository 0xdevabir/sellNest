import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createListing, Harness, outbox, PASSWORD, prisma, resetData, seedPlaces, signedIn, startApp } from './helpers';

let h: Harness;
let places: Awaited<ReturnType<typeof seedPlaces>>;
const at = (p = places.near) => ({ categoryId: places.category.id, location: p });

beforeAll(async () => {
  h = await startApp();
});
afterAll(async () => {
  await h.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetData(h.app);
  places = await seedPlaces();
});

const tokenFrom = (text: string) => text.match(/token=([\w-]+)/)![1]!;

describe('auth', () => {
  it('registers, verifies by email and signs in without exposing secrets', async () => {
    const c = new Client(h.base);
    const email = 'new.person@test.invalid';
    expect((await c.post('/auth/register', { email, password: PASSWORD, displayName: 'New Person' })).status).toBe(201);

    const login = await c.post('/auth/login', { email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.setCookie).toMatch(/HttpOnly/i);
    expect(JSON.stringify(login.body)).not.toMatch(/passwordHash|argon2/);
    expect(login.body.emailVerified).toBe(false);

    const token = tokenFrom(outbox.find((m) => m.to === email)!.text);
    expect((await c.post('/auth/verify-email', { token })).status).toBe(200);
    expect((await c.post('/auth/verify-email', { token })).status).toBeGreaterThanOrEqual(400);
    expect((await c.get('/auth/me')).body.emailVerified).toBe(true);
  });

  it('stores only hashes of session cookies', async () => {
    const c = await signedIn(h.base, 'alice');
    const raw = decodeURIComponent(c.cookie.split('=')[1]!);
    const sessions = await prisma.session.findMany({ where: { userId: c.user!.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.tokenHash).not.toBe(raw);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const alice = await signedIn(h.base, 'alice');
    const c = new Client(h.base);
    const wrong = await c.post('/auth/login', { email: alice.user!.email, password: 'wrong-password-1' });
    const unknown = await c.post('/auth/login', { email: 'nobody@test.invalid', password: 'wrong-password-1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('does not reveal whether an email has an account on password reset', async () => {
    const alice = await signedIn(h.base, 'alice');
    const c = new Client(h.base);
    const known = await c.post('/auth/forgot-password', { email: alice.user!.email });
    const unknown = await c.post('/auth/forgot-password', { email: 'nobody@test.invalid' });
    expect(known.body).toEqual(unknown.body);
    expect(outbox).toHaveLength(1);
  });

  it('resets a password once and revokes existing sessions', async () => {
    const alice = await signedIn(h.base, 'alice');
    await new Client(h.base).post('/auth/forgot-password', { email: alice.user!.email });
    const token = tokenFrom(outbox[0]!.text);
    const anon = new Client(h.base);
    expect((await anon.post('/auth/reset-password', { token, password: 'a-new-long-password' })).status).toBe(200);
    expect((await anon.post('/auth/reset-password', { token, password: 'another-long-password' })).status).toBeGreaterThanOrEqual(400);
    expect((await alice.get('/auth/me')).status).toBe(401);
  });

  it('logs out by revoking the session on the server', async () => {
    const alice = await signedIn(h.base, 'alice');
    const cookie = alice.cookie;
    await alice.post('/auth/logout');
    const stale = new Client(h.base);
    stale.cookie = cookie;
    expect((await stale.get('/auth/me')).status).toBe(401);
  });

  it('rejects state changes from another origin', async () => {
    const alice = await signedIn(h.base, 'alice');
    const res = await alice.req('PATCH', '/me', { displayName: 'Hacked' }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });

  it('rate limits repeated logins', async () => {
    const c = new Client(h.base);
    const statuses = [];
    for (let i = 0; i < 25; i++) {
      statuses.push((await c.post('/auth/login', { email: `x${i}@test.invalid`, password: 'nope-nope-nope' })).status);
    }
    expect(statuses).toContain(429);
  });
});

describe('authorization and ownership', () => {
  it('keeps private routes behind sign in', async () => {
    const anon = new Client(h.base);
    for (const path of ['/me/listings', '/conversations', '/offers', '/notifications', '/admin/overview']) {
      expect((await anon.get(path)).status).toBe(401);
    }
  });

  it('never exposes private fields on public profiles or listings', async () => {
    const seller = await signedIn(h.base, 'seller');
    const listing = await createListing(seller.user!.id, at());
    const anon = new Client(h.base);
    const profile = await anon.get(`/users/${seller.user!.username}`);
    const detail = await anon.get(`/listings/${listing.id}`);
    for (const res of [profile, detail]) {
      expect(res.status).toBe(200);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain(seller.user!.email);
      expect(json).not.toMatch(/passwordHash|tokenHash/);
    }
  });

  it('stops users editing or deleting listings they do not own', async () => {
    const seller = await signedIn(h.base, 'seller');
    const other = await signedIn(h.base, 'other');
    const listing = await createListing(seller.user!.id, at());
    expect((await other.patch(`/listings/${listing.id}`, { title: 'Stolen title' })).status).toBe(403);
    expect((await other.req('DELETE', `/listings/${listing.id}`)).status).toBe(403);
    expect((await other.post(`/listings/${listing.id}/mark-sold`, {})).status).toBe(403);
    expect((await prisma.listing.findUnique({ where: { id: listing.id } }))!.title).toBe(listing.title);
  });

  it('hides drafts from everyone but the owner', async () => {
    const seller = await signedIn(h.base, 'seller');
    const other = await signedIn(h.base, 'other');
    const draft = await createListing(seller.user!.id, at(), { status: 'DRAFT' });
    expect((await other.get(`/listings/${draft.id}`)).status).toBe(404);
    expect((await seller.get(`/listings/${draft.id}`)).status).toBe(200);
  });

  it('ignores attempts to set a role through the profile route', async () => {
    const alice = await signedIn(h.base, 'alice');
    await alice.patch('/me', { role: 'ADMIN', displayName: 'Alice A' });
    const row = await prisma.user.findUnique({ where: { id: alice.user!.id } });
    expect(row!.role).toBe('USER');
    expect((await alice.get('/admin/overview')).status).toBe(403);
  });
});

describe('listings', () => {
  it('holds new accounts for review and publishes established ones', async () => {
    const fresh = await signedIn(h.base, 'fresh', { ageDays: 0 });
    const veteran = await signedIn(h.base, 'veteran');
    const a = await createListing(fresh.user!.id, at(), { status: 'DRAFT' });
    const b = await createListing(veteran.user!.id, at(), { status: 'DRAFT' });
    for (const l of [a, b]) {
      await prisma.listingImage.create({ data: { listingId: l.id, uploaderId: l.sellerId, keyBase: `t/${l.id}`, width: 800, height: 600 } });
    }
    expect((await fresh.post(`/listings/${a.id}/publish`)).body.status).toBe('PENDING_REVIEW');
    expect((await veteran.post(`/listings/${b.id}/publish`)).body.status).toBe('ACTIVE');
  });

  it('refuses to publish without a photo or for an unverified email', async () => {
    const seller = await signedIn(h.base, 'seller');
    const unverified = await signedIn(h.base, 'unverified', { verified: false });
    const a = await createListing(seller.user!.id, at(), { status: 'DRAFT' });
    const b = await createListing(unverified.user!.id, at(), { status: 'DRAFT' });
    expect((await seller.post(`/listings/${a.id}/publish`)).status).toBe(422);
    expect((await unverified.post(`/listings/${b.id}/publish`)).status).toBe(403);
  });

  it('marks sold, closes other offers and blocks further offers', async () => {
    const seller = await signedIn(h.base, 'seller');
    const buyer = await signedIn(h.base, 'buyer');
    const listing = await createListing(seller.user!.id, at());
    const offer = await buyer.post(`/listings/${listing.id}/offers`, { amountBdt: 25000 });
    expect((await seller.post(`/listings/${listing.id}/mark-sold`, {})).status).toBeLessThan(300);
    expect((await prisma.offer.findUnique({ where: { id: offer.body.id } }))!.status).toBe('EXPIRED');
    const late = await signedIn(h.base, 'late');
    expect((await late.post(`/listings/${listing.id}/offers`, { amountBdt: 20000 })).status).toBe(409);
  });
});

describe('search and location', () => {
  it('filters by radius and returns rounded distances without exact coordinates', async () => {
    const seller = await signedIn(h.base, 'seller');
    await createListing(seller.user!.id, at(places.near), { title: 'Campus laptop here' });
    await createListing(seller.user!.id, at(places.mid), { title: 'Uttara laptop here' });
    await createListing(seller.user!.id, at(places.far), { title: 'Sylhet laptop here' });
    const anon = new Client(h.base);

    const titles = async (qs: string) => (await anon.get(`/search?${qs}`)).body.items.map((i: { title: string }) => i.title).sort();
    expect(await titles('location=campus&radiusKm=3')).toEqual(['Campus laptop here']);
    expect(await titles('location=campus&radiusKm=10')).toEqual(['Campus laptop here', 'Uttara laptop here']);

    const res = await anon.get('/search?location=campus&radiusKm=10&sort=nearest');
    expect(res.body.items[0].title).toBe('Campus laptop here');
    expect(JSON.stringify(res.body)).not.toMatch(/latitude|longitude/);
  });

  it('finds titles by keyword and tolerates typos', async () => {
    const seller = await signedIn(h.base, 'seller');
    await createListing(seller.user!.id, at(), { title: 'Samsung Galaxy phone' });
    await createListing(seller.user!.id, at(), { title: 'Wooden study table' });
    const anon = new Client(h.base);
    expect((await anon.get('/search?q=galaxy')).body.items.map((i: any) => i.title)).toEqual(['Samsung Galaxy phone']);
    expect((await anon.get('/search?q=samsng')).body.items.map((i: any) => i.title)).toEqual(['Samsung Galaxy phone']);
  });

  it('excludes unpublished listings and filters by price', async () => {
    const seller = await signedIn(h.base, 'seller');
    await createListing(seller.user!.id, at(), { title: 'Cheap one here', priceBdt: 100 });
    await createListing(seller.user!.id, at(), { title: 'Costly one here', priceBdt: 90000 });
    await createListing(seller.user!.id, at(), { title: 'Hidden draft here', status: 'DRAFT' });
    const anon = new Client(h.base);
    const res = await anon.get('/search?maxPrice=500');
    expect(res.body.items.map((i: any) => i.title)).toEqual(['Cheap one here']);
    expect(res.body.total).toBe(1);
  });
});

describe('offers', () => {
  it('walks through counter and accept, and accepting does not mark the listing sold', async () => {
    const seller = await signedIn(h.base, 'seller');
    const buyer = await signedIn(h.base, 'buyer');
    const listing = await createListing(seller.user!.id, at());

    const created = await buyer.post(`/listings/${listing.id}/offers`, { amountBdt: 25000 });
    expect(created.status).toBe(201);
    const id = created.body.id;

    // The buyer cannot accept their own pending offer.
    expect((await buyer.post(`/offers/${id}/accept`)).status).toBe(409);

    const countered = await seller.post(`/offers/${id}/counter`, { amountBdt: 28000 });
    expect(countered.body.status).toBe('COUNTERED');
    expect(countered.body.amountBdt).toBe(28000);

    const accepted = await buyer.post(`/offers/${id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    expect((await prisma.listing.findUnique({ where: { id: listing.id } }))!.status).toBe('ACTIVE');
    expect(accepted.body.events.map((e: { type: string }) => e.type)).toEqual(['CREATED', 'COUNTER', 'ACCEPT']);
  });

  it('allows one open offer per buyer, even when requests race', async () => {
    const seller = await signedIn(h.base, 'seller');
    const buyer = await signedIn(h.base, 'buyer');
    const listing = await createListing(seller.user!.id, at());
    const results = await Promise.all(
      Array.from({ length: 5 }, () => buyer.post(`/listings/${listing.id}/offers`, { amountBdt: 25000 })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
  });

  it('allows only one accepted offer per listing when the seller races', async () => {
    const seller = await signedIn(h.base, 'seller');
    const listing = await createListing(seller.user!.id, at());
    const offers = [];
    for (const name of ['b1', 'b2', 'b3']) {
      const buyer = await signedIn(h.base, name);
      offers.push((await buyer.post(`/listings/${listing.id}/offers`, { amountBdt: 25000 })).body.id);
    }
    const results = await Promise.all(offers.map((id) => seller.post(`/offers/${id}/accept`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  });

  it('rejects offers on fixed prices, your own listing, or as an outsider', async () => {
    const seller = await signedIn(h.base, 'seller');
    const buyer = await signedIn(h.base, 'buyer');
    const outsider = await signedIn(h.base, 'outsider');
    const fixed = await createListing(seller.user!.id, at(), { negotiable: false });
    const listing = await createListing(seller.user!.id, at());
    expect((await buyer.post(`/listings/${fixed.id}/offers`, { amountBdt: 100 })).status).toBe(409);
    expect((await seller.post(`/listings/${listing.id}/offers`, { amountBdt: 100 })).status).toBe(409);
    const offer = await buyer.post(`/listings/${listing.id}/offers`, { amountBdt: 100 });
    expect((await outsider.get(`/offers/${offer.body.id}`)).status).toBe(404);
    expect((await outsider.post(`/offers/${offer.body.id}/accept`)).status).toBe(404);
  });
});

describe('messaging', () => {
  async function thread() {
    const seller = await signedIn(h.base, 'seller');
    const buyer = await signedIn(h.base, 'buyer');
    const listing = await createListing(seller.user!.id, at());
    const started = await buyer.post('/conversations', { listingId: listing.id, message: 'Is this available?' });
    expect(started.status).toBe(201);
    return { seller, buyer, listing, id: started.body.id as string };
  }

  it('delivers messages, tracks unread counts and read state', async () => {
    const { seller, id } = await thread();
    expect((await seller.get('/auth/me')).body.unreadMessages).toBe(1);
    const messages = await seller.get(`/conversations/${id}/messages`);
    expect(messages.body.items[0].body).toBe('Is this available?');
    expect((await seller.post(`/conversations/${id}/read`)).status).toBe(204);
    expect((await seller.get('/auth/me')).body.unreadMessages).toBe(0);
  });

  it('reuses one conversation per buyer per listing', async () => {
    const { buyer, listing, id } = await thread();
    expect((await buyer.post('/conversations', { listingId: listing.id })).body.id).toBe(id);
  });

  it('keeps outsiders out of conversations', async () => {
    const { id } = await thread();
    const outsider = await signedIn(h.base, 'outsider');
    expect((await outsider.get(`/conversations/${id}`)).status).toBe(404);
    expect((await outsider.get(`/conversations/${id}/messages`)).status).toBe(404);
    expect((await outsider.post(`/conversations/${id}/messages`, { body: 'hi' })).status).toBe(404);
    expect((await outsider.post(`/conversations/${id}/read`)).status).toBe(404);
  });

  it('stops messages in both directions after a block', async () => {
    const { seller, buyer, id } = await thread();
    expect((await seller.post(`/users/${buyer.user!.id}/block`)).status).toBe(204);
    expect((await buyer.post(`/conversations/${id}/messages`, { body: 'hello?' })).status).toBe(403);
    expect((await seller.post(`/conversations/${id}/messages`, { body: 'hello?' })).status).toBe(403);
    expect((await buyer.get(`/conversations/${id}`)).body.blocked).toBe(true);
  });

  it('requires a verified email to start a conversation', async () => {
    const seller = await signedIn(h.base, 'seller');
    const unverified = await signedIn(h.base, 'unverified', { verified: false });
    const listing = await createListing(seller.user!.id, at());
    expect((await unverified.post('/conversations', { listingId: listing.id })).status).toBe(403);
  });
});

describe('trust and reviews', () => {
  it('only lets the seller-confirmed buyer review, once', async () => {
    const seller = await signedIn(h.base, 'seller');
    const buyer = await signedIn(h.base, 'buyer');
    const stranger = await signedIn(h.base, 'stranger');
    const listing = await createListing(seller.user!.id, at());
    await buyer.post('/conversations', { listingId: listing.id, message: 'Hello there' });

    const review = { listingId: listing.id, rating: 5 };
    expect((await buyer.post('/reviews', review)).status).toBe(403);
    expect((await seller.post(`/listings/${listing.id}/mark-sold`, { soldToUserId: buyer.user!.id })).status).toBeLessThan(300);
    expect((await stranger.post('/reviews', review)).status).toBe(403);
    expect((await seller.post('/reviews', review)).status).toBe(403);
    expect((await buyer.post('/reviews', review)).status).toBe(201);
    expect((await buyer.post('/reviews', review)).status).toBe(409);
  });

  it('accepts one open report per target and hides other people\'s messages', async () => {
    const seller = await signedIn(h.base, 'seller');
    const buyer = await signedIn(h.base, 'buyer');
    const outsider = await signedIn(h.base, 'outsider');
    const listing = await createListing(seller.user!.id, at());
    const report = { targetType: 'LISTING', targetId: listing.id, reason: 'SPAM' };
    expect((await buyer.post('/reports', report)).status).toBe(201);
    expect((await buyer.post('/reports', report)).status).toBe(409);
    expect((await seller.post('/reports', report)).status).toBe(400);

    await buyer.post('/conversations', { listingId: listing.id, message: 'Hello there' });
    const message = await prisma.message.findFirstOrThrow({ where: { senderId: buyer.user!.id } });
    const onMessage = { targetType: 'MESSAGE', targetId: message.id, reason: 'HARASSMENT' };
    expect((await outsider.post('/reports', onMessage)).status).toBe(404);
    expect((await seller.post('/reports', onMessage)).status).toBe(201);
  });
});

describe('admin and moderation', () => {
  it('limits the admin area by role', async () => {
    const user = await signedIn(h.base, 'user');
    const moderator = await signedIn(h.base, 'mod', { role: 'MODERATOR' });
    const admin = await signedIn(h.base, 'admin', { role: 'ADMIN' });
    expect((await user.get('/admin/overview')).status).toBe(403);
    expect((await moderator.get('/admin/overview')).status).toBe(200);
    expect((await moderator.get('/admin/settings')).status).toBe(403);
    expect((await moderator.get('/admin/audit')).status).toBe(403);
    expect((await admin.get('/admin/settings')).status).toBe(200);
  });

  it('prevents privilege escalation', async () => {
    const moderator = await signedIn(h.base, 'mod', { role: 'MODERATOR' });
    const admin = await signedIn(h.base, 'admin', { role: 'ADMIN' });
    const user = await signedIn(h.base, 'user');
    const reason = { reason: 'testing this' };
    expect((await moderator.patch(`/admin/users/${user.user!.id}`, { role: 'ADMIN', ...reason })).status).toBe(403);
    expect((await moderator.patch(`/admin/users/${moderator.user!.id}`, { role: 'ADMIN', ...reason })).status).toBe(403);
    expect((await moderator.patch(`/admin/users/${admin.user!.id}`, { status: 'BANNED', ...reason })).status).toBe(403);
    expect((await admin.patch(`/admin/users/${admin.user!.id}`, { status: 'BANNED', ...reason })).status).toBe(403);
  });

  it('bans a user, ends their sessions and writes the audit log', async () => {
    const admin = await signedIn(h.base, 'admin', { role: 'ADMIN' });
    const user = await signedIn(h.base, 'user');
    expect((await admin.patch(`/admin/users/${user.user!.id}`, { status: 'BANNED', reason: 'Repeated fraud' })).status).toBe(200);
    expect((await user.get('/auth/me')).status).toBe(401);
    const entry = await prisma.auditLog.findFirst({ where: { action: 'user.update', entityId: user.user!.id } });
    expect(entry?.actorId).toBe(admin.user!.id);
  });

  it('approves and rejects from the queue, notifying the seller', async () => {
    const moderator = await signedIn(h.base, 'mod', { role: 'MODERATOR' });
    const seller = await signedIn(h.base, 'seller');
    const a = await createListing(seller.user!.id, at(), { status: 'PENDING_REVIEW', title: 'Pending listing one' });
    const b = await createListing(seller.user!.id, at(), { status: 'PENDING_REVIEW', title: 'Pending listing two' });
    expect((await moderator.post(`/admin/listings/${a.id}/moderate`, { decision: 'approve' })).status).toBe(200);
    expect((await moderator.post(`/admin/listings/${b.id}/moderate`, { decision: 'reject' })).status).toBe(400);
    expect((await moderator.post(`/admin/listings/${b.id}/moderate`, { decision: 'reject', reason: 'Blurry photos' })).status).toBe(200);
    expect((await moderator.post(`/admin/listings/${a.id}/moderate`, { decision: 'approve' })).status).toBe(409);
    expect((await prisma.listing.findUnique({ where: { id: a.id } }))!.status).toBe('ACTIVE');
    expect((await prisma.listing.findUnique({ where: { id: b.id } }))!.rejectionReason).toBe('Blurry photos');
    const types = (await seller.get('/notifications')).body.items.map((n: { type: string }) => n.type).sort();
    expect(types).toEqual(['LISTING_APPROVED', 'LISTING_REJECTED']);
  });

  it('shows moderators the reported message but not the whole conversation', async () => {
    const moderator = await signedIn(h.base, 'mod', { role: 'MODERATOR' });
    const seller = await signedIn(h.base, 'seller');
    const buyer = await signedIn(h.base, 'buyer');
    const listing = await createListing(seller.user!.id, at());
    const { body } = await buyer.post('/conversations', { listingId: listing.id, message: 'Reported text' });
    await buyer.post(`/conversations/${body.id}/messages`, { body: 'Private other text' });
    const message = await prisma.message.findFirstOrThrow({ where: { body: 'Reported text' } });
    await seller.post('/reports', { targetType: 'MESSAGE', targetId: message.id, reason: 'SPAM' });
    const reports = await moderator.get('/admin/reports?status=OPEN');
    expect(reports.body.items[0].target.excerpt).toBe('Reported text');
    expect(JSON.stringify(reports.body)).not.toContain('Private other text');
    expect((await moderator.get(`/conversations/${body.id}`)).status).toBe(404);
  });
});
