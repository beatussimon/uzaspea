#!/bin/bash
set -e

SSH_KEY="/home/bea/uzaspea/sensitive/LightsailDefaultKey-ap-south-1.pem"
SERVER="ubuntu@3.6.193.212"
PROJECT_DIR="/home/bea/uzaspea"

echo "=== Uploading project to server ==="

# Sync the project excluding unnecessary files
rsync -avz --progress \
  -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.venv' \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='sensitive' \
  --exclude='persistent_data' \
  --exclude='dist' \
  --exclude='backend/media' \
  --exclude='backend/static_collected' \
  --exclude='backend/staticfiles' \
  --exclude='backend/static' \
  --exclude='backend/db.sqlite3' \
  --exclude='backend/server.log' \
  --exclude='backend/.venv' \
  --exclude='*.Zone.Identifier' \
  --exclude='certs' \
  --exclude='*.md' \
  --exclude='backend/scratch' \
  --exclude='backend/datadump.json' \
  --exclude='.kilocode' \
  "$PROJECT_DIR/" "$SERVER:~/uzaspea/"

echo "=== Upload complete ==="
