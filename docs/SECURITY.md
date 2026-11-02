# Security checklist

## In place, covered by tests or code review

- Passwords hashed with Argon2id. Hashes, tokens and secrets never appear in API responses
- Opaque sessions in HttpOnly, Secure, SameSite=Lax cookies, stored hashed and revocable. Nothing in localStorage
- Origin check on state-changing requests
- Rate limits on sign-in, sign-up, password reset, messaging, offers, reports and uploads
- Validation on every write, on the server
- Authorization checked per route and per object. Users cannot grant themselves staff roles; the first admin comes from a server command
- Exact coordinates, phone numbers and private details are not returned to other users
- Uploads checked by content, re-encoded and stripped of metadata
- Logs exclude passwords, tokens, cookies and reset links
- Admin actions recorded in the audit log
- PostgreSQL and Redis publish no ports in production, and Redis requires a password

## Your responsibilities at deployment

- [ ] Generate unique secrets for each environment. Never reuse the development values
- [ ] Keep `.env.production` at mode 600 and out of git
- [ ] Set up TLS and keep certificates renewing
- [ ] Limit the firewall to SSH, 80 and 443. Use SSH keys only
- [ ] Keep `HTTP_BIND` on loopback. nginx trusts private addresses to report the visitor's address
- [ ] Apply OS and image updates on a schedule
- [ ] Enable MFA on the VPS, DNS, mail and storage accounts
- [ ] Give storage keys access to one bucket only
- [ ] Keep `ENABLE_API_DOCS` off unless needed

## Known limits

- No independent security review or penetration test has been done
- No MFA for staff accounts yet. Use strong, unique passwords on them
- nginx sets basic security headers but no Content-Security-Policy on web pages. Adding one is on the TODO list
- Legal pages are drafts and need a qualified lawyer's review
