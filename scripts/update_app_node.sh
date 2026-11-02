#!/usr/bin/env bash
set -euo pipefail
APP_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1.pem"

ssh -o StrictHostKeyChecking=no -i "$APP_KEY" ubuntu@3.6.193.212 bash << 'EOF'
  set -euo pipefail
  cd ~/uzaspea
  git fetch origin master
  git reset --hard origin/master
  docker compose -f docker-compose.app.yml build backend frontend
  docker compose -f docker-compose.app.yml up -d --remove-orphans
EOF
