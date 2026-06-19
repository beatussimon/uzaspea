#!/bin/bash

# Update .env on server
ssh -o StrictHostKeyChecking=no -i ~/.ssh/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.193.212 << EOF
cd ~/uzaspea
cat << 'ENVEOF' > .env
DJANGO_SECRET_KEY=\${DJANGO_SECRET_KEY}
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=3.6.193.212,localhost,127.0.0.1

CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=http://3.6.193.212,http://localhost,http://127.0.0.1
CSRF_TRUSTED_ORIGINS=http://3.6.193.212,http://localhost

DATABASE_URL=\${DATABASE_URL}
DB_NAME=uzaspea
DB_USER=postgres
DB_PASSWORD=\${DB_PASSWORD}

REDIS_URL=\${REDIS_URL}
VITE_API_BASE_URL=http://3.6.193.212
DJANGO_EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
ENVEOF

cp .env backend/.env

echo "Recreating containers to pick up new env..."
docker compose -f docker-compose.prod.yml up -d --force-recreate backend celery-worker celery-beat
EOF
