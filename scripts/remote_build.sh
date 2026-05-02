#!/bin/bash
set -e

cd ~/uzaspea

echo "=== Building Docker images ==="
echo "This will take 5-10 minutes on first build..."

docker compose -f docker-compose.prod.yml build 2>&1

echo "=== BUILD_DONE ==="
