#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p "$BACKUP_DIR"

if [ -f "$PROJECT_DIR/backend/.env" ]; then
    source "$PROJECT_DIR/backend/.env"
fi

DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-uzaspea}"

echo "[$DATE] Starting backup from $PROJECT_DIR..."
docker exec uzaspea-postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "[$DATE] Backup complete: db_$DATE.sql.gz ($(du -sh "$BACKUP_DIR/db_$DATE.sql.gz" | cut -f1))"