# UZASPEA-SKILL.md
# Permanent Agent Safety Gate · Audit v10 · All Fix Instructions
# Place at repo root. Every agent reads this COMPLETELY before acting.
# Last updated: May 2026 · Commit 0b185160

---

## ══════════════════════════════════════════════════════
## PART 0 — AGENT SAFETY GATE (NO EXCEPTIONS)
## ══════════════════════════════════════════════════════

**A previous AI agent executed `sudo rm -rf persistent_data/postgres` on the
production server to "fix" a database crash loop. It permanently destroyed the
entire production database. There was no backup. All user data was lost.**

This file exists so that never happens again.
Read every law below before writing a single line of code or running any command.

---

### THE LAWS

**LAW 1 — NEVER destroy data to fix a problem.**
`rm -rf`, `docker compose down -v`, `DROP TABLE`, `DELETE FROM` without WHERE,
wiping a volume, resetting a database — all permanently destructive with no undo.
If you think destruction is the right fix: STOP. Tell the owner what you found
and wait for explicit written approval. You do not have that authority.

**LAW 2 — `docker compose down -v` IS `rm -rf persistent_data/postgres`.**
The `-v` flag destroys named Docker volumes. The postgres volume IS the database.
ALWAYS use `docker compose down` (no `-v`).
Use `docker compose restart <service>` to bounce a single service.

**LAW 3 — Never run destructive commands remotely without owner confirmation.**
If operating via SSH and a fix requires deleting files or wiping volumes,
STOP. Tell the owner exactly what you plan and why. Wait for written "yes, do it."

**LAW 4 — Always backup before any migration or schema change.**
```bash
ls -lh /home/ubuntu/uzaspea/backups/   # verify recent backup exists
/home/ubuntu/uzaspea/scripts/backup.sh  # run if stale or missing
```

**LAW 5 — Never touch `persistent_data/` or its contents.**
Holds the live database, redis state, media, and static files.
Not in git. Cannot be recovered from git. Its absence = permanent data loss.

**LAW 6 — `scripts/remote_restart.sh` and `scripts/remote_fix_env.sh` are
LETHAL on a live server.** Both run `docker compose down -v` and
`sudo rm -rf persistent_data/postgres/*`. Do NOT run them on production.

**LAW 7 — The deploy workflow is intentionally manual. Do not automate it.**
Local dev → push to GitHub → owner reviews → owner pulls on server → owner restarts.
Do not add cron jobs, webhooks, or auto-restart without explicit owner instruction.

**LAW 8 — Read every file before touching it.** `cat` it, understand it, then act.

**LAW 9 — Verify before every commit.**
```bash
python3 -c "import ast; ast.parse(open('backend/marketplace/api_views.py').read()); print('OK')"
python3 -c "import ast; ast.parse(open('backend/inspections/serializers.py').read()); print('OK')"
grep -rn "<<<<<<\|=======\|>>>>>>>" backend/ frontend/src/ | wc -l  # must be 0
cd backend && python manage.py check  # must say "no issues"
```

**LAW 10 — Never commit secrets, databases, or virtual environments.**
Blocked by gitignore: `.env`, `*.pem`, `traefik_acme.json`, `*.sqlite3`,
`.venv/`, `persistent_data/`, `*.log`, `backend/media/`, `backend/staticfiles/`.

---

## ══════════════════════════════════════════════════════
## PART 1 — PROJECT OVERVIEW
## ══════════════════════════════════════════════════════

**UZASPEA** — Django + React e-commerce marketplace for Tanzania.
Sellers list products, buyers purchase, staff manage the platform.
Inspection sub-system for vehicle/property pre-purchase verification.

