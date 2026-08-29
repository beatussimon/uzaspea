#!/bin/bash
# Fix: Point DATABASE_URL and REDIS_URL to local containers instead of unreachable Data Node
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
  -i ~/.ssh/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.193.212 << 'REMOTE_EOF'
set -e
cd ~/uzaspea

echo "==> Current DATABASE_URL and REDIS_URL:"
grep -E '^(DATABASE_URL|REDIS_URL)' .env

echo ""
echo "==> Fixing .env to use local containers..."
sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgres://postgres:local_password@db:5432/uzaspea|' .env
sed -i 's|^REDIS_URL=.*|REDIS_URL=redis://:af16f7d8f558592b056354d54b325462@redis:6379/0|' .env

echo ""
echo "==> Updated values:"
grep -E '^(DATABASE_URL|REDIS_URL)' .env

echo ""
echo "==> Restarting backend..."
docker compose -f docker-compose.app.yml restart backend

echo ""
echo "==> Waiting 10 seconds for backend to start..."
sleep 10

echo ""
echo "==> Backend status:"
docker compose -f docker-compose.app.yml ps backend

echo ""
echo "==> Backend logs (last 20 lines):"
docker compose -f docker-compose.app.yml logs backend --tail=20
REMOTE_EOF
