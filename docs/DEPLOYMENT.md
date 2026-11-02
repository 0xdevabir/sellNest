# Deployment on an Ubuntu VPS

This guide assumes nothing about your server. Inspect it first, and change nothing that belongs to another service.

## Shape

Docker Compose runs PostgreSQL, Redis, the API, the worker, the web app and an nginx container. PostgreSQL and Redis sit on an internal network and publish no ports. The nginx container publishes one port, on loopback only by default (`HTTP_BIND=127.0.0.1:8088`), so your existing setup keeps ports 80 and 443.

You provide: a domain, a TLS proxy, SMTP credentials and an S3-compatible bucket (Cloudflare R2 works).

## 1. Check the server

```bash
docker --version && docker compose version
sudo ss -tlnp            # what already uses which port
ls /etc/nginx/sites-enabled 2>/dev/null; which caddy
free -h && df -h
```

Choose an `HTTP_BIND` port that is free. Install Docker from docker.com if needed. Keep the firewall limited to SSH, 80 and 443. Docker-published ports can bypass ufw, which is one more reason to keep `HTTP_BIND` on 127.0.0.1.

## 2. Configure

```bash
git clone <your-repository> /opt/sellnest && cd /opt/sellnest
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -hex 32      # once each for POSTGRES_PASSWORD and REDIS_PASSWORD
```

Fill in every `REPLACE_` value. Run `uname -m`: on `aarch64`, set `POSTGIS_IMAGE=imresamu/postgis:17-3.5`, because the official image has no arm64 build.

## 3. Start

```bash
alias sn='docker compose -p sellnest-production --env-file .env.production -f infrastructure/docker/compose.prod.yml'
sn build
sn up -d postgres redis
sn run --rm migrate
sn run --rm seed
sn up -d
sn ps
curl -s http://127.0.0.1:8088/api/v1/health/ready
```

## 4. Create the first admin

```bash
sn run --rm -e ADMIN_BOOTSTRAP_EMAIL='you@example.com' -e ADMIN_BOOTSTRAP_PASSWORD bootstrap-admin
```

Export `ADMIN_BOOTSTRAP_PASSWORD` in your shell first (`read -rs ADMIN_BOOTSTRAP_PASSWORD; export ADMIN_BOOTSTRAP_PASSWORD`), so it stays out of shell history and the process list.

## 5. Add TLS

Add a site to the proxy you already run, and point it at `HTTP_BIND`. The proxy must send `X-Forwarded-For` and `X-Forwarded-Proto`, and allow WebSocket upgrades.

Existing nginx (certificates from certbot):

```nginx
server {
  listen 443 ssl;
  server_name your-domain;
  # ssl_certificate lines from certbot
  client_max_body_size 12m;
  location / {
    proxy_pass http://127.0.0.1:8088;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
    proxy_read_timeout 120s;
  }
}
```

Run `sudo nginx -t` before reloading. Caddy does all of this with `your-domain { reverse_proxy 127.0.0.1:8088 }`.

**Behind Cloudflare:** the proxy must take the visitor's address from `CF-Connecting-IP` and accept it only from Cloudflare's ranges. Otherwise all visitors share a few Cloudflare addresses and hit each other's rate limits.

## Staging

Run a second stack from a separate checkout with its own env file, project name, port, bucket and database:

```bash
docker compose -p sellnest-staging --env-file .env.staging -f infrastructure/docker/compose.prod.yml up -d
```

Set `HTTP_BIND=127.0.0.1:8089`. Use a separate bucket and a mail provider's sandbox, and keep search engines out with HTTP authentication on the proxy.

## Updating

```bash
infrastructure/scripts/backup-db.sh sellnest-production .env.production
git pull
sn build
sn run --rm migrate
sn up -d
```

To roll back, check out the previous commit, rebuild and bring the stack up. A migration does not undo itself, so restore the backup if the old code cannot run on the new schema.

## Launch checklist

- [ ] `https://your-domain` loads with a valid certificate and http redirects to https
- [ ] `sudo ss -tlnp` shows no PostgreSQL or Redis on a public address, and an outside port scan agrees
- [ ] `.env.production` has mode 600 and is not in git
- [ ] Sign-up email arrives and the verify link uses your domain
- [ ] A photo uploads and displays, and storage credentials do not appear in the browser
- [ ] Two browsers exchange messages live, confirming WebSockets work through the proxy
- [ ] Admin can sign in, and `ADMIN_BOOTSTRAP_*` is gone from the environment
- [ ] `SEED_DEMO` is unset, and no demo listings appear
- [ ] DIU and area coordinates checked under Admin > Locations
- [ ] Terms, privacy and prohibited items pages reviewed by a qualified lawyer
- [ ] Daily backup is scheduled, and one restore has been tested
- [ ] Rate limits see real visitor addresses: `sn logs nginx` shows visitors' own addresses, not your proxy's
- [ ] Load test run against staging ([LOAD_TESTING.md](LOAD_TESTING.md))
