# Backup and restore

## What to back up

| Data | How |
| --- | --- |
| PostgreSQL | `infrastructure/scripts/backup-db.sh` |
| Images | Your storage provider's versioning or replication. Not included in the dump |
| `.env.production` | Your password manager |
| Redis | Not needed for recovery. Sessions live in PostgreSQL; queued jobs and counters are short-lived, though unsent email in the queue is lost |

## Scheduled backup

```bash
infrastructure/scripts/backup-db.sh sellnest-production .env.production /var/backups/sellnest 14
```

The script writes a dump with mode 600, checks it is readable, and removes its own dumps older than 14 days. Schedule it with `crontab -e`:

```
15 2 * * * cd /opt/sellnest && infrastructure/scripts/backup-db.sh sellnest-production .env.production /var/backups/sellnest 14 >> /var/log/sellnest-backup.log 2>&1
```

Copy dumps off the server too, such as with `rclone` to a separate bucket. A backup on the same disk does not survive losing that disk. Dumps contain personal data, so encrypt them and restrict who can read them.

## Restore

Restoring **replaces all data** in that database. The script asks you to type the project name before it does anything.

Test on staging first, whenever you can:

```bash
infrastructure/scripts/restore-db.sh sellnest-staging .env.staging /var/backups/sellnest/<file>.dump
```

Take a fresh backup of the target before restoring over it. After a restore:

1. `curl -s http://127.0.0.1:8088/api/v1/health/ready`
2. Sign in, open a listing and check its images load
3. Run `sn run --rm migrate` if the dump is older than the running code

Test a restore at least once before launch and after any major upgrade.
