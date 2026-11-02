# SellNest

Buy Nearby. Sell Easily. A location-based marketplace where people buy and sell used items in person, starting with the Daffodil International University community in Bangladesh.

SellNest connects buyers and sellers. It does not handle payment, delivery or buyer protection.

## What works

- Accounts with email verification, password reset and server-side sessions in HttpOnly cookies
- Listings: a photo-first sell flow with autosaved drafts, moderation for new accounts, and pause, sold and archive states
- Nearby search with PostGIS distance, typo tolerance, filters and approximate public locations only
- Messaging with live delivery, offers with counter-offers, saved items, reviews, reports and blocks
- Notifications in the app and by email
- Admin area: moderation, reports, users, categories, locations, settings and an audit log

Not built yet: Google and phone sign-in, Bangla, and the items in [TODO.md](TODO.md).

## Quick start

Needs Node 22 or newer, pnpm 11 and Docker.

```bash
cp .env.example .env
pnpm install
pnpm infra:up      # PostgreSQL, Redis, S3-compatible storage and Mailpit, on loopback only
pnpm build:shared
pnpm db:migrate
pnpm db:seed       # reference data and clearly labelled demo listings
pnpm dev
```

Then open http://localhost:3100. Sign in with `rafi@demo.sellnest.invalid` and the password `sellnest-demo-only`. This local demo password does not work in production, where the seed requires your own. Email lands in Mailpit at http://127.0.0.1:58025, and the API reference is at http://localhost:4100/api/docs.

## Layout

| Path | Contents |
| --- | --- |
| `apps/web` | Next.js App Router frontend |
| `apps/api` | NestJS REST API, realtime gateway and background worker |
| `packages/shared` | Types, validation and constants used by both apps |
| `packages/config` | Shared TypeScript configuration |
| `e2e` | Playwright browser tests |
| `infrastructure` | Production Compose file, Dockerfiles, nginx config and backup scripts |

## Documentation

- [Local development, environment, migrations and seed](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Deployment on an Ubuntu VPS](docs/DEPLOYMENT.md)
- [Backup and restore](docs/BACKUP_RESTORE.md)
- [Security checklist](docs/SECURITY.md)
- [Load testing plan](docs/LOAD_TESTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
