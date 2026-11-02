#!/usr/bin/env bash
set -euo pipefail
cd /home/bea/uzaspea
/home/bea/uzaspea/backend/venv/bin/python -c "import ast; ast.parse(open('backend/marketplace/api_views.py').read()); print('AST api_views OK')"
/home/bea/uzaspea/backend/venv/bin/python -c "import ast; ast.parse(open('backend/uzachuo/geofence.py').read()); print('AST geofence OK')"
cd /home/bea/uzaspea/backend
/home/bea/uzaspea/backend/venv/bin/python manage.py makemigrations marketplace
/home/bea/uzaspea/backend/venv/bin/python manage.py migrate
/home/bea/uzaspea/backend/venv/bin/python manage.py check
/home/bea/uzaspea/backend/venv/bin/python manage.py test marketplace.tests_security_audit marketplace.recs.test_recs_v3_1 staff inspections billing warehouses logistics locations -v 1
echo "PHASE_3_GATE_OK"
