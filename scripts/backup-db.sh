#!/usr/bin/env bash
# Nightly backup of the fitness-logger Postgres DB.
# Dumps from the running container (pg_dump, consistent), gzips into ~/backups,
# and prunes after RETAIN_DAYS.
set -euo pipefail

DEST="${BACKUP_DIR:-$HOME/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
PG_CONTAINER="${PG_CONTAINER:-fitness-logger-postgres-1}"

mkdir -p "$DEST"
stamp="$(date +%Y%m%d-%H%M%S)"

docker exec "$PG_CONTAINER" pg_dump -U fitness -d fitness | gzip > "$DEST/fitness-db-$stamp.sql.gz"
find "$DEST" -maxdepth 1 -name 'fitness-db-*.sql.gz' -mtime +"$RETAIN_DAYS" -delete
echo "$(date -Is) fitness-logger backup complete"
