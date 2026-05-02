#!/bin/bash
set -e

cd ~/uzaspea

echo "=== Starting all containers ==="
docker compose -f docker-compose.prod.yml up -d 2>&1

echo ""
echo "=== Waiting 15 seconds for containers to stabilize ==="
sleep 15

echo ""
echo "=== Container status ==="
docker compose ps 2>&1

echo ""
echo "=== RAM usage ==="
free -h

echo ""
echo "=== Container memory ==="
docker stats --no-stream --format "  {{.Name}}: {{.MemUsage}} ({{.MemPerc}})" 2>&1

echo ""
echo "=== Checking backend logs (last 30 lines) ==="
docker compose logs backend --tail=30 2>&1

echo ""
echo "=== LAUNCH_DONE ==="
