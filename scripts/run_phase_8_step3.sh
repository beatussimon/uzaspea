#!/usr/bin/env bash
set -euo pipefail
APP_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1.pem"
DATA_KEY="$HOME/.ssh/LightsailDefaultKey-ap-south-1-sokonimax.pem"

NEW_DB_PASS="$(openssl rand -hex 32)"
NEW_REDIS_PASS="$(openssl rand -hex 32)"
NEW_SECRET_KEY="$(openssl rand -hex 32)"

ssh -n -o StrictHostKeyChecking=no -i "$DATA_KEY" ubuntu@13.235.198.184 \
  "docker exec uzaspea-postgres psql -U postgres -c \"ALTER USER postgres WITH PASSWORD '${NEW_DB_PASS}';\" >/dev/null"

update_remote_envs() {
  local ssh_key="$1"
  local host="$2"
  local db_host="$3"
  local redis_host="$4"

  ssh -o StrictHostKeyChecking=no -i "$ssh_key" "ubuntu@$host" python3 - \
    "$NEW_DB_PASS" "$NEW_REDIS_PASS" "$NEW_SECRET_KEY" "$db_host" "$redis_host" << 'PYEOF'
import os, sys

db_pass, redis_pass, secret_key, db_host, redis_host = sys.argv[1:6]
updates = {
    "DB_PASSWORD": db_pass,
    "REDIS_PASSWORD": redis_pass,
    "DJANGO_SECRET_KEY": secret_key,
    "DATA_BIND_IP": "172.26.1.218",
    "DATABASE_URL": f"postgres://postgres:{db_pass}@{db_host}:5432/uzaspea?sslmode=require",
    "REDIS_URL": f"redis://:{redis_pass}@{redis_host}:6379/0",
    "FORCE_HTTPS": "True",
    "SESSION_COOKIE_SECURE": "True",
    "CSRF_COOKIE_SECURE": "True",
    "FRONTEND_URL": "https://pasifiq.store",
}

for path in ("/home/ubuntu/uzaspea/.env", "/home/ubuntu/uzaspea/backend/.env"):
    lines = []
    seen = set()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for raw in f:
                stripped = raw.strip()
                if stripped and not stripped.startswith("#") and "=" in stripped:
                    k = stripped.split("=", 1)[0].strip()
                    if k in updates:
                        lines.append(f"{k}={updates[k]}\n")
                        seen.add(k)
                        continue
                lines.append(raw if raw.endswith("\n") else raw + "\n")
    for k, v in updates.items():
        if k not in seen:
            lines.append(f"{k}={v}\n")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.writelines(lines)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)
PYEOF
}

update_remote_envs "$DATA_KEY" "13.235.198.184" "db" "redis"
update_remote_envs "$APP_KEY" "3.6.193.212" "172.26.1.218" "172.26.1.218"

echo "STEP_8_3_SECRET_ROTATION_OK"
