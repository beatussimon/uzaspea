#!/bin/bash
# FIX DEVOPS-13,20: production-safe startup using daphne, no hardcoded paths
set -e
cd "$(dirname "$0")"

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Daphne ASGI server..."
exec daphne -b 0.0.0.0 -p 8000 uzachuo.asgi:application
