#!/usr/bin/env bash
set -euo pipefail

APP_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1.pem"
DATA_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"
TS="$(date +%Y%m%d_%H%M%S)"

echo "=== 1. Backing up Data Node Postgres + .env and fixing 10001:10001 ownership ==="
ssh -n -o StrictHostKeyChecking=no -i "$DATA_KEY" ubuntu@13.235.198.184 "
  set -euo pipefail
  mkdir -p ~/backups ~/env_backups
  chmod 700 ~/backups ~/env_backups
  cp -a ~/uzaspea/.env ~/env_backups/root.env.${TS}
  cp -a ~/uzaspea/backend/.env ~/env_backups/backend.env.${TS}
  chmod 600 ~/env_backups/*.${TS}
  docker exec uzaspea-postgres pg_dump -U postgres -d uzaspea --no-owner --no-acl | gzip -9 > ~/backups/pre_hardening_${TS}.sql.gz
  test \"\$(stat -c%s ~/backups/pre_hardening_${TS}.sql.gz)\" -gt 512
  gzip -t ~/backups/pre_hardening_${TS}.sql.gz
  sudo mkdir -p ~/uzaspea/persistent_data/celerybeat ~/uzaspea/persistent_data/media ~/uzaspea/persistent_data/private_media ~/uzaspea/persistent_data/vault_storage
  sudo chown -R 10001:10001 ~/uzaspea/persistent_data/celerybeat ~/uzaspea/persistent_data/media ~/uzaspea/persistent_data/private_media ~/uzaspea/persistent_data/vault_storage
"

echo "=== 2. Rescuing any ephemeral /app/vault_storage files and preparing App Node persistent_data ==="
ssh -n -o StrictHostKeyChecking=no -i "$APP_KEY" ubuntu@3.6.193.212 "
  set -euo pipefail
  mkdir -p ~/env_backups ~/offnode_backups
  chmod 700 ~/env_backups ~/offnode_backups
  cp -a ~/uzaspea/.env ~/env_backups/root.env.${TS}
  cp -a ~/uzaspea/backend/.env ~/env_backups/backend.env.${TS}
  chmod 600 ~/env_backups/*.${TS}
  sudo mkdir -p ~/uzaspea/persistent_data/media ~/uzaspea/persistent_data/private_media ~/uzaspea/persistent_data/vault_storage/_watermarked ~/uzaspea/persistent_data/geoip ~/uzaspea/persistent_data/static
  if docker ps --format '{{.Names}}' | grep -qx 'uzaspea-backend'; then
    sudo docker cp uzaspea-backend:/app/vault_storage/. ~/uzaspea/persistent_data/vault_storage/ 2>/dev/null || true
  fi
  sudo chown -R 10001:10001 ~/uzaspea/persistent_data/media ~/uzaspea/persistent_data/private_media ~/uzaspea/persistent_data/vault_storage ~/uzaspea/persistent_data/geoip ~/uzaspea/persistent_data/static
  sudo chmod 750 ~/uzaspea/persistent_data
"

echo "=== 3. Copying pre-hardening DB dump to WSL /tmp and App Node offnode_backups ==="
scp -o StrictHostKeyChecking=no -i "$DATA_KEY" "ubuntu@13.235.198.184:~/backups/pre_hardening_${TS}.sql.gz" "/tmp/pre_hardening_${TS}.sql.gz"
scp -o StrictHostKeyChecking=no -i "$APP_KEY" "/tmp/pre_hardening_${TS}.sql.gz" "ubuntu@3.6.193.212:~/offnode_backups/pre_hardening_${TS}.sql.gz"
chmod 600 "/tmp/pre_hardening_${TS}.sql.gz"
echo "STEP_8_1_BACKUP_OK"