```
Stack:
  Backend:   Django 5.1 + DRF + Django Channels (WebSocket) + Celery + PostgreSQL
  Frontend:  React 18 + TypeScript + Vite + Tailwind CSS
  Infra:     Docker Compose + Traefik + AWS Lightsail 1GB RAM
  Transport: HTTP only, raw IP 3.6.193.212 — no domain yet

Django Apps:
  marketplace/    Products, orders, reviews, messages, payments, notifications
  staff/          Dispute resolution, support tickets, user management
  inspections/    Inspection booking, assignment, checklists, reports

Key files:
  backend/uzachuo/settings.py                           Django settings (env-driven)
  backend/marketplace/api_views.py                      Main API (~1200 lines)
  backend/marketplace/consumers.py                      WebSocket chat consumer
  backend/inspections/api_views.py                      Inspection workflow
  backend/inspections/serializers.py                    Inspection serializers
  backend/inspections/management/commands/seed_inspections.py
  backend/marketplace/management/commands/seed.py       Full platform seed (new)
  docker-compose.prod.yml                               Production compose
  scripts/backup.sh                                     pg_dump backup

Deploy workflow (manual, owner-controlled):
  Push to GitHub → owner SSHes in → git pull → docker compose up -d --build
  GitHub Actions runs TESTS ONLY — no deploy from CI.

Memory budget 1GB Lightsail (hard limits — do not exceed):
  traefik 80MB | backend 400MB | celery-worker 150MB | celery-beat 60MB
  frontend 48MB | postgres 256MB | redis 64MB | TOTAL 1058MB
```

---

## ══════════════════════════════════════════════════════
## PART 2 — RATING: 85/100
## ══════════════════════════════════════════════════════

Good overall. Solid architecture. Most prior bugs fixed.
Held back by history not purged, missing contact info on assignment,
dangerous scripts without safety gates, and wiped seed data.

---

## ══════════════════════════════════════════════════════
## PART 3 — OPEN ISSUES
## ══════════════════════════════════════════════════════

### 🔴 CRITICAL

**CRIT-01 · Git history still contains private TLS key + ACME key + old database**
`git filter-repo` never ran. Keys recoverable from old commits.
`.git` folder is 71MB — should be <5MB.
Fix: See Part 6 Step 11.

**CRIT-02 · `remote_restart.sh` and `remote_fix_env.sh` will wipe the database**
Both run `docker compose down -v` + `rm -rf persistent_data/postgres/*` with
no warning and no backup. They already wiped production once.
Fix: Add DESTROY confirmation + backup attempt at top of both scripts (Part 6 Step 10).

**CRIT-03 · `seed_data.py` creates admin with hardcoded password `admin123`**
Fix: See Part 6 Step 1.

### 🟠 HIGH

**HIGH-01 · Inspector gets no contact info when assigned a job**
- Marketplace inspection (inside job): inspector needs SELLER phone + email
- External inspection: inspector needs CLIENT phone + email
- Client needs inspector phone + name after assignment
- Notification messages contain no contact details at all
Fix: See Part 6 Steps 3–4 (serializer + notify patch).

**HIGH-02 · `settings.py` has hardcoded server IP `3.6.193.212` as default**
Fix: See Part 6 Step 5.

**HIGH-03 · No backup cron — backup.sh only runs manually**
Fix: See Part 6 Step 9.

**HIGH-04 · `CORS_ALLOW_ALL_ORIGINS = DEBUG` — CORS open when debug is True**
Fix: See Part 6 Step 6.

### 🟡 MEDIUM

**MED-01 · Inspection categories + checklists wiped with database — need reseed**
Fix: See Part 6 Step 2 (seed management command).

**MED-02 · `seed_data.py` in repo root — wrong location, no duplicate protection**
Fix: Replace with management command `backend/marketplace/management/commands/seed.py`.

**MED-03 · celery-beat memory limit is 150MB — should be 60MB**
Fix: `docker-compose.prod.yml` → celery-beat → limits → memory: 60M.

**MED-04 · Inspector job queue (`my_jobs`) shows no contact info**
Fix: Resolved by serializer patch in HIGH-01 (Part 6 Step 3).

**MED-05 · `remote_build.sh` and `remote_launch.sh` use dev compose file**
Fix: Add `-f docker-compose.prod.yml` to all docker compose calls in both scripts.

### 🟢 LOW

**LOW-01 · `deploy.sh` uses `--pull` — downloads base images every deploy**
Fix: Remove `--pull` from the `docker compose build` line in `scripts/deploy.sh`.

**LOW-02 · `MessagesPage.tsx` identifies messages by username string**
Fix: Use sender ID integer comparison instead of username string.

