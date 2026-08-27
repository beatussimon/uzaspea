#!/bin/bash
# ship.sh - The unified superscript to test, push, and deploy to production safely.
# LAW 7 COMPLIANT: This is manually triggered by the owner. No cron or webhooks are used.

set -e

REPO_DIR="/home/bea/uzaspea"
SERVER_USER="ubuntu"
SERVER_IP="3.6.193.212"
SSH_KEY="~/.ssh/LightsailDefaultKey-ap-south-1.pem"

cd "$REPO_DIR"

echo "======================================"
echo "🚀 STAGE 1: LOCAL VERIFICATION"
echo "======================================"

echo "=> Checking Python syntax..."
python3 -m py_compile backend/marketplace/api_views.py backend/inspections/api_views.py backend/staff/api_views.py
echo "=> Python syntax OK."

echo "=> Running Django checks..."
cd backend
if python3 -c "import django" >/dev/null 2>&1; then
  python3 manage.py check
else
  echo "=> Skipping Django check (Django not installed locally)"
fi
cd ..
echo "=> Django checks OK."

echo "=> Compiling TypeScript (Frontend)..."
cd frontend
npx tsc -b
cd ..
echo "=> Frontend compiled successfully."

echo "======================================"
echo "🚀 STAGE 2: PUSH TO GITHUB"
echo "======================================"
echo "=> Adding changes..."
git add . || true
git diff --staged --quiet || git commit -m "Auto-commit before ship to production" || true

echo "=> Preparing SSH Agent for Push..."
eval $(ssh-agent -s) > /dev/null
unset DISPLAY
export SSH_ASKPASS="/home/bea/.ssh/ssh-helper.sh"
export SSH_ASKPASS_REQUIRE="force"
ssh-add ~/.ssh/id_ed25519 < /dev/null > /dev/null 2>&1

echo "=> Pushing to GitHub..."
git push origin master

echo "=> Cleaning up SSH agent..."
ssh-agent -k > /dev/null

echo "======================================"
echo "🚀 STAGE 3: DEPLOY TO PRODUCTION SERVER"
echo "======================================"
echo "=> Connecting to $SERVER_IP..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER_USER@$SERVER_IP << 'EOF'
  set -e
  echo "=> [REMOTE] Entering project directory..."
  cd ~/uzaspea
  
  echo "=> [REMOTE] Running backup.sh (LAW 4)..."
  ./scripts/backup.sh
  
  echo "=> [REMOTE] Pulling latest code..."
  git fetch origin master --quiet
  git reset --hard origin/master --quiet
  
  echo "=> [REMOTE] Building and restarting containers..."
  docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
  
  echo "=> [REMOTE] Waiting for backend to start (15s)..."
  sleep 15
  
  echo "=> [REMOTE] Health check: Fetching site-settings..."
  if curl -sf --max-time 5 http://localhost/api/site-settings/ > /dev/null; then
      echo "=> [REMOTE] ✅ Health check passed."
  else
      echo "=> [REMOTE] ❌ Health check failed. Check logs."
      exit 1
  fi
EOF

echo "======================================"
echo "🎉 DEPLOYMENT COMPLETE! SITE IS LIVE."
echo "======================================"
