#!/bin/bash
set -e

SSH_KEY="~/.ssh/LightsailDefaultKey-ap-south-1.pem"
HOST="ubuntu@3.6.193.212"

echo "Pushing latest code to GitHub..."
./push_script.sh

echo "Connecting to production server..."

ssh -o StrictHostKeyChecking=no -i $SSH_KEY $HOST << 'EOF'
  set -e
  
  echo "=> Entering deployment directory..."
  cd ~/uzaspea
  
  echo "=> Running automated database backup..."
  ./scripts/backup.sh
  
  echo "=> Fetching latest code and resetting to origin/master..."
  git fetch origin master
  git reset --hard origin/master
  git clean -fd
  
  echo "=> Building and restarting Docker containers..."
  docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
  
  echo "=> Waiting 15s for services to stabilize..."
  sleep 15
  curl -s http://localhost/api/site-settings/ || true
  
  echo -e "\n=> Running database migrations..."
  docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate

  echo -e "\n=> Seeding the database with essential data..."
  docker compose -f docker-compose.prod.yml exec -T backend sh -c "SEED_ADMIN_PASSWORD=\${SEED_ADMIN_PASSWORD} python manage.py seed"
  
  echo "=> Setting up automated daily backup cron job..."
  sudo touch /var/log/uzaspea-backup.log
  sudo chown ubuntu:ubuntu /var/log/uzaspea-backup.log
  (crontab -l 2>/dev/null | grep -v "/home/ubuntu/uzaspea/scripts/backup.sh"; echo "0 2 * * * /home/ubuntu/uzaspea/scripts/backup.sh >> /var/log/uzaspea-backup.log 2>&1") | crontab -
  
  echo "=> Deployment successfully completed on server."
EOF

echo -e "\nDeployment process finished locally!"
