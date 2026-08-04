#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Uzaspea Server Monitor — run manually or via cron
# Shows: RAM, swap, disk, container health, and alerts
# Usage: bash ~/uzaspea/scripts/monitor.sh
# ─────────────────────────────────────────────────────────────────

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  UZASPEA SERVER MONITOR — $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"

# ─── RAM ──────────────────────────────────────────────────────
echo ""
echo "${BOLD}📊 RAM USAGE${NC}"
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
USED_RAM=$(free -m | awk '/^Mem:/{print $3}')
RAM_PCT=$((USED_RAM * 100 / TOTAL_RAM))

if [ $RAM_PCT -gt 90 ]; then
    echo -e "  ${RED}⚠ RAM: ${USED_RAM}MB / ${TOTAL_RAM}MB (${RAM_PCT}%) — CRITICAL${NC}"
elif [ $RAM_PCT -gt 75 ]; then
    echo -e "  ${YELLOW}⚠ RAM: ${USED_RAM}MB / ${TOTAL_RAM}MB (${RAM_PCT}%) — HIGH${NC}"
else
    echo -e "  ${GREEN}✓ RAM: ${USED_RAM}MB / ${TOTAL_RAM}MB (${RAM_PCT}%) — OK${NC}"
fi

# ─── SWAP ─────────────────────────────────────────────────────
TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')
USED_SWAP=$(free -m | awk '/^Swap:/{print $3}')
if [ "$TOTAL_SWAP" -gt 0 ]; then
    SWAP_PCT=$((USED_SWAP * 100 / TOTAL_SWAP))
    if [ $SWAP_PCT -gt 50 ]; then
        echo -e "  ${YELLOW}⚠ SWAP: ${USED_SWAP}MB / ${TOTAL_SWAP}MB (${SWAP_PCT}%) — RAM pressure!${NC}"
    else
        echo -e "  ${GREEN}✓ SWAP: ${USED_SWAP}MB / ${TOTAL_SWAP}MB (${SWAP_PCT}%)${NC}"
    fi
fi

# ─── DISK ─────────────────────────────────────────────────────
echo ""
echo "${BOLD}💾 DISK USAGE${NC}"
DISK_PCT=$(df / | awk 'NR==2{gsub(/%/,""); print $5}')
DISK_USED=$(df -h / | awk 'NR==2{print $3}')
DISK_TOTAL=$(df -h / | awk 'NR==2{print $2}')

if [ "$DISK_PCT" -gt 85 ]; then
    echo -e "  ${RED}⚠ DISK: ${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT}%) — DANGER! Clean up soon${NC}"
elif [ "$DISK_PCT" -gt 70 ]; then
    echo -e "  ${YELLOW}⚠ DISK: ${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT}%) — Getting full${NC}"
else
    echo -e "  ${GREEN}✓ DISK: ${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT}%) — OK${NC}"
fi

# Docker disk usage
DOCKER_DISK=$(docker system df --format "table {{.Type}}\t{{.Size}}\t{{.Reclaimable}}" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo ""
    echo "  Docker disk breakdown:"
    echo "$DOCKER_DISK" | sed 's/^/    /'
fi

# ─── CONTAINER STATUS ────────────────────────────────────────
echo ""
echo "${BOLD}🐳 CONTAINER STATUS${NC}"
CONTAINERS=$(docker compose -f ~/uzaspea/docker-compose.yml ps --format "{{.Name}}|{{.Status}}" 2>/dev/null)
if [ $? -eq 0 ]; then
    while IFS='|' read -r name status; do
        if echo "$status" | grep -qi "up"; then
            echo -e "  ${GREEN}✓ ${name}: ${status}${NC}"
        else
            echo -e "  ${RED}✗ ${name}: ${status}${NC}"
        fi
    done <<< "$CONTAINERS"
else
    echo -e "  ${RED}✗ Could not read container status${NC}"
fi

# ─── CONTAINER MEMORY ────────────────────────────────────────
echo ""
echo "${BOLD}📦 CONTAINER MEMORY (live)${NC}"
docker stats --no-stream --format "  {{.Name}}: {{.MemUsage}} ({{.MemPerc}})" 2>/dev/null | sort

# ─── OOM KILLS (last 24h) ────────────────────────────────────
echo ""
echo "${BOLD}💀 OOM KILLS (last 24h)${NC}"
OOM_COUNT=$(dmesg 2>/dev/null | grep -c "oom-kill" || true)
if [ -n "$OOM_COUNT" ] && [ "$OOM_COUNT" -gt 0 ]; then
    echo -e "  ${RED}⚠ ${OOM_COUNT} OOM kill(s) detected! Check 'dmesg | grep oom'${NC}"
else
    echo -e "  ${GREEN}✓ No OOM kills detected${NC}"
fi

# ─── RESTARTED CONTAINERS ────────────────────────────────────
echo ""
echo "${BOLD}🔄 CONTAINER RESTARTS${NC}"
RESTARTS=$(docker ps --format "{{.Names}}|{{.Status}}" 2>/dev/null | grep -i "restarting" || true)
if [ -n "$RESTARTS" ]; then
    echo -e "  ${RED}⚠ Containers restarting:${NC}"
    echo "$RESTARTS" | sed 's/^/    /'
else
    echo -e "  ${GREEN}✓ No containers in restart loop${NC}"
fi

# ─── MEDIA FOLDER SIZE ───────────────────────────────────────
echo ""
echo "${BOLD}📸 MEDIA UPLOADS${NC}"
MEDIA_SIZE=$(du -sh ~/uzaspea/persistent_data/media 2>/dev/null | cut -f1)
echo "  Media folder: ${MEDIA_SIZE:-N/A}"
POSTGRES_SIZE=$(du -sh ~/uzaspea/persistent_data/postgres 2>/dev/null | cut -f1)
echo "  Postgres data: ${POSTGRES_SIZE:-N/A}"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  💡 Data transfer: check Lightsail console → Networking tab"
echo "  💡 Run 'docker compose logs --tail=50' to see recent errors"
echo "═══════════════════════════════════════════════════════════"
echo ""
