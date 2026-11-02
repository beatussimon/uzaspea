#!/usr/bin/env bash
set -euo pipefail
cd /home/bea/uzaspea
./deploy.sh

APP_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1.pem"
echo "=== Waiting up to 90s for uzaspea-backend healthcheck, seeding country.mmdb & migrating private media ==="
ssh -n -o StrictHostKeyChecking=no -i "$APP_KEY" ubuntu@3.6.193.212 '
  set -euo pipefail
  HEALTHY=0
  for i in $(seq 1 30); do
    if docker exec uzaspea-backend curl -fsS http://127.0.0.1:8000/api/health/live/ >/dev/null 2>&1 || docker exec uzaspea-backend curl -fsS http://127.0.0.1:8000/api/health/ >/dev/null 2>&1; then
      echo "Backend healthy!"
      HEALTHY=1
      break
    fi
    echo "Waiting for backend to start ($i/30)..."
    sleep 3
  done

  if [ "$HEALTHY" -ne 1 ]; then
    echo "ERROR: Backend failed to become healthy within 90s"
    docker logs --tail 50 uzaspea-backend
    exit 1
  fi

  docker exec uzaspea-backend python manage.py update_geoip_db --non-fatal
  docker exec uzaspea-backend python manage.py migrate_private_media --commit
'
echo "STEP_8_5_DEPLOY_GEOIP_AND_MEDIA_MIGRATION_OK"
