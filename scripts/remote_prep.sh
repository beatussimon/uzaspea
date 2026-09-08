#!/bin/bash
set -e

echo "=== Preparing directories ==="
cd ~/uzaspea
mkdir -p persistent_data/media persistent_data/static persistent_data/postgres persistent_data/redis logs

echo "=== Preparing traefik_acme.json ==="
touch traefik_acme.json
chmod 600 traefik_acme.json

echo "=== Fixing script permissions ==="
chmod +x scripts/*.sh

echo "=== Setting up cron jobs ==="
# Remove existing uzaspea cron entries, then add fresh
(crontab -l 2>/dev/null | grep -v uzaspea; echo "*/5 * * * * /home/ubuntu/uzaspea/scripts/auto_heal.sh >> /home/ubuntu/uzaspea/logs/auto_heal.log 2>&1"; echo "0 */6 * * * /home/ubuntu/uzaspea/scripts/bandwidth.sh >> /home/ubuntu/uzaspea/logs/bandwidth.log 2>&1") | crontab -

echo "=== Current cron ==="
crontab -l

echo "=== Verifying project structure ==="
ls -la ~/uzaspea/
echo "---"
ls -la ~/uzaspea/backend/.env
echo "---"
cat ~/uzaspea/docker-compose.yml | head -5

echo "=== PREP_DONE ==="
