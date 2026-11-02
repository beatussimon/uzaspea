#!/usr/bin/env bash
set -euo pipefail

cd /home/bea/uzaspea

echo "=== Step 7.1: Stage & Commit All Hardened Code ==="
test -x /home/bea/.ssh/.git_askpass

git add -A

# Ensure no secret files or database dumps are staged for addition/modification
if git diff --cached --name-only --diff-filter=AM | grep -E '(^|/)\.env($|\.)|\.pem$|\.key$|\.sqlite3|\.mmdb$|prod_logs\.txt|askpass\.sh|push_script\.sh|cookies\.txt|^backups/|traefik_acme\.json|get_color\.py'; then
    echo "ERROR: Disallowed secret files detected in staged git index!"
    exit 1
fi

git commit -m "chore(security,perf,geofence): full platform security hardening, performance overhaul, digital vault X-Accel-Redirect, and country geofencing" || echo "Nothing to commit or already committed"
git status -s

echo "=== Step 7.2: Mirror Backup, git filter-repo History Purge & Push ==="
MIRROR_DIR="/tmp/uzaspea_mirror_backup_$(date +%Y%m%d_%H%M%S).git"
git clone --mirror /home/bea/uzaspea "${MIRROR_DIR}"
echo "Mirror backup saved at: ${MIRROR_DIR}"

# Run git filter-repo
python3 -m git_filter_repo \
  --path backend/db.sqlite3 \
  --path backend/db.sqlite3-wal \
  --path backend/db.sqlite3-shm \
  --path prod_logs.txt \
  --path askpass.sh \
  --path add_key.exp \
  --path cookies.txt \
  --path backups/ \
  --invert-paths --force

git remote add origin git@github.com:beatussimon/uzaspea.git 2>/dev/null || \
  git remote set-url origin git@github.com:beatussimon/uzaspea.git

# Verify purged files
test -z "$(git log --all --pretty=format: --name-only | grep -E '^(backend/db\.sqlite3-wal|prod_logs\.txt|askpass\.sh|add_key\.exp)$' || true)"
test -f backend/uzachuo/private_media.py
test -f backend/uzachuo/auth_cookies.py
test -f backend/uzachuo/geofence.py
test -f frontend/src/components/GeofenceGate.tsx
test -x deploy.sh

# Force push to GitHub
(
  eval "$(ssh-agent -s)" >/dev/null
  trap 'ssh-agent -k >/dev/null 2>&1 || true' EXIT
  export SSH_ASKPASS="$HOME/.ssh/.git_askpass"
  export SSH_ASKPASS_REQUIRE=force
  export DISPLAY=:0
  setsid ssh-add "$HOME/.ssh/id_ed25519" </dev/null
  git push origin --force master
  git push origin --force --tags
)

echo "PHASE_7_GATE_OK"
