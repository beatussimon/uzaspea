#!/bin/bash
set -e

cd ~/uzaspea

echo "=== Fixing root .env to match production settings ==="
cp backend/.env .env

echo "=== Stopping everything ==="
docker compose down -v 2>&1

echo "=== Removing old postgres data ==="
sudo rm -rf persistent_data/postgres/*

echo "=== Starting fresh ==="
docker compose up -d 2>&1

echo "=== Waiting 25 seconds for DB init + migrations ==="
sleep 25

echo ""
echo "=== Container status ==="
docker compose ps 2>&1

echo ""
echo "=== Backend logs (last 20 lines) ==="
docker compose logs backend --tail=20 2>&1

echo ""
echo "=== Container memory ==="
docker stats --no-stream --format "  {{.Name}}: {{.MemUsage}} ({{.MemPerc}})" 2>&1

echo ""
echo "=== RAM ==="
free -h

echo "=== FIX_DONE ==="
