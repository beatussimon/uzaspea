#!/bin/bash
cd /home/bea/uzaspea/backend
source venv/bin/activate
fuser -k 8000/tcp
nohup python manage.py runserver 0.0.0.0:8000 > server.log 2>&1 &
