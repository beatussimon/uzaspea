#!/bin/bash
set -e

APP_INSTANCE="3.6.193.212"
DATA_INSTANCE="13.235.198.184"
APP_SSH_KEY="~/.ssh/LightsailDefaultKey-ap-south-1.pem"
DATA_SSH_KEY="~/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"

echo "Pushing latest code to GitHub..."
./push_script.sh

echo "=========================================="
echo " Deploying to Data Node ($DATA_INSTANCE)  "
echo "=========================================="
ssh -o StrictHostKeyChecking=no -i $DATA_SSH_KEY ubuntu@$DATA_INSTANCE << 'EOF'
  set -e
  echo "=> Entering deployment directory..."
  cd ~/uzaspea
  
  echo "=> Fetching latest code and resetting to origin/master..."
  git fetch origin master
  git reset --hard origin/master
  git clean -fd
  
  echo "=> Building and restarting Data Node containers (Postgres, Redis, Celery)..."
  docker compose -f docker-compose.data.yml up -d --build --remove-orphans
EOF

echo "=========================================="
echo " Deploying to App Node ($APP_INSTANCE)    "
echo "=========================================="
ssh -o StrictHostKeyChecking=no -i $APP_SSH_KEY ubuntu@$APP_INSTANCE << 'EOF'
  set -e
  echo "=> Entering deployment directory..."
  cd ~/uzaspea
  
  echo "=> Fetching latest code and resetting to origin/master..."
  git fetch origin master
  git reset --hard origin/master
  git clean -fd
  
  echo "=> Building and restarting App Node containers (Traefik, Backend, Frontend)..."
  docker compose -f docker-compose.app.yml up -d --build --remove-orphans
  
  echo "=> Waiting 10s for services to stabilize..."
  sleep 10
  
  echo -e "\n=> Running database migrations (remotely on Data Node)..."
  docker compose -f docker-compose.app.yml exec -T backend python manage.py migrate

  echo -e "\n=> Deployment successfully completed on server."
EOF

echo -e "\nDeployment process finished locally!"