**LOW-03 · Audit markdown files still in repo root**
Fix: `git rm --cached UZASPEA_SCORCHED_EARTH_v*.md` + add to `.gitignore`.

---

## ══════════════════════════════════════════════════════
## PART 4 — PRODUCTION .ENV (HTTP + RAW IP)
## ══════════════════════════════════════════════════════

```env
DJANGO_SECRET_KEY=<python3 -c "import secrets; print(secrets.token_hex(50))">
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=3.6.193.212,localhost,127.0.0.1

CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=http://3.6.193.212
CSRF_TRUSTED_ORIGINS=http://3.6.193.212,http://localhost

DATABASE_URL=postgres://postgres:YOURPASSWORD@db:5432/uzaspea
DB_NAME=uzaspea
DB_USER=postgres
DB_PASSWORD=YOURPASSWORD

REDIS_URL=redis://redis:6379/0
VITE_API_BASE_URL=http://3.6.193.212
DJANGO_EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

---

## ══════════════════════════════════════════════════════
## PART 5 — SAFE COMMANDS
## ══════════════════════════════════════════════════════

```bash
# Standard deploy:
ssh ubuntu@3.6.193.212
cd ~/uzaspea
./scripts/backup.sh                                          # ALWAYS first
git pull origin master && git log --oneline -3
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
sleep 15 && curl -s http://localhost/api/site-settings/

# Safe restart (no data loss):
docker compose -f docker-compose.prod.yml restart backend
# OR:
docker compose -f docker-compose.prod.yml down              # NO -v !!
docker compose -f docker-compose.prod.yml up -d

# Run seed after wipe:
docker compose -f docker-compose.prod.yml exec backend \
    python manage.py seed

# NEVER:
# docker compose down -v          ← destroys database
# rm -rf persistent_data/         ← destroys everything
```

---

## ══════════════════════════════════════════════════════
## PART 6 — COMPLETE FIX INSTRUCTIONS (DO IN ORDER)
## ══════════════════════════════════════════════════════

### Step 1 — Fix CRIT-03: admin123 password in seed_data.py

Replace in `seed_data.py`:
```python
# FROM:
admin_user = User.objects.create_superuser('admin', 'admin@uzaspea.com', 'admin123')

# TO:
import secrets as _secrets
_pw = os.environ.get('SEED_ADMIN_PASSWORD') or _secrets.token_urlsafe(16)
admin_user = User.objects.create_superuser('admin', 'admin@uzaspea.com', _pw)
if not os.environ.get('SEED_ADMIN_PASSWORD'):
    print(f'\n⚠  Admin password: {_pw}\n   Save this — it will not be shown again.\n')
```

---

### Step 2 — Re-seed the database (MED-01)

The file `seed.py` (provided as a separate output) is the new management command.
Copy it to `backend/marketplace/management/commands/seed.py`, then:

```bash
# On the server:
docker compose -f docker-compose.prod.yml exec backend \
    sh -c "SEED_ADMIN_PASSWORD=YourSecurePassword python manage.py seed"
