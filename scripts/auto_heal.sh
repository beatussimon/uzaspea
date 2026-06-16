#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Uzaspea Auto-Alert — runs via cron every 5 minutes
# Restarts crashed containers + logs warnings
# 
# Install:
#   chmod +x ~/uzaspea/scripts/auto_heal.sh
#   crontab -e → add: */5 * * * * /home/ubuntu/uzaspea/scripts/auto_heal.sh >> /home/ubuntu/uzaspea/logs/auto_heal.log 2>&1
# ─────────────────────────────────────────────────────────────────

LOG_DIR="/home/ubuntu/uzaspea/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMPOSE_FILE="/home/ubuntu/uzaspea/docker-compose.yml"

# ─── Check if any containers are down ────────────────────────
DOWN_CONTAINERS=$(docker compose -f "$COMPOSE_FILE" ps --status exited --format "{{.Name}}" 2>/dev/null)

if [ -n "$DOWN_CONTAINERS" ]; then
    echo "[$TIMESTAMP] WARNING: Down containers detected: $DOWN_CONTAINERS"
    echo "[$TIMESTAMP] Attempting restart..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo "[$TIMESTAMP] Restart triggered."
fi

# ─── Check RAM pressure ──────────────────────────────────────
RAM_PCT=$(free | awk '/^Mem:/{printf "%.0f", $3/$2 * 100}')
SWAP_USED=$(free -m | awk '/^Swap:/{print $3}')

if [ "$RAM_PCT" -gt 95 ]; then
    echo "[$TIMESTAMP] CRITICAL: RAM at ${RAM_PCT}% — system may OOM"
fi

if [ "$SWAP_USED" -gt 1024 ]; then
    echo "[$TIMESTAMP] WARNING: Swap usage ${SWAP_USED}MB — heavy RAM pressure"
fi

# ─── Check disk space ────────────────────────────────────────
DISK_PCT=$(df / | awk 'NR==2{gsub(/%/,""); print $5}')

if [ "$DISK_PCT" -gt 90 ]; then
    echo "[$TIMESTAMP] CRITICAL: Disk at ${DISK_PCT}% — cleaning Docker cache"
    docker system prune -f 2>/dev/null
    docker image prune -f 2>/dev/null
    echo "[$TIMESTAMP] Docker prune completed"
fi

if [ "$DISK_PCT" -gt 80 ]; then
    echo "[$TIMESTAMP] WARNING: Disk at ${DISK_PCT}%"
fi

# ─── Rotate this log file if too big (>5MB) ──────────────────
LOG_FILE="$LOG_DIR/auto_heal.log"
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat --format=%s "$LOG_FILE" 2>/dev/null || echo "0")
    if [ "$LOG_SIZE" -gt 5242880 ]; then
        mv "$LOG_FILE" "$LOG_FILE.old"
        echo "[$TIMESTAMP] Log rotated (was ${LOG_SIZE} bytes)"
    fi
fi
