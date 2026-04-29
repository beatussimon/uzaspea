#!/bin/bash
set -e

cd ~/uzaspea

echo "=== Stopping all containers ==="
docker compose down -v 2>&1

echo "=== Removing old postgres data (had wrong password) ==="
sudo rm -rf persistent_data/postgres/*

echo "=== Restarting ==="
docker compose up -d 2>&1

echo "=== Waiting 20 seconds for DB init + migrations ==="
sleep 20

echo ""
echo "=== Container status ==="
docker compose ps 2>&1

echo ""
echo "=== Backend logs (last 40 lines) ==="
docker compose logs backend --tail=40 2>&1

echo ""
echo "=== Container memory ==="
docker stats --no-stream --format "  {{.Name}}: {{.MemUsage}} ({{.MemPerc}})" 2>&1

echo ""
echo "=== RAM ==="
free -h

echo "=== RESTART_DONE ==="
