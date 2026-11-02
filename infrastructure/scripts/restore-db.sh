#!/usr/bin/env bash
# Restores a dump into a database, REPLACING what it holds. Asks for the project name first.
# Usage: restore-db.sh <project> <env-file> <dump-file>
set -euo pipefail

project=${1:?compose project}
env_file=${2:?env file}
dump=${3:?dump file}
compose_file="$(dirname "$0")/../docker/compose.prod.yml"
compose() { docker compose -p "$project" --env-file "$env_file" -f "$compose_file" "$@"; }

[ -f "$dump" ] || { echo "No such file: $dump" >&2; exit 1; }
echo "This replaces ALL data in the '$project' database with $dump."
read -r -p "Type the project name to continue: " answer
[ "$answer" = "$project" ] || { echo "Cancelled. Nothing changed."; exit 1; }

compose stop api worker web
compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$dump"
compose up -d api worker web
echo "Restored. Check the site, then run the post-restore checks in docs/BACKUP_RESTORE.md."