```

What gets seeded:
- Admin superuser (safe password, printed once)
- 50+ marketplace categories (hierarchical)
- Site settings (name, currency TZS, support contact)
- All inspection domains and categories:
  Vehicles (Cars 45-item, Motorcycles 28-item, Trucks 35-item)
  Electronics (Smartphones 28-item, Laptops 22-item, TVs 22-item, Cameras 20-item)
  Property (Residential 43-item, Commercial 30-item, Land 19-item)
  Machinery (Generators 18-item, Construction 22-item)
  Agriculture (Farm Machinery 25-item, Livestock 20-item)

---

### Step 3 — Fix HIGH-01 Part A: InspectionAssignmentSerializer

In `backend/inspections/serializers.py`, replace `InspectionAssignmentSerializer`:

```python
class InspectionAssignmentSerializer(serializers.ModelSerializer):
    inspector_name = serializers.CharField(
        source='inspector.user.get_full_name', read_only=True
    )
    inspector_username = serializers.CharField(
        source='inspector.user.username', read_only=True
    )
    inspector_level = serializers.CharField(source='inspector.level', read_only=True)
    inspector_phone = serializers.CharField(source='inspector.phone_number', read_only=True)
    inspector_email = serializers.CharField(source='inspector.user.email', read_only=True)
    job_contact = serializers.SerializerMethodField()

    class Meta:
        model = InspectionAssignment
        fields = [
            'id', 'request', 'inspector', 'inspector_name', 'inspector_username',
            'inspector_level', 'inspector_phone', 'inspector_email',
            'assigned_by', 'is_manual_override', 'override_reason',
            'sla_deadline', 'assigned_at', 'is_active', 'job_contact',
        ]

    def get_job_contact(self, obj):
        """
        Marketplace inspection (inside job): contact = product SELLER (item owner).
        External inspection: contact = CLIENT who requested the inspection.
        """
        req = obj.request
        try:
            if req.marketplace_product_id:
                seller = req.marketplace_product.seller
                profile = getattr(seller, 'profile', None)
                return {
                    'type': 'seller',
                    'label': 'Item Owner (Seller)',
                    'name': seller.get_full_name() or seller.username,
                    'username': seller.username,
                    'phone': profile.phone_number if profile else '',
                    'email': seller.email,
                    'location': profile.location if profile else '',
                    'item_address': req.item_address,
                }
            else:
                client = req.client
                profile = getattr(client, 'profile', None)
                return {
                    'type': 'client',
                    'label': 'Inspection Client',
                    'name': client.get_full_name() or client.username,
                    'username': client.username,
                    'phone': profile.phone_number if profile else '',
                    'email': client.email,
                    'location': profile.location if profile else '',
                    'item_address': req.item_address,
                }
        except Exception:
            return None
