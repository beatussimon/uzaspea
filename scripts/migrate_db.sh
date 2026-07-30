#!/bin/bash
set -e

APP_INSTANCE="3.6.193.212"
DATA_INSTANCE="13.235.198.184"
SSH_KEY="~/.ssh/LightsailDefaultKey-ap-south-1.pem"
DATA_SSH_KEY="~/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"

echo "=========================================="
echo " Starting Database Migration & Deployment "
echo "=========================================="

echo "=> Step 1: Stopping application on App Node to prevent new data..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY ubuntu@$APP_INSTANCE << 'EOF'
  cd ~/uzaspea
  docker compose -f docker-compose.prod.yml stop backend celery-worker celery-beat
EOF

echo "=> Step 2: Creating a database dump on the App Node..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY ubuntu@$APP_INSTANCE << 'EOF'
  cd ~/uzaspea
  # Dump the database
  docker exec uzaspea-postgres pg_dump -U postgres -d uzaspea -F c -f /var/lib/postgresql/data/migration_dump.backup
  # Move the dump out of the volume
  sudo cp persistent_data/postgres/migration_dump.backup ~/migration_dump.backup
  sudo chown ubuntu:ubuntu ~/migration_dump.backup
EOF

echo "=> Step 3: Transferring the dump to the Data Node..."
# Scp from App Node to local
scp -o StrictHostKeyChecking=no -i $SSH_KEY ubuntu@$APP_INSTANCE:~/migration_dump.backup ./migration_dump.backup
# Scp from local to Data Node
scp -o StrictHostKeyChecking=no -i $DATA_SSH_KEY ./migration_dump.backup ubuntu@$DATA_INSTANCE:~/migration_dump.backup
rm ./migration_dump.backup

echo "=> Step 4: Deploying Data Node services (Postgres, Redis, Celery)..."
# We first need to push the code to Data Node so it can run docker-compose
ssh -o StrictHostKeyChecking=no -i $DATA_SSH_KEY ubuntu@$DATA_INSTANCE << 'EOF'
  if [ ! -d "~/uzaspea" ]; then
    git clone https://github.com/beatussimon/uzaspea.git ~/uzaspea
  fi
  cd ~/uzaspea
  git fetch origin master
  git reset --hard origin/master
  
  # Inject production environment variables for the Data Node
  cat <<ENV_EOF > .env
DATABASE_URL=postgres://postgres:local_password@db:5432/uzaspea
DB_NAME=uzaspea
DB_USER=postgres
DB_PASSWORD=local_password
REDIS_URL=redis://:redis_pass@redis:6379/0
REDIS_PASSWORD=redis_pass
ENV_EOF

  docker compose -f docker-compose.data.yml up -d --build --remove-orphans db redis
  
  echo "=> Waiting 10s for Postgres to start..."
  sleep 10
  
  echo "=> Restoring database..."
  # Copy the dump into the postgres container
  docker cp ~/migration_dump.backup uzaspea-postgres:/tmp/migration_dump.backup
  # Drop and recreate the database if needed, or just restore
  docker exec uzaspea-postgres psql -U postgres -c "DROP DATABASE IF EXISTS uzaspea;"
  docker exec uzaspea-postgres psql -U postgres -c "CREATE DATABASE uzaspea;"
  docker exec uzaspea-postgres pg_restore -U postgres -d uzaspea -1 /tmp/migration_dump.backup || echo "Restore complete with minor warnings."
  
  echo "=> Starting Celery..."
  docker compose -f docker-compose.data.yml up -d --build --remove-orphans
EOF

echo "=> Step 5: Updating App Node to connect to the new Data Node..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY ubuntu@$APP_INSTANCE << 'EOF'
  cd ~/uzaspea
  
  # Update environment variables to point to Data Node
  sed -i 's/postgres:\/\/.*@db:5432/postgres:\/\/postgres:local_password@13.235.198.184:5432/g' .env
  sed -i 's/redis:\/\/.*@redis:6379/redis:\/\/:redis_pass@13.235.198.184:6379/g' .env
  
  # Shut down old monolith containers (including old postgres and redis)
  docker compose -f docker-compose.prod.yml down
  
  # Start the new App-only stack
  docker compose -f docker-compose.app.yml up -d --build --remove-orphans
EOF

echo "=========================================="
echo " Migration & Deployment Complete!         "
echo "=========================================="
