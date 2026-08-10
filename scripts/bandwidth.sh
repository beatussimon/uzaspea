#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Uzaspea Bandwidth Monitor — tracks daily transfer to prevent overage
# Lightsail $10 plan = 3TB/month = ~100GB/day budget
#
# Install:
#   chmod +x ~/uzaspea/scripts/bandwidth.sh
#   crontab -e → add: 0 */6 * * * /home/ubuntu/uzaspea/scripts/bandwidth.sh >> /home/ubuntu/uzaspea/logs/bandwidth.log 2>&1
# ─────────────────────────────────────────────────────────────────

LOG_DIR="/home/ubuntu/uzaspea/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DAY_OF_MONTH=$(date '+%-d')
DAYS_IN_MONTH=$(date -d "$(date '+%Y-%m-01') +1 month -1 day" '+%-d')

# Monthly budget in GB (3TB for $10 plan, but Mumbai may be lower — check your console)
MONTHLY_BUDGET_GB=3000

# Get network stats from /proc/net/dev (eth0 is the main interface on Lightsail)
INTERFACE="eth0"
if [ ! -d "/sys/class/net/$INTERFACE" ]; then
    INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
fi

RX_BYTES=$(cat /sys/class/net/${INTERFACE}/statistics/rx_bytes 2>/dev/null || echo "0")
TX_BYTES=$(cat /sys/class/net/${INTERFACE}/statistics/tx_bytes 2>/dev/null || echo "0")

# Convert to GB
RX_GB=$(echo "scale=2; $RX_BYTES / 1073741824" | bc)
TX_GB=$(echo "scale=2; $TX_BYTES / 1073741824" | bc)
TOTAL_GB=$(echo "scale=2; $RX_GB + $TX_GB" | bc)

# Calculate daily rate and projected monthly usage
# (This is since last boot — for proper tracking, check Lightsail console)
UPTIME_DAYS=$(awk '{print int($1/86400)}' /proc/uptime)
if [ "$UPTIME_DAYS" -lt 1 ]; then UPTIME_DAYS=1; fi

DAILY_RATE=$(echo "scale=2; $TOTAL_GB / $UPTIME_DAYS" | bc)
PROJECTED_MONTHLY=$(echo "scale=0; $DAILY_RATE * 30" | bc)

echo "[$TIMESTAMP] Transfer since boot: RX=${RX_GB}GB TX=${TX_GB}GB TOTAL=${TOTAL_GB}GB"
echo "[$TIMESTAMP] Daily rate: ~${DAILY_RATE}GB/day | Projected monthly: ~${PROJECTED_MONTHLY}GB / ${MONTHLY_BUDGET_GB}GB"

# Alert if projected usage exceeds 80% of budget
THRESHOLD=$(echo "$MONTHLY_BUDGET_GB * 80 / 100" | bc)
if [ "$(echo "$PROJECTED_MONTHLY > $THRESHOLD" | bc)" -eq 1 ]; then
    echo "[$TIMESTAMP] ⚠ WARNING: Projected transfer ${PROJECTED_MONTHLY}GB exceeds 80% of ${MONTHLY_BUDGET_GB}GB budget!"
    echo "[$TIMESTAMP] ⚠ Check Lightsail console for accurate billing data"
fi

# For accurate transfer data, always check:
# Lightsail Console → Instance → Networking → Data transfer
echo "[$TIMESTAMP] 💡 For billing-accurate data: Lightsail Console → Networking → Data Transfer"
