#!/usr/bin/env bash
set -euo pipefail
APP_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1.pem"
DATA_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"

echo "=== 1. Data Node Container Health & Postgres TLS Verification ==="
ssh -o StrictHostKeyChecking=no -i "$DATA_KEY" ubuntu@13.235.198.184 bash << 'EOF'
  set -euo pipefail
  docker ps --format "{{.Names}} -> {{.Status}}"
  docker ps --filter name=uzaspea-celery-beat --filter status=running --format "{{.Names}}" | grep -q uzaspea-celery-beat
  docker exec uzaspea-postgres psql -U postgres -tAc "SHOW ssl;" | grep -qx "on"
EOF

echo "=== 2. App Node Container Health, Digital Vault Mount & Geofence Simulation ==="
ssh -o StrictHostKeyChecking=no -i "$APP_KEY" ubuntu@3.6.193.212 bash << 'EOF'
  set -euo pipefail
  docker ps --format "{{.Names}} -> {{.Status}}"
  docker exec uzaspea-backend curl -fsS http://127.0.0.1:8000/api/health/
  echo ""
  docker exec uzaspea-backend python manage.py shell -c "import pypdf, reportlab, maxminddb; from marketplace.models import GeofenceSettings; g = GeofenceSettings.load(); print('Vault and Geofence Singleton OK:', g)"
EOF

echo "=== 3. External Attack-Surface Verification (Public DB/Redis & Direct Origin Blocked!) ==="
! timeout 4 bash -c "</dev/tcp/13.235.198.184/5432" 2>/dev/null
! timeout 4 bash -c "</dev/tcp/13.235.198.184/6379" 2>/dev/null
! curl -fsS --max-time 4 http://3.6.193.212/ >/dev/null 2>&1
echo "External port blocks verified (5432, 6379, and non-Cloudflare direct 80 blocked)!"

echo "=== 4. Live Public HTTPS, Security Headers, Private Media/Vault Isolation & Geofence Status ==="
curl -fsS https://pasifiq.store/api/health/ | grep -q '"status": "healthy"'
curl -fsS https://pasifiq.store/api/geofence/status/ | grep -q '"restricted"'
HEADERS="$(curl -fsSI https://pasifiq.store/)"
echo "$HEADERS" | grep -qi "strict-transport-security:"
echo "$HEADERS" | grep -qi "content-security-policy:"
echo "$HEADERS" | grep -qi "x-content-type-options: nosniff"
test "$(curl -s -o /dev/null -w '%{http_code}' https://pasifiq.store/_protected_media/probe.pdf)" = "404"
test "$(curl -s -o /dev/null -w '%{http_code}' https://pasifiq.store/_protected_vault/probe.pdf)" = "404"
test "$(curl -s -o /dev/null -w '%{http_code}' https://pasifiq.store/internal/media-auth/probe.pdf)" = "404"
test "$(curl -s -o /dev/null -w '%{http_code}' https://pasifiq.store/api/invoices/verify/1/)" = "403"
test "$(curl -s -o /dev/null -w '%{http_code}' -A 'Googlebot/2.1' https://pasifiq.store/this-route-does-not-exist-99999)" = "404"

echo "ALL_PHASES_0_TO_8_VERIFIED_COMPLETE"
