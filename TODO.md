# TODO

## Before launch (needs you)

- [ ] Choose domain, VPS, SMTP provider and S3-compatible bucket, then follow docs/DEPLOYMENT.md
- [ ] Check DIU and area coordinates, which are approximate
- [ ] Replace the generated sample images if demo data is ever shown
- [ ] Have a lawyer review the terms, privacy and prohibited items pages
- [ ] Decide the support address (`CONTACT_EMAIL`)
- [ ] Run the load test on staging (docs/LOAD_TESTING.md)

## Not built

- [ ] Google sign-in and phone verification (needs provider credentials and a decision)
- [ ] Bangla translation (copy is English only, with no translation layer yet)
- [ ] MFA for staff accounts
- [ ] Content-Security-Policy on web pages
- [ ] CI pipeline running typecheck, unit and browser tests

## Worth improving

- [ ] Make typo-tolerant search index-backed if load testing shows it is slow
- [ ] Move image processing to the worker if uploads slow the API
- [ ] Automated clean-up of E2E data in the development database
