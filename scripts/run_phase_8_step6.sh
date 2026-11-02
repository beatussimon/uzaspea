#!/usr/bin/env bash
set -euo pipefail
APP_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1.pem"
DATA_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"

PUB_KEY="$(ssh -n -o StrictHostKeyChecking=no -i "$DATA_KEY" ubuntu@13.235.198.184 '
  if [ ! -f ~/.ssh/id_ed25519_offnode_backup ]; then
    ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519_offnode_backup -C "uzaspea-data-backup" >/dev/null
  fi
  cat ~/.ssh/id_ed25519_offnode_backup.pub
')"

ssh -n -o StrictHostKeyChecking=no -i "$APP_KEY" ubuntu@3.6.193.212 "
  mkdir -p ~/.ssh ~/offnode_backups && chmod 700 ~/.ssh ~/offnode_backups
  grep -qxF '${PUB_KEY}' ~/.ssh/authorized_keys 2>/dev/null || echo '${PUB_KEY}' >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  (crontab -l 2>/dev/null | grep -v 'offnode_backups' || true; echo '45 2 * * * find /home/ubuntu/offnode_backups -name \"db_*.sql.gz\" -type f -mtime +14 -delete') | crontab -
"

ssh -n -o StrictHostKeyChecking=no -i "$DATA_KEY" ubuntu@13.235.198.184 '
  set -euo pipefail
  CRON_LINE="15 2 * * * OFFNODE_TARGET=ubuntu@172.26.36.142:/home/ubuntu/offnode_backups OFFNODE_KEY=/home/ubuntu/.ssh/id_ed25519_offnode_backup /home/ubuntu/uzaspea/scripts/backup.sh && rsync -az --exclude=_watermarked -e \"ssh -o StrictHostKeyChecking=no -i /home/ubuntu/.ssh/id_ed25519_offnode_backup\" ubuntu@172.26.36.142:/home/ubuntu/uzaspea/persistent_data/vault_storage/ /home/ubuntu/backups/vault_storage_mirror/ >> /home/ubuntu/backups/backup.log 2>&1"
  (crontab -l 2>/dev/null | grep -v "/uzaspea/scripts/backup.sh" || true; echo "$CRON_LINE") | crontab -
  OFFNODE_TARGET=ubuntu@172.26.36.142:/home/ubuntu/offnode_backups \
  OFFNODE_KEY=/home/ubuntu/.ssh/id_ed25519_offnode_backup \
  /home/ubuntu/uzaspea/scripts/backup.sh
'

ssh -n -o StrictHostKeyChecking=no -i "$APP_KEY" ubuntu@3.6.193.212 'ls -lh ~/offnode_backups/ | tail -n 5'
echo "STEP_8_6_TWONODE_BACKUP_OK"
