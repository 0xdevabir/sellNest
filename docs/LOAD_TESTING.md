# Load testing plan

**No load test has been run, so SellNest claims no capacity figure.** Run this on staging, on hardware matching production, and never against production without a maintenance window.

## Preparation

- Seed realistic volume: start with 100,000 listings and 50,000 users, using a throwaway script against staging only
- Rate limits will block a test from one address. Generate load from several addresses, or raise the limits on staging only and record that you did
- Watch CPU and memory per container (`docker stats`), PostgreSQL `pg_stat_statements` and connections, Redis memory, and API latency in the logs

## Scenarios (k6 suggested)

| Scenario | Mix | Why |
| --- | --- | --- |
| Browse | Home, search, listing detail | The most common path |
| Search | Text, typo and radius queries over all listing volumes | `word_similarity` is not index-backed and is the likeliest slow query |
| Chat | Open sockets, send messages | Socket memory, Redis fan-out |
| Offers | Many buyers offering on the same listing | Row-lock contention |
| Sell | Upload photos and publish | sharp is CPU-heavy and can starve the API |

## Procedure

Ramp up in steps and hold each for 5 to 10 minutes: for example 10, 25, 50, 100 and 200 concurrent virtual users, stopping when a target is missed.

Starting targets, to be revised with real data: 95th percentile below 500 ms on API reads and below 1.5 s on search, under 1% errors excluding 429s, and no growth in queue backlog.

## Record

For each run: commit, server size, data volume, limit changes, peak users held within target, and the first bottleneck. Quote capacity only from these results, and only for that setup.

## Likely first fixes

Add a bounded candidate step before fuzzy matching, tune `connection_limit`, move image processing to the worker, and add short-lived caching for anonymous search.
