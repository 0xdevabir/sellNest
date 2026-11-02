# Architecture

```
Browser ──> TLS proxy ──> nginx ─┬─ /api, /socket.io ──> NestJS API ──┬─ PostgreSQL + PostGIS
                                 └─ everything else ──> Next.js       ├─ Redis
                                        │ server rendering            └─ S3-compatible storage
                                        └──────────> API              Worker: BullMQ jobs, email, cleanup
```

## Decisions

**One origin.** The browser only talks to one address, so the session cookie stays first-party and needs no CORS.

**Sessions.** An opaque random token sits in an HttpOnly cookie and only its hash is stored. No token reaches localStorage. Mutating requests with a session must carry an allowed `Origin`, on top of `SameSite=Lax`.

**Rate limits.** Counters live in Redis and apply per address or per user. Server-rendered pages forward the visitor's address, and nginx replaces `X-Forwarded-For` so it cannot be forged. If Redis is down, limits fail open so the site stays usable.

**Location.** Listings store an exact point for distance calculation, and the API returns only the area name and a rounded distance. Exact coordinates never reach the client. Locations form a hierarchy (country, division, district, area, campus), so new regions are data rather than code.

**Search.** Text search and PostGIS distance run in PostgreSQL. The typo-tolerant match uses `word_similarity`, which cannot use the trigram index, so it scans the rows left after the other filters. Measure it under load before relying on it at scale; see [LOAD_TESTING.md](LOAD_TESTING.md).

**Concurrency.** Offer responses and listing status changes take a row lock on the listing inside a transaction, so simultaneous actions apply one at a time and a stale one gets a 409. A partial unique index allows one open offer per buyer per listing.

**Realtime.** Sending goes through REST, so validation and rate limits have one path. Sockets only deliver, and only join the room of their own user. A Redis adapter allows more than one API process later.

**Accepting an offer does not sell the item.** It records an agreement. The seller marks the item sold after the handover, and either side can back out before that. The app says so, because SellNest does not handle payment.

**Images.** Uploads pass through the API, which checks the real file type and re-encodes to WebP with sharp, removing metadata such as GPS. Storage credentials stay on the server.

## Scaling path, in order

1. Run the worker on its own (already the production default) and raise resources.
2. Move PostgreSQL to a managed service or dedicated server.
3. Run more API and web processes behind nginx. Sessions, limits and realtime already live in Redis.
4. Add read replicas or a search engine if measurements call for it.

No capacity figure is claimed for any step until it has been load tested.
