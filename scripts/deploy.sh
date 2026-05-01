#!/usr/bin/env bash
# scripts/deploy.sh — runs on the Lightsail instance
# Detects new commits, pulls code, rebuilds images, health checks.
#
# One-time setup:
#   chmod +x /home/ubuntu/uzaspea/scripts/deploy.sh
#   crontab -e
#   Add: */5 * * * * /home/ubuntu/uzaspea/scripts/deploy.sh >> /var/log/uzaspea-deploy.log 2>&1

set -euo pipefail

REPO_DIR="/home/ubuntu/uzaspea"
COMPOSE_FILE="docker-compose.prod.yml"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

cd "$REPO_DIR"

# ── 1. Check for new commits ───────────────────────────────────────────────
git fetch origin master --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "$LOG_PREFIX No new commits. Nothing to do."
  exit 0
fi

echo "$LOG_PREFIX New commits detected. Deploying $LOCAL → $REMOTE"

# ── 2. Pull latest code ────────────────────────────────────────────────────
git pull origin master --quiet
echo "$LOG_PREFIX Code updated."

# ── 3. Ensure persistent data directories exist ───────────────────────────
mkdir -p persistent_data/{postgres,redis,media,static,celerybeat}

# ── 4. Build and bring up ─────────────────────────────────────────────────
echo "$LOG_PREFIX Building images and starting services..."
docker compose -f "$COMPOSE_FILE" build --pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
echo "$LOG_PREFIX Services started."

# ── 5. Health check (2 minutes max) ───────────────────────────────────────
echo "$LOG_PREFIX Running health check..."
HEALTHY=false
for i in $(seq 1 24); do
  if curl -sf --max-time 5 http://localhost/api/site-settings/ > /dev/null 2>&1; then
    echo "$LOG_PREFIX ✅ Backend healthy (attempt $i/24)"
    HEALTHY=true
    break
  fi
  echo "$LOG_PREFIX ⏳ Attempt $i/24 — waiting 5s..."
  sleep 5
done

if [ "$HEALTHY" = false ]; then
  echo "$LOG_PREFIX ❌ Health check failed. Logs:"
  docker compose -f "$COMPOSE_FILE" logs --tail=60 backend
  exit 1
fi

# ── 6. Prune old image layers ─────────────────────────────────────────────
docker image prune -f --filter "until=24h" > /dev/null 2>&1 || true
echo "$LOG_PREFIX 🚀 Deployment complete. Commit: $REMOTE"
