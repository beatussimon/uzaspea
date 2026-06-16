#!/bin/bash
ssh-agent -s > /tmp/agent.env
source /tmp/agent.env

# SSH into the server and run commands
ssh -o StrictHostKeyChecking=no ubuntu@3.6.193.212 << 'EOF'
set -e

cd ~/uzaspea
echo "Running backup..."
./scripts/backup.sh

echo "Pulling latest code..."
git pull origin master

echo "Deploying via Docker Compose..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "Waiting for services to stabilize..."
sleep 15
curl -s http://localhost/api/site-settings/

echo "Seeding the database..."
docker compose -f docker-compose.prod.yml exec -T backend sh -c "SEED_ADMIN_PASSWORD=YourSecurePassword python manage.py seed"

echo "Setting up backup cron..."
sudo touch /var/log/uzaspea-backup.log
sudo chown ubuntu:ubuntu /var/log/uzaspea-backup.log
(crontab -l 2>/dev/null | grep -v "/home/ubuntu/uzaspea/scripts/backup.sh"; echo "0 2 * * * /home/ubuntu/uzaspea/scripts/backup.sh >> /var/log/uzaspea-backup.log 2>&1") | crontab -

echo "Deployment complete."
EOF
