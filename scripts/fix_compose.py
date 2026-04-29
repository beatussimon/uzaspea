import re, sys
COMPOSE = '/home/bea/uzaspea/docker-compose.yml'
with open(COMPOSE) as f:
    content = f.read()
original = content
if 'stop_grace_period' not in content:
    content = content.replace(
        '    container_name: uzaspea-backend\n    volumes:',
        '    container_name: uzaspea-backend\n    stop_grace_period: 30s        # FIX HIGH-01\n    restart: unless-stopped       # FIX HIGH-01\n    volumes:'
    )
if '--timeout-graceful-shutdown' not in content:
    content = content.replace(
        '--workers 1 --ws websockets" ,
