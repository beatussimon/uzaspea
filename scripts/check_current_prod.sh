#!/bin/bash
set -e

echo "=== APP NODE (3.6.193.212) DOCKER PS ==="
ssh -o StrictHostKeyChecking=no -i ~/.ssh/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.193.212 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"'

echo "=== APP NODE BACKEND DB & REDIS CONFIG ==="
ssh -o StrictHostKeyChecking=no -i ~/.ssh/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.193.212 'docker exec uzaspea-backend env | grep -E "REDIS_URL|DATABASE_URL"' || true

echo "=== DATA NODE (13.235.198.184) DOCKER PS ==="
ssh -o StrictHostKeyChecking=no -i ~/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem ubuntu@13.235.198.184 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"' || echo "Data Node check failed or not running"

echo "=== ACTIVE REDIS MAXMEMORY CHECK ==="
# Check Redis on Data Node
ssh -o StrictHostKeyChecking=no -i ~/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem ubuntu@13.235.198.184 'docker exec uzaspea-redis redis-cli -a redis_pass config get maxmemory' 2>/dev/null || true
# Check Redis on App Node if present
ssh -o StrictHostKeyChecking=no -i ~/.ssh/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.193.212 'docker exec uzaspea-redis redis-cli -a redis_pass config get maxmemory' 2>/dev/null || true
