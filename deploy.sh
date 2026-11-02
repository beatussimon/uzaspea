#!/usr/bin/env bash
set -euo pipefail

APP_INSTANCE="3.6.193.212"
APP_PRIVATE_IP="172.26.36.142"
DATA_INSTANCE="13.235.198.184"
DATA_PRIVATE_IP="172.26.1.218"
APP_SSH_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1.pem"
DATA_SSH_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"

echo "Building frontend locally to avoid App Node OOM..."
cd frontend
npm run build
cd ..

echo "Pushing latest committed code to GitHub (non-force)..."
(
  eval "$(ssh-agent -s)" >/dev/null
  trap 'ssh-agent -k >/dev/null 2>&1 || true' EXIT
  if [ -x "$HOME/.ssh/.git_askpass" ]; then
    export SSH_ASKPASS="$HOME/.ssh/.git_askpass"
    export SSH_ASKPASS_REQUIRE=force
    export DISPLAY=:0
    setsid ssh-add "$HOME/.ssh/id_ed25519" </dev/null
  fi
  git push origin master
)

echo "=========================================="
echo " Deploying to Data Node ($DATA_INSTANCE)  "
echo "=========================================="
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$DATA_SSH_KEY" "ubuntu@$DATA_INSTANCE" << EOF
  set -euo pipefail
  cd ~/uzaspea
  sudo mkdir -p ~/uzaspea/persistent_data/celerybeat ~/uzaspea/persistent_data/media ~/uzaspea/persistent_data/private_media ~/uzaspea/persistent_data/vault_storage
  sudo chown -R 10001:10001 ~/uzaspea/persistent_data/celerybeat ~/uzaspea/persistent_data/media ~/uzaspea/persistent_data/private_media ~/uzaspea/persistent_data/vault_storage

  echo "=> Pre-deploy PostgreSQL backup..."
  /home/ubuntu/uzaspea/scripts/backup.sh || true

  echo "=> Fetching latest code and resetting to origin/master..."
  git fetch origin master
  git reset --hard origin/master
  git clean -fd
  chmod 700 ~/uzaspea/scripts/backup.sh

  echo "=> Building & restarting Data Node containers..."
  docker compose -f docker-compose.data.yml build celery-worker
  docker compose -f docker-compose.data.yml up -d --remove-orphans

  echo "=> Locking IPv4 + IPv6 DOCKER-USER firewall to Private VPC ($APP_PRIVATE_IP)..."
  sudo iptables -N DOCKER-USER 2>/dev/null || true
  sudo iptables -F DOCKER-USER
  sudo iptables -A DOCKER-USER -i lo -j RETURN
  sudo iptables -A DOCKER-USER -p tcp --dport 22 -j RETURN
  sudo iptables -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  sudo iptables -A DOCKER-USER -s 172.16.0.0/12 -j RETURN
  sudo iptables -A DOCKER-USER -s 127.0.0.1/32 -j RETURN
  sudo iptables -A DOCKER-USER -p tcp -m multiport --dports 5432,6379 -s ${APP_PRIVATE_IP}/32 -j RETURN
  sudo iptables -A DOCKER-USER -p tcp -m multiport --dports 5432,6379 -j DROP
  sudo iptables -A DOCKER-USER -j RETURN

  sudo ip6tables -N DOCKER-USER 2>/dev/null || true
  sudo ip6tables -F DOCKER-USER
  sudo ip6tables -A DOCKER-USER -i lo -j RETURN
  sudo ip6tables -A DOCKER-USER -p tcp --dport 22 -j RETURN
  sudo ip6tables -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  sudo ip6tables -A DOCKER-USER -p tcp -m multiport --dports 5432,6379 -j DROP
  sudo ip6tables -A DOCKER-USER -j RETURN

  if command -v netfilter-persistent >/dev/null 2>&1; then
    sudo netfilter-persistent save
  fi
  docker image prune -f
EOF

echo "=========================================="
echo " Deploying to App Node ($APP_INSTANCE)    "
echo "=========================================="
ssh -o StrictHostKeyChecking=no -i "$APP_SSH_KEY" "ubuntu@$APP_INSTANCE" << 'EOF'
  set -euo pipefail
  cd ~/uzaspea
  sudo mkdir -p ~/uzaspea/persistent_data/media ~/uzaspea/persistent_data/private_media ~/uzaspea/persistent_data/vault_storage ~/uzaspea/persistent_data/vault_storage/_watermarked ~/uzaspea/persistent_data/geoip ~/uzaspea/persistent_data/static
  sudo chown -R 10001:10001 ~/uzaspea/persistent_data/media ~/uzaspea/persistent_data/private_media ~/uzaspea/persistent_data/vault_storage ~/uzaspea/persistent_data/geoip ~/uzaspea/persistent_data/static
  git fetch origin master
  git reset --hard origin/master
  git clean -fd
EOF

echo "=> Syncing compiled frontend to App Node..."
rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no -i $APP_SSH_KEY" frontend/dist/ "ubuntu@$APP_INSTANCE:~/uzaspea/frontend/dist/"

ssh -o StrictHostKeyChecking=no -i "$APP_SSH_KEY" "ubuntu@$APP_INSTANCE" << 'EOF'
  set -euo pipefail
  cd ~/uzaspea
  chmod 600 ~/uzaspea/traefik_acme.json ~/uzaspea/.env ~/uzaspea/backend/.env 2>/dev/null || true
  docker compose -f docker-compose.app.yml build backend
  docker compose -f docker-compose.app.yml build frontend
  docker compose -f docker-compose.app.yml up -d --remove-orphans
  docker image prune -f
  echo "=> Deployment successfully completed on App Node."
EOF

echo "Deployment process finished!"
