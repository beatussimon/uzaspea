#!/bin/bash
set -e

APP_INSTANCE="3.6.193.212"
DATA_INSTANCE="13.235.198.184"
APP_SSH_KEY="~/.ssh/LightsailDefaultKey-ap-south-1.pem"
DATA_SSH_KEY="~/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"

echo "Building frontend locally to avoid App Node OOM..."
cd frontend
npm run build
cd ..

echo "Pushing latest code to GitHub..."
./push_script.sh

echo "=========================================="
echo " Deploying to Data Node ($DATA_INSTANCE)  "
echo "=========================================="
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i $DATA_SSH_KEY ubuntu@$DATA_INSTANCE << EOF
  set -e
  APP_INSTANCE="${APP_INSTANCE}"
  echo "=> Entering deployment directory..."
  cd ~/uzaspea
  
  echo "=> Fetching latest code and resetting to origin/master..."
  git fetch origin master
  git reset --hard origin/master
  git clean -fd
  
  echo "=> Building Celery container..."
  docker compose -f docker-compose.data.yml build celery-worker
  
  echo "=> Restarting Data Node containers (Postgres, Redis, Celery)..."
  docker compose -f docker-compose.data.yml up -d --remove-orphans

  echo "=> Securing database ports (DOCKER-USER chain)..."
  sudo iptables -N DOCKER-USER 2>/dev/null || true
  sudo iptables -C DOCKER-USER -j RETURN 2>/dev/null || sudo iptables -A DOCKER-USER -j RETURN
  sudo iptables -F DOCKER-USER
  # Allow internal docker and private VPC networks
  sudo iptables -A DOCKER-USER -i docker0 -j RETURN
  sudo iptables -A DOCKER-USER -s 172.16.0.0/12 -j RETURN
  sudo iptables -A DOCKER-USER -s 10.0.0.0/8 -j RETURN
  sudo iptables -A DOCKER-USER -s 127.0.0.1 -j RETURN
  # Allow App Node public IP
  sudo iptables -A DOCKER-USER -s $APP_INSTANCE -j RETURN
  # Drop all other external traffic to 5432 and 6379
  sudo iptables -A DOCKER-USER -p tcp -m multiport --dports 5432,6379 -j DROP
  sudo iptables -A DOCKER-USER -j RETURN

  echo "=> Cleaning up old Docker images..."
  docker image prune -f
EOF

echo "=========================================="
echo " Deploying to App Node ($APP_INSTANCE)    "
echo "=========================================="
ssh -o StrictHostKeyChecking=no -i $APP_SSH_KEY ubuntu@$APP_INSTANCE << EOF
  set -e
  echo "=> Entering deployment directory..."
  cd ~/uzaspea
  
  echo "=> Fetching latest code and resetting to origin/master..."
  git fetch origin master
  git reset --hard origin/master
  git clean -fd
EOF

echo "=> Syncing compiled frontend to App Node..."
rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no -i $APP_SSH_KEY" frontend/dist/ ubuntu@$APP_INSTANCE:~/uzaspea/frontend/dist/

ssh -o StrictHostKeyChecking=no -i $APP_SSH_KEY ubuntu@$APP_INSTANCE << EOF
  set -e
  cd ~/uzaspea
  
  echo "=> Building backend container..."
  docker compose -f docker-compose.app.yml build backend
  
  echo "=> Building frontend container (fast copy of synced dist)..."
  docker compose -f docker-compose.app.yml build frontend
  
  echo "=> Restarting App Node containers (Traefik, Backend, Frontend)..."
  docker compose -f docker-compose.app.yml up -d --remove-orphans
  
  echo "=> Cleaning up old Docker images..."
  docker image prune -f

  echo -e "\n=> Deployment successfully completed on server."
EOF

echo -e "\nDeployment process finished locally!"
