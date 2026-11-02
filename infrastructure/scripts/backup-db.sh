#!/usr/bin/env bash
# Writes a compressed PostgreSQL dump, then removes this script's own dumps past the retention age.
# Usage: backup-db.sh <project> <env-file> [backup-dir] [keep-days]
set -euo pipefail

project=${1:?compose project, such as sellnest-production}
env_file=${2:?env file, such as .env.production}
dir=${3:-backups/$project}
keep_days=${4:-14}
compose_file="$(dirname "$0")/../docker/compose.prod.yml"

mkdir -p "$dir"
umask 077
target="$dir/$project-$(date +%Y%m%d-%H%M%S).dump"
partial="$target.partial"
trap 'rm -f "$partial"' EXIT

docker compose -p "$project" --env-file "$env_file" -f "$compose_file" exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$partial"

# A dump the tool cannot list is not a backup, so check before keeping it.
docker compose -p "$project" --env-file "$env_file" -f "$compose_file" exec -T postgres pg_restore --list < "$partial" > /dev/null
mv "$partial" "$target"
find "$dir" -maxdepth 1 -type f -name "$project-*.dump" -mtime +"$keep_days" -delete
echo "Backup written: $target"
