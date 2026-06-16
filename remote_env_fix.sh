#!/bin/bash

# Update .env on server
ssh -o StrictHostKeyChecking=no -i ~/.ssh/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.193.212 << 'EOF'
cd ~/uzaspea
cat << 'ENVEOF' > .env
DJANGO_SECRET_KEY=V6LbeeuXWhdng2dIzFlwZxTH7WCMo6wAZInmyNBwguHCDZKkErne1si8X0K8vJXl
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=3.6.193.212,localhost,127.0.0.1

CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=http://3.6.193.212,http://localhost,http://127.0.0.1
CSRF_TRUSTED_ORIGINS=http://3.6.193.212,http://localhost

DATABASE_URL=postgres://postgres:local_password@db:5432/uzaspea
DB_NAME=uzaspea
DB_USER=postgres
DB_PASSWORD=local_password

REDIS_URL=redis://redis:6379/0
VITE_API_BASE_URL=http://3.6.193.212
DJANGO_EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
ENVEOF

cp .env backend/.env

echo "Restarting backend container..."
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart celery-worker
docker compose -f docker-compose.prod.yml restart celery-beat
EOF
