# Local development

## Services and ports

Ports are offset so they do not collide with other local projects. All bind to 127.0.0.1.

| Service | Port | Notes |
| --- | --- | --- |
| Web | 3100 | Forwards `/api` and `/socket.io` to the API, so the browser sees one origin |
| API | 4100 | Reference at `/api/docs` outside production |
| PostgreSQL + PostGIS | 55532 | |
| Redis | 56479 | |
| SeaweedFS (S3) | 59100 | The API creates the bucket on startup outside production |
| Mailpit | 51125 SMTP, 58025 UI | Catches all outgoing email |

## Environment variables

`.env.example` documents the development values and `.env.production.example` the production ones. `.env` files are ignored by git and must stay that way.

| Variable | Purpose |
| --- | --- |
| `WEB_URL` | Public address. Also the allowed browser origin. Must be https in production |
| `CORS_ORIGINS` | Extra allowed origins, comma separated |
| `API_PORT`, `API_INTERNAL_URL` | Where the API listens, and where Next.js reaches it |
| `DATABASE_URL`, `REDIS_URL` | Data stores |
| `S3_*` | Image storage. With `S3_BUCKET` empty, the sell flow shows a setup-required notice |
| `SMTP_*`, `MAIL_FROM` | Email. `SMTP_HOST` is required in production |
| `RUN_WORKER_IN_API` | Runs background jobs inside the API. Production uses a separate worker |
| `CONTACT_EMAIL` | Support address on the contact and legal pages |
| `ENABLE_API_DOCS` | Set to `true` to serve `/api/docs` in production |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` | One-time admin creation. Remove after use |
| `SEED_DEMO`, `DEMO_PASSWORD` | Demo data control |

## Migrations

```bash
pnpm db:migrate                                 # apply pending migrations
cd apps/api && npx dotenv -e ../../.env -- prisma migrate dev --name describe_change   # create one
```

Spatial columns and search indexes are written as raw SQL in the migrations, because Prisma cannot express them. Review generated migrations for accidental drops of these.

## Seed data

`pnpm db:seed` creates reference data (categories, Bangladesh locations and the DIU community) and, outside production, demo accounts under `demo.sellnest.invalid` with listings labelled as samples. `pnpm db:demo:remove` removes the demo data. In production, demo data needs both `SEED_DEMO=true` and your own `DEMO_PASSWORD`.

DIU and area coordinates in the seed are approximate. Check them before launch, under Admin > Locations.

## First admin

Nobody can make themselves an admin through the app. Set the two `ADMIN_BOOTSTRAP_*` variables and run `pnpm admin:bootstrap`. The command refuses to run once an admin exists.

## Tests

```bash
pnpm typecheck
pnpm test        # unit and integration tests. API tests use the local database and Redis
pnpm test:e2e    # Playwright. Needs the app running; see below
```

The browser tests need a running stack, an admin account and Chromium (`npx playwright install chromium` in `e2e`). They run best against a production build:

```bash
pnpm build
cd apps/api && npx dotenv -e ../../.env -- node dist/main.js
cd apps/web && NODE_ENV=production npx dotenv -e ../../.env -- npx next start -p 3100
```

Create a local admin with the bootstrap command, then pass it through `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. All tests share one address, so setup clears the rate-limit counters in the `sellnest-dev-redis-1` container before each run. The suite leaves test listings and users in the development database.

Build the web app with `NODE_ENV=production`, because `NODE_ENV=development` from `.env` breaks the build of the error pages.
