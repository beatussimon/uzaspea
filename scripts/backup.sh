#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/home/bea/uzaspea/backups
mkdir -p $BACKUP_DIR

source /home/bea/uzaspea/backend/.env

echo "[$DATE] Starting backup..."

# Postgres dump
docker exec uzaspea-postgres pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "[$DATE] Backup complete: db_$DATE.sql.gz"
