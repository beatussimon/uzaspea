# Uzaspea Core Mandates & AI Agent Skill

This document defines the foundational architecture, safety protocols, and coding standards for the Uzaspea project. All AI agents **MUST** internalize these mandates before modifying any files.

---

## 0. Project Overview & Structure

Uzaspea is a **Django + React e-commerce marketplace for Tanzania** where sellers list products, buyers purchase, staff manage the platform, and an inspection sub-system allows vehicle/property pre-purchase verification.

```
uzaspea/
├── backend/                 # Django 5.1 + DRF + Django Channels (Daphne) + Celery
│   ├── marketplace/         # Products, orders, reviews, messages, payments, notifications
│   ├── staff/               # Dispute resolution, support tickets, user management
│   ├── inspections/         # Inspection booking, assignment, checklists, reports
│   ├── uzachuo/             # Core settings, WSGI, ASGI, routing, middleware
│   ├── manage.py            # Django management command entrypoint
│   ├── requirements.txt     # Python dependencies
│   └── start_server.sh      # Local Django development server startup script
├── frontend/                # React 18 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/             # API clients, interceptors, endpoints
│   │   ├── components/      # Common UI components
│   │   ├── context/         # Shared state management contexts
│   │   ├── hooks/           # Reusable React hooks
│   │   ├── pages/           # Page components
│   │   │   ├── dashboard/   # Seller/Buyer dashboards
│   │   │   ├── inspections/ # Inspection views/layouts
│   │   │   └── staff/       # Staff administration tools
│   │   ├── types/           # TypeScript interfaces & types
│   │   ├── App.tsx          # Main React entry, routing structure
│   │   ├── index.css        # Core stylesheet (True Black dark mode theme)
│   │   └── main.tsx         # Vite bootstrapper
│   ├── package.json         # Node frontend dependencies
│   └── vite.config.ts       # Vite build config
├── persistent_data/         # Live database (Postgres), Redis, media, static files
└── scripts/                 # Deploy & utility scripts (backup, deploy, remote actions)
```

### Tech Stack
| Layer | Technology |
|---|---|
| Web Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Django 5.1, Django REST Framework, Django Channels |
| ASGI Server | Uvicorn (with `websockets` implementation) |
| Database | SQLite (local dev) / PostgreSQL (production via `dj_database_url`) |
| Caching & Real-time | Redis (cache and Channels transport) |
| Task Queue | Celery + Redis |
| Reverse Proxy | Traefik v2.11 (Production) |
| Host Environment | AWS Lightsail (1GB RAM, 2GB Swap) |
| Production URL | `http://3.6.193.212/` (HTTP raw IP - no domain yet) |

---

## 1. System Integrity & Data Safety (CRITICAL)

> [!CAUTION]
> **A previous AI agent executed `sudo rm -rf persistent_data/postgres` on the production server. It permanently destroyed the entire production database. There was no backup. All user data was lost.** Adherence to the following laws is mandatory.

- **LAW 1 — NEVER destroy data to fix a problem.** `rm -rf`, `docker compose down -v`, `DROP TABLE`, or `DELETE FROM` without a `WHERE` clause are permanently destructive. If you think data deletion/reset is the right fix, STOP and request explicit written approval from the owner.
- **LAW 2 — `docker compose down -v` IS `rm -rf persistent_data/postgres`.** The `-v` flag destroys named Docker volumes. The postgres volume is the database. ALWAYS use `docker compose down` (without `-v`). Use `docker compose restart <service>` to restart individual containers.
- **LAW 3 — Never run destructive commands remotely.** If operating via SSH on the server `3.6.193.212` and a fix requires deleting files or wiping volumes, STOP and request written authorization.
- **LAW 4 — Always backup before any migration or schema change.**
  ```bash
  ls -lh /home/ubuntu/uzaspea/backups/   # verify recent backup exists
  /home/ubuntu/uzaspea/scripts/backup.sh  # run backup script if stale/missing
  ```
- **LAW 5 — Never touch `persistent_data/` or its contents.** It holds the live database, Redis state, media, and static files. They cannot be recovered from git.
- **LAW 6 — LETHAL SCRIPTS.** `scripts/remote_restart.sh` and `scripts/remote_fix_env.sh` run `docker compose down -v` and wipe the database. DO NOT run them on the production server without active confirm-gates.
- **LAW 7 — Deploy is manual.** Do not automate the deployment pipeline without explicit instruction.
- **LAW 8 — Read before touching.** Read every file thoroughly and understand its context before editing.
- **LAW 9 — Pre-Commit Checklist.** Before committing any changes, run these syntax and safety checks:
  ```bash
  python3 -c "import ast; ast.parse(open('backend/marketplace/api_views.py').read()); print('OK')"
  python3 -c "import ast; ast.parse(open('backend/inspections/serializers.py').read()); print('OK')"
  grep -rn "<<<<<<\\|=======\\|>>>>>>>" backend/ frontend/src/ | wc -l  # must be 0
  cd backend && python manage.py check  # must say "no issues"
  ```