```

---

### Step 4 — Fix HIGH-01 Part B: InspectionRequestListSerializer

Replace `InspectionRequestListSerializer` in `backend/inspections/serializers.py`:

```python
class InspectionRequestListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views and inspector job queue."""
    category_path = serializers.CharField(source='category.get_full_path', read_only=True)
    client_username = serializers.CharField(source='client.username', read_only=True)
    has_report = serializers.SerializerMethodField()
    job_contact = serializers.SerializerMethodField()
    sla_deadline = serializers.SerializerMethodField()

    class Meta:
        model = InspectionRequest
        fields = [
            'id', 'inspection_id', 'client_username', 'item_name',
            'category_path', 'scope', 'turnaround', 'status',
            'created_at', 'has_report', 'job_contact', 'sla_deadline',
        ]

    def get_has_report(self, obj):
        return hasattr(obj, 'report') and obj.report is not None

    def get_sla_deadline(self, obj):
        active = obj.active_assignment
        return active.sla_deadline if active else None

    def get_job_contact(self, obj):
        try:
            if obj.marketplace_product_id:
                seller = obj.marketplace_product.seller
                profile = getattr(seller, 'profile', None)
                return {
                    'type': 'seller',
                    'label': 'Item Owner (Seller)',
                    'name': seller.get_full_name() or seller.username,
                    'phone': profile.phone_number if profile else '',
                    'email': seller.email,
                    'location': profile.location if profile else '',
                    'item_address': obj.item_address,
                }
            else:
                client = obj.client
                profile = getattr(client, 'profile', None)
                return {
                    'type': 'client',
                    'label': 'Inspection Client',
                    'name': client.get_full_name() or client.username,
                    'phone': profile.phone_number if profile else '',
                    'email': client.email,
                    'location': profile.location if profile else '',
                    'item_address': obj.item_address,
                }
        except Exception:
            return None
```

---

### Step 5 — Fix HIGH-01 Part C: Update assign() notification messages

In `backend/inspections/api_views.py`, inside `InspectionRequestViewSet.assign()`,
replace the two `notify()` calls with:

```python
        # Build contact info for notification messages
        client_profile = getattr(obj.client, 'profile', None)
        inspector_phone = inspector.phone_number or 'N/A'
        inspector_name = inspector.user.get_full_name() or inspector.user.username

        # Marketplace job → inspector contacts the SELLER (item owner), not buyer
        if obj.marketplace_product_id:
            seller = obj.marketplace_product.seller
            seller_profile = getattr(seller, 'profile', None)
            contact_name = seller.get_full_name() or seller.username
            contact_phone = (seller_profile.phone_number if seller_profile else '') or 'N/A'
            contact_email = seller.email or 'N/A'
            contact_label = 'Item Owner (Seller)'
        else:
            contact_name = obj.client.get_full_name() or obj.client.username
            contact_phone = (client_profile.phone_number if client_profile else '') or 'N/A'
            contact_email = obj.client.email or 'N/A'
            contact_label = 'Client'

        notify(
            inspector.user, 'assigned',
            f'New job: {obj.inspection_id} — "{obj.item_name}". '
            f'{contact_label}: {contact_name} | '
            f'Phone: {contact_phone} | Email: {contact_email} | '
            f'Address: {obj.item_address} | '
            f'SLA deadline: {deadline.strftime("%Y-%m-%d %H:%M")}',
            obj
        )
        notify(
            obj.client, 'assigned',
            f'Inspector {inspector_name} assigned to {obj.inspection_id}. '
            f'Inspector phone: {inspector_phone} | '
            f'Email: {inspector.user.email or "N/A"}',
            obj
        )
```

---

### Step 6 — Fix HIGH-02: Remove hardcoded IP from settings.py

In `backend/uzachuo/settings.py`:
```python
# FROM:
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS',
    'localhost,127.0.0.1,3.6.193.212').split(',')
CSRF_TRUSTED_ORIGINS = os.environ.get('CSRF_TRUSTED_ORIGINS',
    'http://localhost:8000,http://127.0.0.1:8000,http://localhost,http://3.6.193.212').split(',')

# TO:
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
CSRF_TRUSTED_ORIGINS = os.environ.get('CSRF_TRUSTED_ORIGINS', 'http://localhost:8000').split(',')
```
Add to server `backend/.env`:
```env
DJANGO_ALLOWED_HOSTS=3.6.193.212,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://3.6.193.212,http://localhost
```

---

### Step 7 — Fix HIGH-04: CORS env var

In `backend/uzachuo/settings.py`:
```python
# FROM:
CORS_ALLOW_ALL_ORIGINS = DEBUG

# TO:
CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'False') == 'True'
```
Add to server `backend/.env`:
```env
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=http://3.6.193.212
```

---

### Step 8 — Fix MED-03: celery-beat memory limit

In `docker-compose.prod.yml`:
```yaml
celery-beat:
  deploy:
    resources:
      limits:
        memory: 60M    # was 150M — beat schedules only, does not execute tasks
```

---

### Step 9 — Fix HIGH-03: Add backup cron (on the server)

```bash
crontab -e
# Add line:
0 2 * * * /home/ubuntu/uzaspea/scripts/backup.sh >> /var/log/uzaspea-backup.log 2>&1

sudo touch /var/log/uzaspea-backup.log
sudo chown ubuntu:ubuntu /var/log/uzaspea-backup.log
```

---

### Step 10 — Fix CRIT-02: Safety gate on dangerous scripts

Add to the TOP of both `scripts/remote_restart.sh` AND `scripts/remote_fix_env.sh`:

```bash
#!/bin/bash
echo ""
echo "⚠️  WARNING: This script runs 'docker compose down -v' and wipes persistent_data/postgres."
echo "   ALL PRODUCTION DATA WILL BE PERMANENTLY DESTROYED. There is no undo."
echo ""
read -p "Type DESTROY to confirm you understand data will be lost: " confirm
[ "$confirm" = "DESTROY" ] || { echo "Aborted safely."; exit 1; }

echo "Attempting backup before destruction (may fail if db is already down)..."
$(dirname "$0")/backup.sh 2>/dev/null || echo "Backup skipped — db may be unreachable."
echo "Proceeding..."
```

---

### Step 11 — Fix MED-05: remote scripts use dev compose file

In `scripts/remote_build.sh` and `scripts/remote_launch.sh`:
```bash
# Replace: docker compose build
# With:    docker compose -f docker-compose.prod.yml build

# Replace: docker compose up -d
# With:    docker compose -f docker-compose.prod.yml up -d
```

---

### Step 12 — Fix LOW-01: Remove --pull from deploy.sh

In `scripts/deploy.sh`:
```bash
# FROM:
docker compose -f "$COMPOSE_FILE" build --pull

# TO:
docker compose -f "$COMPOSE_FILE" build
```

---

### Step 13 — CRIT-01: Purge history (run last, after all commits pushed)

```bash
pip install git-filter-repo

git filter-repo --path certs/key.pem --invert-paths --force
git filter-repo --path certs/cert.pem --invert-paths --force
git filter-repo --path traefik_acme.json --invert-paths --force
git filter-repo --path backend/db.sqlite3 --invert-paths --force
git filter-repo --path backend/.venv --invert-paths --force
git filter-repo --path backend/server.log --invert-paths --force

git remote add origin https://github.com/beatussimon/uzaspea.git
git push origin --force --all && git push origin --force --tags

# Verify:
git log --all --oneline -- certs/key.pem | wc -l   # must be 0
du -sh .git                                          # must be <5MB
```

---

## ══════════════════════════════════════════════════════
## PART 7 — ENGINEERED AGENT PROMPT v10
## ══════════════════════════════════════════════════════

Paste this as the system prompt for every agent session on this project:

```
You are a senior full-stack engineer on UZASPEA — a Django + React marketplace
for Tanzania. Repo: https://github.com/beatussimon/uzaspea.git

━━━ MANDATORY FIRST STEP ━━━
Read UZASPEA-SKILL.md at the repo root COMPLETELY before writing any code,
running any command, or making any suggestion. This is non-negotiable.
━━━━━━━━━━━━━━━━━━━━━━━━━━━

=== ONE LAW YOU MUST NEVER BREAK ===
NEVER run docker compose down -v. NEVER rm -rf persistent_data/.
A previous agent did this and destroyed the production database permanently.
There was no backup. All data was lost. You will not repeat this mistake.

=== ARCHITECTURE ===
Backend:   Django 5.1 + DRF + Channels + Celery + PostgreSQL
Frontend:  React 18 + TypeScript + Vite + Tailwind CSS
Infra:     Docker Compose + Traefik + AWS Lightsail 1GB RAM
Deploy:    Manual. Owner pushes to GitHub, owner pulls on server, owner restarts.
           No auto-deploy. No cron. No webhooks.

=== CURRENT RATING: 85/100 ===

=== DO NEXT — follow UZASPEA-SKILL.md Part 6 exactly, in order ===
Step 1:  Fix admin123 in seed_data.py
Step 2:  Copy seed.py to management commands, run python manage.py seed on server
Step 3:  Replace InspectionAssignmentSerializer (contact-aware)
Step 4:  Replace InspectionRequestListSerializer (contact-aware + sla_deadline)
Step 5:  Update assign() notify calls with contact details
Step 6:  Remove hardcoded IP from settings.py ALLOWED_HOSTS + CSRF defaults
Step 7:  Change CORS_ALLOW_ALL_ORIGINS = DEBUG → env var
Step 8:  Fix celery-beat memory 150M → 60M
Step 9:  Add backup cron on server
Step 10: Add DESTROY gate to remote_restart.sh and remote_fix_env.sh
Step 11: Fix remote_build.sh and remote_launch.sh compose file flag
Step 12: Remove --pull from deploy.sh
Step 13: Run git filter-repo (do last, after all other commits)

=== PRE-COMMIT CHECKLIST ===
python3 -c "import ast; ast.parse(open('backend/marketplace/api_views.py').read()); print('OK')"
python3 -c "import ast; ast.parse(open('backend/inspections/serializers.py').read()); print('OK')"
grep -rn "<<<<<<\|=======\|>>>>>>>" backend/ frontend/src/ | wc -l   # must be 0
cd backend && python manage.py check                                   # must say no issues
git ls-files | grep -E "\.pem|acme\.json|\.sqlite3|\.venv" | wc -l  # must be 0

=== NEVER ===
docker compose down -v        ← destroys database
rm -rf persistent_data/       ← destroys database and all uploads
scripts/remote_restart.sh     ← runs down -v on production — database gone
scripts/remote_fix_env.sh     ← same — database gone
```

---

*UZASPEA-SKILL.md · v10 · May 2026*
*Commit this file to the repo root. It must always be present.*
*Every agent working on UZASPEA reads this file before doing anything else.*
