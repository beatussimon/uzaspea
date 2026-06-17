#!/bin/bash
set -e

SSH_KEY="~/.ssh/LightsailDefaultKey-ap-south-1.pem"
HOST="ubuntu@3.6.193.212"

echo "Connecting to production..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $HOST << 'EOF'
  set -e
  echo "=> Entering directory..."
  cd ~/uzaspea
  
  echo "=> Running backup.sh..."
  ./scripts/backup.sh
  
  echo "=> Fetching and resetting git history (due to filter-repo)..."
  git fetch origin master
  git reset --hard origin/master
  git clean -fd
  
  echo "=> Building and starting containers..."
  docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
  
  echo "=> Waiting 15s for backend to start..."
  sleep 15
  
  echo "=> Checking site-settings..."
  curl -s http://localhost/api/site-settings/
EOF

echo -e "\nDeployment complete!"