- **LAW 10 — Never commit secrets, databases, or virtual environments.** Ensure `.env`, `*.pem`, `traefik_acme.json`, `*.sqlite3`, `.venv/`, `persistent_data/`, and `*.log` are ignored.
- **LAW 11 — Always verify `.env` after settings modifications.** If modifying `settings.py` to use environment variables for `ALLOWED_HOSTS`, `CORS`, or `CSRF`, verify they are present in the server's `.env` to prevent `400 Bad Request` or `401 Unauthorized` errors.
- **LAW 12 — Environment Reloading.** Container environments only reload when recreated via `docker compose up -d`. A simple `docker compose restart` does NOT reload `.env` modifications.
- **LAW 13 — CSRF Bypass on Public Views.** DRF `APIView` views that are completely public (e.g., user registration) must define `authentication_classes = []` to prevent CSRF verification failures from stale session cookies.

---

## 2. Architectural Pillars

### A. Marketplace & Orders
- **Multi-Vendor E-commerce**: Scoped interactions for buyers, sellers, and administrators.
- **Product Lifecycle**: Listing, inventory controls, categorized browsing, reviews, and messaging.
- **Payment & Escrow Flow**: Safe handling of transaction flows and purchase locks.

### B. Inspection Sub-system
- **Inspection Lifecycle**: Booking → Assignment → Checklists → Reports.
- **Roles**: Client (buyer requesting verification), Seller (owner of the item), and Inspector (assigned agent).
- **Contact Handling**: Inspectors must get seller/client phone + email depending on job type (marketplace vs. external). Clients must see inspector contact details after assignment.

### C. WebSockets & Messaging
- Real-time communications are routed via Django Channels using Daphne and Redis.
- Channels chat consumer (`backend/marketplace/consumers.py`) manages live chats and system notifications.

### D. Design System & Theme
- **True Black Dark Mode**: The site uses a "car nerdy" theme. Dark mode must remain True Black (`#000000`) and NOT bluish slate.
- **Brand Colors**: Engine Light Amber (`#f59e0b`).
- **Neutral Grays**: Map all grays to neutral colors to eliminate blue/slate tints.

### E. Background Tasks
- Celery worker and Celery beat manage asynchronous queues.
- Scheduled audits, automated notifications, and cleanups occur via task definitions.

---

## 3. Coding Standards

### Frontend (React 18 + TS + Vite + Tailwind CSS)
- **Strict Typing**: Avoid `any` types. Provide interface definitions in `frontend/src/types/` for all entities.
- **Layout & Structure**: Respect layouts (`DashboardLayout`, `InspectionLayout`, `StaffDashboardLayout`).
- **Asset/Style Consistency**: Follow the True Black and Amber (`#f59e0b`) styling rules.

### Backend (Django 5.1 + DRF)
- **Queryset Scoping**: Scope database queries to appropriate owners/users in view sets.
- **Safe Database Changes**: Use additive migrations. Do not run destructive database commands in management seeds.

---

## 4. Auth & Token Lifecycle
- Uses JWT-based authentication.
- Public actions (login/signup) must bypass CSRF checks.

---

## 5. API Endpoint Map (Key additions)

| Endpoint | ViewSet / View | Purpose |
|---|---|---|
| `/api/token/` | SimpleJWT TokenObtainPairView | User authentication / Token generation |
| `/api/marketplace/...` | Product, Order, Message ViewSets | E-commerce operations |
| `/api/inspections/...` | InspectionRequest & Assignment ViewSets | Pre-purchase verification flows |
| `/api/staff/...` | Staff admin dashboards | dispute and user management |

---

## 6. Frontend Route Map

| Route | Component / Layout | Auth Required |
|---|---|---|
| `/` | `TrendingPage` / Discover | No |
| `/login` | `LoginPage` | No |
| `/register` | `RegisterPage` | No |
| `/cart` | `CartPage` | Yes |
| `/checkout` | `CheckoutPage` | Yes |
| `/orders` | `OrdersPage` | Yes |
| `/profile` | `ProfilePage` | Yes |
| `/dashboard` | `DashboardLayout` | Yes |
| `/inspections` | `InspectionLayout` / `InspectorLayout` | Yes |
| `/staff` | `StaffDashboardLayout` / `StaffAdminLayout` | Yes (Staff/Admin) |

---

## 7. Production Environment (AWS Lightsail http://3.6.193.212/)

The production system runs on a **1GB AWS Lightsail instance** running Ubuntu. Due to strict memory constraints, all services are configured to fit within hard resource limits.

### Docker Container Structure & Memory Budget
The stack is orchestrated using `docker-compose.prod.yml`:
1. **`traefik` (Traefik v2.11)**: Edge reverse proxy. Limits access-logging. Runs on port 80. Routes paths starting with `/api`, `/admin`, `/static`, and `/ws` to the backend. Memory limit: **80MB**.
2. **`backend` (Django ASGI)**: Serves HTTP/WebSockets via Uvicorn. Auto-runs migrations and static file collection on launch. Memory limit: **400MB**.
3. **`celery-worker`**: Executes Celery tasks asynchronously with concurrency limited to 1. Memory limit: **150MB**.
4. **`celery-beat`**: Triggers scheduled cron events. Memory limit: **60MB**.
5. **`frontend` (Nginx serving SPA)**: Serves static React code built with `VITE_API_BASE_URL` pointed to `http://3.6.193.212`. Map SPA routes back to `index.html`. Memory limit: **48MB**.
6. **`db` (Postgres 15-alpine)**: Database. Configured with optimized memory settings (`shared_buffers=64MB`, `work_mem=2MB`, `maintenance_work_mem=32MB`, `effective_cache_size=256MB`). Memory limit: **256MB**.
7. **`redis` (Redis 7-alpine)**: Cache & Channels transport broker. Disables disk persistence for speed/memory (`--save ""`). Memory limit: **64MB**.
- **Total Memory Budget: 1058MB**

---

## 8. Deployment, Auto-Heal & Backups

### Deployment Workflow (`scripts/deploy.sh`)
An automated deployment cron job runs every 5 minutes on the server:
- Runs `git fetch origin master`.
- Compares local commit SHA against origin master.
- If updates exist, pulls master code, builds docker containers using `docker-compose.prod.yml`, and spins up.
- Executes health checks by polling `http://localhost/api/site-settings/` for up to 2 minutes. If healthy, prunes old docker image layers.
- Cron Entry: `*/5 * * * * /home/ubuntu/uzaspea/scripts/deploy.sh >> /var/log/uzaspea-deploy.log 2>&1`

### Database Backups (`scripts/backup.sh`)
- Executed via cron daily at 2:00 AM.
- Invokes `pg_dump` on the `uzaspea-postgres` container.
- Compresses backups to `db_<timestamp>.sql.gz`.
- Retains only the last 7 days of backups (`find ... -mtime +7 -delete`).
- Cron Entry: `0 2 * * * /home/ubuntu/uzaspea/scripts/backup.sh >> /var/log/uzaspea-backup.log 2>&1`

### Auto-Heal Watchdog (`scripts/auto_heal.sh`)
- Executed via cron every 5 minutes.
- Detects exited/crashed containers and restarts them using `docker compose up -d`.
- Monitors RAM usage, raising warnings if RAM exceeds 95% or swap usage exceeds 1024MB.
- Cleans Docker and image caches if disk space usage exceeds 90%.
- Cron Entry: `*/5 * * * * /home/ubuntu/uzaspea/scripts/auto_heal.sh >> /home/ubuntu/uzaspea/logs/auto_heal.log 2>&1`

---

## 9. Production Environment Variables (.env)

The following configurations must be set in the production environment:
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

## 10. Known Issues & Ongoing Backlog

Please refer to the detailed backlog of unresolved items in the repository checklist:
- **CRIT-01**: Purge private keys, ACME key, and db.sqlite3 from Git history using `git filter-repo`.
- **CRIT-02**: Implement confirmation prompts and backup attempts in dangerous scripts (`remote_restart.sh` and `remote_fix_env.sh`).
- **CRIT-03**: Fix hardcoded admin password in `seed_data.py`.
- **HIGH-01**: Extend serializers (`InspectionAssignmentSerializer`, `InspectionRequestListSerializer`) and `assign()` notifications with contact info (seller/client names, phones, emails).
- **HIGH-02**: Remove default server IP from `settings.py`.
- **HIGH-03**: Set up automatic backup cron jobs on the server.
- **HIGH-04**: Adjust CORS setting (`CORS_ALLOW_ALL_ORIGINS`) to be environment-driven.
- **MED-03**: Lower `celery-beat` memory footprint to 60MB.
- **MED-05**: Update remote scripts to use `docker-compose.prod.yml` instead of the development compose file.
- **LOW-01**: Remove `--pull` flag from `deploy.sh`.
- **LOW-02**: Base message identification on sender ID in `MessagesPage.tsx`.
