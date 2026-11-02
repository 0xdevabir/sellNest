# Troubleshooting

Every API error includes a `requestId`. Search the logs for it: `sn logs api | grep <id>`.

| Symptom | Likely cause and fix |
| --- | --- |
| `Invalid environment configuration` on API start | The message names the variable. In production `WEB_URL` must be https and `SMTP_HOST` is required |
| `next build` fails on `/_global-error` with a `useContext` error | `NODE_ENV=development` leaked from `.env`. Build with `NODE_ENV=production` |
| Chunk errors in the browser after installing packages | Restart the dev server |
| Sign-in fails with "Request origin is not allowed" | The site's address differs from `WEB_URL`. Fix it or add to `CORS_ORIGINS` |
| Signed in on http but the session is lost | Production cookies are Secure. Use https through the TLS proxy |
| Messages only appear after a refresh | WebSockets are blocked or the handshake fails. Check `/socket.io/?EIO=4&transport=polling` returns 200 through the proxy, and that the proxy forwards `Upgrade` |
| Many 429 errors for different people | The API sees one address for everyone. Check that the proxy sends `X-Forwarded-For`, and handle Cloudflare as in DEPLOYMENT.md |
| Browser tests fail with 429 locally | All tests share one address. Setup clears the counters at the start of each run, but running other traffic at the same time can still reach the limit |
| "Check your email" but nothing arrives | Locally, see Mailpit at 127.0.0.1:58025. In production, check `sn logs worker`; email is sent by the worker |
| Photo uploads show a setup notice | `S3_BUCKET` is empty. Set all `S3_*` values |
| Images upload but do not display | `S3_PUBLIC_URL` is wrong or the bucket is not publicly readable |
| `no matching manifest` for postgis | ARM server. Set `POSTGIS_IMAGE=imresamu/postgis:17-3.5` |
| `/health/ready` fails while `/health/live` passes | The API is up but PostgreSQL or Redis is not. Check `sn ps` and their logs |
| A listing does not appear in search | It may be in review, outside the chosen radius or marked sold. New accounts' listings wait for moderation |
