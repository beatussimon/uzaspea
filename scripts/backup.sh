#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"

DB_CONTAINER="${DB_CONTAINER:-uzaspea-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-uzaspea}"
OUT_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

echo "[backup] Dumping ${DB_NAME} from ${DB_CONTAINER}..."
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl | gzip -9 > "${OUT_FILE}"

FILE_SIZE="$(stat -c%s "${OUT_FILE}")"
if [ "${FILE_SIZE}" -lt 512 ] || ! gzip -t "${OUT_FILE}"; then
  echo "[backup] ERROR: Backup ${OUT_FILE} failed integrity check (${FILE_SIZE} bytes)!" >&2
  rm -f "${OUT_FILE}"
  exit 1
fi
ln -sf "${OUT_FILE}" "${BACKUP_DIR}/latest.sql.gz"
echo "[backup] Verified ${OUT_FILE} (${FILE_SIZE} bytes)."

if [ -n "${OFFNODE_TARGET:-}" ] && [ -n "${OFFNODE_KEY:-}" ]; then
  scp -o StrictHostKeyChecking=no -i "${OFFNODE_KEY}" "${OUT_FILE}" "${OFFNODE_TARGET}/"
  echo "[backup] Replicated backup to off-node target ${OFFNODE_TARGET}."
fi

find "${BACKUP_DIR}" -name "db_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete
