# SOKONIMAX-SKILL.md
# Permanent Agent Safety Gate · All Instructions
# Place at repo root. Every agent reads this COMPLETELY before acting.
# Last updated: September 2026

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

**LAW 7 — The deploy workflow is owner-controlled. Do not automate it.**
Local dev → `./deploy.sh` (or `scripts/ship.sh`) → owner reviews.
Do not add cron jobs, webhooks, or auto-restart without explicit owner instruction.

**LAW 8 — Read every file before touching it.** `cat` it, understand it, then act.

**LAW 9 — Verify before every commit.**
```bash
python3 -c "import ast; ast.parse(open('backend/marketplace/api_views.py').read()); print('OK')"
python3 -c "import ast; ast.parse(open('backend/inspections/serializers.py').read()); print('OK')"
grep -rn "<<<<<<<\|=======\|>>>>>>>" backend/ frontend/src/ | wc -l  # must be 0
cd backend && python manage.py check  # must say "no issues"
```

**LAW 10 — Never commit secrets, databases, or virtual environments.**
Blocked by gitignore: `.env`, `*.pem`, `traefik_acme.json`, `*.sqlite3`,
`.venv/`, `persistent_data/`, `*.log`, `backend/media/`, `backend/staticfiles/`.

**LAW 11 — Always verify `.env` configuration after modifying `settings.py`.**
If `ALLOWED_HOSTS` or `CORS` origins are moved to environment variables, you MUST ensure they are correctly set in the production `.env` file. Missing variables will result in immediate `400 Bad Request` or `401 Unauthorized` API errors.

**LAW 12 — `docker compose restart` does NOT reload `.env` changes.**
If you modify `.env`, you MUST run `docker compose up -d` (or the appropriate
compose file) to recreate the containers with the new environment variables.

**LAW 13 — CSRF Bypass on Public Views.**
If a DRF `APIView` is entirely public (like `RegisterView`), it must include
`authentication_classes = []` to prevent `SessionAuthentication` from erroneously
triggering CSRF checks if an outdated session cookie exists.

**LAW 14 — True Black Dark Mode & Car Nerd Theming.**
The site uses a "car nerdy" theme. Dark mode must be True Black (`#000000`),
not bluish slate. The `brand` color is Engine Light Amber (`#f59e0b`).
Gray must be mapped to `neutral` to eliminate blue tints.
Do not revert to default tailwind blue/slate colors.

---

## ══════════════════════════════════════════════════════
## PART 1 — PROJECT OVERVIEW
## ══════════════════════════════════════════════════════

**SokoniMax** — Django + React e-commerce marketplace for Tanzania.
Sellers list products, buyers purchase, staff manage the platform.
Includes an inspection sub-system for vehicle/property pre-purchase verification,
a warehouse & logistics network with inter-hub transfers, subscription-based
billing with tiered commissions, and i18n (English + Swahili).

Formerly known as "Uzaspea" — the codebase repo folder and Django project module
are still named `uzaspea` / `uzachuo` but all user-facing branding is **SokoniMax**.

```
Stack:
  Backend:   Django 5.1 + DRF + Django Channels + Celery + PostgreSQL 15
  Frontend:  React 18 + TypeScript + Vite + Tailwind CSS
  Infra:     Docker Compose + Traefik v2.11 + AWS Lightsail (2 instances)
  Transport: HTTPS via Let's Encrypt — domain: pasifiq.store
  ASGI:      Uvicorn (websockets implementation)
  i18n:      i18next (EN + SW) with http-backend + browser language detector
  SEO:       SSR-like bot rendering via SeoRenderView + Django Sitemaps
  PWA:       manifest.json + service worker (sw.js) + VAPID web push

Django Apps (8 total):
  marketplace/    Products, orders, reviews, messages, payments, notifications,
                  subscription tiers, site settings, categories, sitemaps, SEO
  staff/          Dispute resolution, support tickets, user management
  inspections/    Inspection booking, assignment, checklists, reports
  billing/        Commission ledger, monthly invoices, commission payments
  warehouses/     Warehouse management, intake, transfers, staff assignments,
                  route pricing
  logistics/      Shipments, delivery options, pickup codes, location pings,
                  driver management, driver payments
  locations/      Tanzania regions & districts (geographic reference data)
  (uzachuo/)      Core settings, WSGI, ASGI, routing, middleware, auth, pagination

Key files:
  backend/uzachuo/settings.py                           Django settings (env-driven)
  backend/marketplace/api_views.py                      Main API (~4800 lines)
  backend/marketplace/models.py                         Core models (~1750 lines)
  backend/marketplace/serializers.py                    Serializers (~1950 lines)
  backend/marketplace/services.py                       Order state transitions, commission calc
  backend/marketplace/consumers.py                      WebSocket chat consumer
  backend/marketplace/sitemaps.py                       SEO sitemaps
  backend/marketplace/views_seo.py                      Bot SSR renderer
  backend/inspections/api_views.py                      Inspection workflow (~1450 lines)
  backend/inspections/serializers.py                    Inspection serializers
  backend/billing/models.py                             CommissionLedgerEntry, MonthlyInvoice, CommissionPayment
  backend/billing/views.py                              Billing API views
  backend/billing/tasks.py                              Celery tasks for invoice generation
  backend/warehouses/views.py                           Warehouse ops API (~640 lines)
  backend/warehouses/models.py                          Warehouse, Intake, Transfer, StaffAssignment
  backend/logistics/views.py                            Shipment/driver API (~610 lines)
  backend/logistics/models.py                           Shipment, PickupCode, LocationPing, Driver, DriverPayment
  backend/locations/models.py                           Region, District
  docker-compose.prod.yml                               Single-node production compose (all services)
  docker-compose.app.yml                                Multi-node: App server compose (traefik + backend + frontend)
  docker-compose.data.yml                               Multi-node: Data server compose (postgres + redis + celery)
  deploy.sh                                             Multi-node deploy orchestrator
  scripts/ship.sh                                       Single-node deploy (verify + push + deploy)
  scripts/backup.sh                                     pg_dump backup
  scripts/auto_heal.sh                                  Crash recovery watchdog (cron every 5min)
  scripts/monitor.sh                                    Server health dashboard
  scripts/bandwidth.sh                                  Transfer monitoring (cron every 6h)
  frontend/index.html                                   SPA entry (SokoniMax branding, OG tags, PWA manifest)
  frontend/nginx.conf                                   Nginx config with bot detection + SEO proxy
  frontend/tailwind.config.js                           Theme: True Black + Amber

Management commands:
  backend/marketplace/management/commands/seed.py                      Full platform seed
  backend/marketplace/management/commands/seed_categories.py           Category hierarchy
  backend/marketplace/management/commands/seed_reference_catalog.py    Reference catalog data
  backend/marketplace/management/commands/seed_technical_specs_and_brands.py
  backend/marketplace/management/commands/import_vehicles.py           Vehicle CSV import
  backend/marketplace/management/commands/check_expirations.py         Subscription expiry checks
  backend/marketplace/management/commands/merge_conversations.py       Chat conversation merger
  backend/marketplace/management/commands/backfill_product_locations.py Location backfill
  backend/inspections/management/commands/seed_inspections.py          Inspection checklists

URL routing:
  /api/                 → marketplace (products, orders, messages, auth, etc.)
  /api/staff/           → staff admin dashboards
  /api/inspections/     → inspection requests, assignments, reports
  /api/warehouses/      → warehouse ops, intakes, transfers
  /api/logistics/       → shipments, drivers, pickup codes, tracking
  /api/locations/       → regions & districts
  /api/billing/...      → commission ledger, invoices, payments
  /api/health/          → health check endpoint (db + redis)
  /api/seo/render/      → SSR for search engine bots
  /admin/               → Django admin
  /sitemap.xml          → auto-generated sitemap
  /robots.txt           → robots.txt (dynamic)
```

---

## ══════════════════════════════════════════════════════
## PART 2 — PRODUCTION ARCHITECTURE (2-NODE)
## ══════════════════════════════════════════════════════

The production system runs across **two AWS Lightsail instances** to separate
web traffic from database/cache IO.

### Instance 1: App Server (3.6.193.212)
Runs the web-facing components. Uses `docker-compose.app.yml`.

| Service     | Container Name     | Purpose                                     | Memory Limit |
|-------------|-------------------|---------------------------------------------|-------------|
| `traefik`   | uzaspea-traefik    | Edge reverse proxy, HTTPS termination (LE)   | 80 MB       |
| `backend`   | uzaspea-backend    | Django ASGI via Uvicorn (3 workers)          | 600 MB      |
| `frontend`  | uzaspea-frontend   | Nginx serving SPA + media proxy              | 80 MB       |

### Instance 2: Data Node (13.235.198.184)
Runs the database, cache, and background workers. Uses `docker-compose.data.yml`.

| Service         | Container Name          | Purpose                              | Memory Limit |
|-----------------|------------------------|--------------------------------------|-------------|
| `db`            | uzaspea-postgres        | Postgres 15 (shared_buffers=128MB)   | 384 MB      |
| `redis`         | uzaspea-redis           | Cache + Channels + Celery broker     | 96 MB       |
| `celery-worker` | uzaspea-celery-worker   | Async task execution (2 concurrency) | 200 MB      |
| `celery-beat`   | uzaspea-celery-beat     | Scheduled cron tasks                 | 80 MB       |

**Firewall**: Data Node ports 5432 + 6379 restricted via `iptables DOCKER-USER`
chain to only accept connections from App Node IP (3.6.193.212/32).

### Fallback: Single-Node (`docker-compose.prod.yml`)
All 7 services on one instance. Lower memory limits:
backend=400MB, celery-worker=150MB, celery-beat=60MB, postgres=256MB, redis=64MB,
frontend=48MB, traefik=80MB. Backend runs 2 Uvicorn workers.

### Domain & TLS
- Domain: **pasifiq.store** (Traefik Host rules in all compose files)
- TLS: Let's Encrypt ACME (httpchallenge via entrypoint `web`)
- HTTP → HTTPS redirect enabled at Traefik level
- Cloudflare trusted IPs configured for `X-Forwarded-For` headers
- VAPID claims email: `admin@sokonimax.com`

---

## ══════════════════════════════════════════════════════
## PART 3 — DEPLOYMENT & OPERATIONS
## ══════════════════════════════════════════════════════

### Deploy Workflow (Multi-Node — `deploy.sh`)
```bash
./deploy.sh   # Run from local WSL machine
```

1. **Local frontend build** — `npm run build` in `frontend/` to avoid OOM on server
2. **Push to GitHub** — via `push_script.sh` (handles SSH auth via `askpass.sh`)
3. **Deploy to Data Node** (13.235.198.184):
   - `git fetch && git reset --hard origin/master`
   - Build celery-worker container
   - `docker compose -f docker-compose.data.yml up -d --remove-orphans`
   - Configure iptables DOCKER-USER firewall rules
4. **Deploy to App Node** (3.6.193.212):
   - `git fetch && git reset --hard origin/master`
   - `rsync` compiled `frontend/dist/` to App Node
   - Build backend + frontend containers
   - `docker compose -f docker-compose.app.yml up -d --remove-orphans`

### Deploy Workflow (Single-Node — `scripts/ship.sh`)
```bash
scripts/ship.sh   # Verify + push + deploy to single server
```
1. Python syntax check + Django check + TypeScript compile
2. Git commit + push to GitHub
3. SSH to 3.6.193.212 → backup → pull → `docker compose -f docker-compose.prod.yml up -d --build`
4. Health check: `curl http://localhost/api/site-settings/`

### Automated Backups (`scripts/backup.sh`)
- Cron: `0 2 * * *` (daily at 2:00 AM)
- Runs `pg_dump` on `uzaspea-postgres` container
- Compresses to `db_<timestamp>.sql.gz`
- Retains only last 7 days
- Cron entry: `0 2 * * * /home/ubuntu/uzaspea/scripts/backup.sh >> /var/log/uzaspea-backup.log 2>&1`

### Auto-Heal Watchdog (`scripts/auto_heal.sh`)
- Cron: `*/5 * * * *` (every 5 minutes)
- Detects exited/crashed containers → restarts via `docker compose up -d`
- Monitors RAM (warn >95%) and swap (warn >1024MB)
- Cleans Docker cache if disk >90%
- Self-rotates its log at >5MB

### Bandwidth Monitor (`scripts/bandwidth.sh`)
- Cron: `0 */6 * * *` (every 6 hours)
- Tracks daily transfer rate; warns if projected monthly >80% of 3TB budget

### Safe Commands
```bash
# Standard deploy (multi-node):
./deploy.sh

# Standard deploy (single-node):
scripts/ship.sh

# Safe restart (no data loss):
docker compose -f docker-compose.app.yml restart backend     # App Node
docker compose -f docker-compose.data.yml restart celery-worker  # Data Node

# Re-env (must recreate containers):
docker compose -f docker-compose.app.yml up -d   # NOT restart

# Run seed after wipe:
docker compose -f docker-compose.app.yml exec backend python manage.py seed

# Pushing to GitHub (For AI Agents in WSL):
wsl bash scripts/push_to_github.sh

# NEVER:
# docker compose down -v          ← destroys database
# rm -rf persistent_data/         ← destroys everything
# scripts/remote_restart.sh       ← runs down -v on production — database gone
# scripts/remote_fix_env.sh       ← same — database gone
```

---

## ══════════════════════════════════════════════════════
## PART 4 — PRODUCTION .ENV
## ══════════════════════════════════════════════════════

```env
# Django
DJANGO_SECRET_KEY=<python3 -c "import secrets; print(secrets.token_hex(50))">
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=pasifiq.store,3.6.193.212,localhost,127.0.0.1
DOMAIN=pasifiq.store

# CORS & CSRF
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://pasifiq.store
CSRF_TRUSTED_ORIGINS=https://pasifiq.store,http://localhost

# Database (Data Node connects locally; App Node connects remotely)
DATABASE_URL=postgres://postgres:YOURPASSWORD@<db-host>:5432/uzaspea
DB_NAME=uzaspea
DB_USER=postgres
DB_PASSWORD=YOURPASSWORD

# Redis
REDIS_URL=redis://:YOURPASSWORD@<redis-host>:6379/0
REDIS_PASSWORD=YOURPASSWORD

# HTTPS
FORCE_HTTPS=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
ACME_EMAIL=admin@sokonimax.com

# Email
DJANGO_EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=noreply@kiboss.co.tz

# Frontend
VITE_API_BASE_URL=https://pasifiq.store
VITE_SITE_URL=https://pasifiq.store

# Web Push (VAPID)
WEBPUSH_VAPID_PRIVATE_KEY=<base64 P-256 private key>
WEBPUSH_VAPID_PUBLIC_KEY=<base64 P-256 public key>
```

---

## ══════════════════════════════════════════════════════
## PART 5 — ARCHITECTURE DETAILS
## ══════════════════════════════════════════════════════

### A. Marketplace & Orders
- **Multi-Vendor E-commerce**: Scoped interactions for buyers, sellers, and administrators.
- **Product Lifecycle**: Listing, inventory, hierarchical categories, reviews, messaging.
- **Payment & Escrow Flow**: Cart → Checkout → Paid → Warehouse → Delivered.
- **Fulfillment Types**: `PLATFORM_DELIVERY`, `DIRECT_DELIVERY`, `WAREHOUSE_PICKUP`, `SELLER_PICKUP`.
- **Order Status Machine**: Managed by `services.py` — CART → PENDING → PAID → RECEIVED_AT_WAREHOUSE → DISPATCHED → IN_TRANSIT → ARRIVED_AT_REGIONAL_WAREHOUSE → OUT_FOR_DELIVERY → DELIVERED (+ CANCELLED, RETURNED variants).
- **Subscription Tiers**: `SubscriptionTier` model with per-tier commission rates. `Subscription` model tracks active user subscriptions.
- **Commission Calculation**: `billing/models.py::get_seller_commission_rate()` resolves rate from active subscription tier, falling back to `SiteSettings.commission_rate`.

### B. Billing & Commissions (`billing/`)
- **CommissionLedgerEntry**: Per-order commission tracking with entry types (COMMISSION, CANCELLATION_FEE, REVERSAL).
- **MonthlyInvoice**: Aggregated monthly invoices per seller (commission + subscription fees).
- **CommissionPayment**: Payment submissions with receipt screenshots and approval workflow (PENDING → APPROVED/REJECTED).
- **Celery Tasks**: `billing/tasks.py` automates invoice generation.

### C. Warehouses (`warehouses/`)
- **Warehouse**: Regional hubs with geo-coordinates, linked to `locations.Region`.
- **WarehouseIntake**: Package check-in with photos, signatures, condition notes.
- **WarehouseTransfer**: Inter-hub transfers (pending → in_transit → completed).
- **WarehouseStaffAssignment**: Maps staff to warehouses (with manager flag).
- **HistoricalRoutePricing**: Average shipping costs between warehouse pairs.
- **Auto-routing signal**: On intake, auto-creates shipment + transfer if destination differs.

### D. Logistics (`logistics/`)
- **Shipment**: `line_haul` (warehouse-to-warehouse) and `local_delivery` (warehouse-to-customer). Carriers: `driver` (SokoniMax fleet) or `third_party`.
- **DeliveryOption**: Configurable tiers (economy/standard/express/urgent) with base price + per-km + per-kg rates.
- **PickupCode**: 6-digit codes for customer self-pickup verification.
- **LocationPing**: GPS tracking for in-transit shipments.
- **Driver**: Fleet driver profiles (vehicle type, plate, phone, assigned region).
- **DriverPayment**: Automatic payout calculation on delivery (% of shipping fee, min 2000 TZS; flat 15000 TZS for vehicles).
- **Auto-shipment signal**: Creates line-haul shipment when order status → PAID (only for PLATFORM_DELIVERY).

### E. Locations (`locations/`)
- **Region**: Tanzania administrative regions with coordinates.
- **District**: Districts within regions (unique per region).
- Used for warehouse geo-mapping and delivery routing.

### F. Inspection Sub-system
- **Lifecycle**: Booking → Assignment → Check-in → Checklists → Reports.
- **Roles**: Client (buyer), Seller (item owner), Inspector (assigned agent).
- **Contact Handling**: Inspector gets seller/client phone + email. Client gets inspector contact after assignment.
- **Fallback Templates**: Auto-creates default checklist if none defined for category.
- **Live Photo Capture**: Camera-enforced evidence capture during inspection.

### G. WebSockets & Messaging
- Real-time chat via Django Channels + Redis (Uvicorn websockets).
- Consumer: `backend/marketplace/consumers.py`.

### H. SEO & PWA
- **Sitemaps**: StaticView, Category, Product, Seller sitemaps at `/sitemap.xml`.
- **Bot Rendering**: `SeoRenderView` proxies SPA routes for search engine bots (Googlebot, etc.) detected by nginx user-agent check.
- **robots.txt**: Dynamic generation with sitemap reference.
- **PWA**: `manifest.json` + `sw.js` service worker + VAPID web push notifications.
- **Open Graph & Twitter Cards**: Meta tags in `index.html`.

### I. Internationalization
- **i18next** with `i18next-browser-languagedetector` + `i18next-http-backend`.
- Languages: English (`en`) and Swahili (`sw`).
- Language toggle in Navbar and MobileBottomNav.

### J. Design System & Theme
- **True Black Dark Mode**: `#000000` background, NOT bluish slate.
- **Brand Color**: Engine Light Amber (`#f59e0b`).
- **Neutral Grays**: All grays mapped to `neutral` palette.

### K. Background Tasks (Celery)
- Worker + Beat with Redis broker.
- Tasks: invoice generation, subscription expiry checks, notification dispatch.

---

## ══════════════════════════════════════════════════════
## PART 6 — FRONTEND ROUTE MAP
## ══════════════════════════════════════════════════════

| Route | Component / Layout | Auth Required |
|---|---|---|
| `/` | `TrendingPage` / Discover | No |
| `/login` | `LoginPage` | No |
| `/register` | `RegisterPage` | No |
| `/products` | `ProductsPage` (browsing, filtering) | No |
| `/product/:id` | `ProductPage` (detail) | No |
| `/cart` | `CartPage` | Yes |
| `/checkout` | `CheckoutPage` | Yes |
| `/orders` | `OrdersPage` | Yes |
| `/profile` | `ProfilePage` | Yes |
| `/messages` | `MessagesPage` | Yes |
| `/dashboard` | `DashboardLayout` | Yes |
| `/dashboard/settings` | `SettingsPage` | Yes |
| `/inspections` | `InspectionLayout` / `InspectorLayout` | Yes |
| `/staff` | `StaffDashboardLayout` / `StaffAdminLayout` | Yes (Staff) |
| `/staff/warehouse` | `WarehouseStaffLayout` | Yes (Warehouse Staff) |
| `/help` | Help page | No |
| `/terms` | Terms of service | No |
| `/privacy` | Privacy policy | No |

---

## ══════════════════════════════════════════════════════
## PART 7 — OPEN WORK ITEMS
## ══════════════════════════════════════════════════════

These are documented in `work.md` (11 items):

1. **Inspection Checklist Template Alignment** — Auto-create fallback templates when none exists.
2. **Inter-Warehouse Logistics UI** — Add incoming/outgoing transfer panels to WarehouseStaffLayout.
3. **Subscription Tier Commission Calculation** — Use seller's active tier rate instead of flat SiteSettings rate.
4. **Language Toggle Fix** — Robust `i18n.language` parsing; clear active/inactive state in UI.
5. **Push Notifications Panel** — Move `Notification.requestPermission()` to user gesture; service worker + VAPID.
6. **Regional Hub Intake Blocking** — Use `last_mile_sorting` modal instead of `destination_intake` for arrived packages.
7. **Fleet Driver Assignment Optional** — Remove validation error when no driver assigned.
8. **Enforce Live Photo Capture** — Add `capture="environment"` to fallback file input.
9. **JSONField Mutation in Warehouse Views** — Assign fresh dict copy to trigger Django dirty tracking.
10. **Remove Explicit Profile Tier Labels** — Show only checkmark; remove "Store Category" text.
11. **Streamline Warehouse + Logistics UI** — Integrate carrier details into dispatch modal.

---

## ══════════════════════════════════════════════════════
## PART 8 — SCRIPTS INVENTORY
## ══════════════════════════════════════════════════════

| Script | Purpose | Safe? |
|---|---|---|
| `deploy.sh` (root) | Multi-node deploy orchestrator | ✅ Yes |
| `scripts/ship.sh` | Single-node verify+push+deploy | ✅ Yes |
| `push_script.sh` | Push to GitHub with SSH auth | ✅ Yes |
| `askpass.sh` | SSH credential helper | ✅ Yes |
| `scripts/backup.sh` | pg_dump backup + 7-day retention | ✅ Yes |
| `scripts/auto_heal.sh` | Crash recovery + RAM/disk monitoring | ✅ Yes |
| `scripts/monitor.sh` | Interactive server health dashboard | ✅ Yes |
| `scripts/bandwidth.sh` | Transfer usage monitoring | ✅ Yes |
| `scripts/push_to_github.sh` | WSL-compatible git push | ✅ Yes |
| `scripts/deploy.sh` | Server-side deploy helper | ✅ Yes |
| `scripts/migrate_db.sh` | Database migration helper | ⚠️ Review |
| `scripts/fix_db_connection.sh` | DB connection repair | ⚠️ Review |
| `scripts/remote_restart.sh` | **DANGEROUS** — runs `down -v` | 🔴 NEVER on prod |
| `scripts/remote_fix_env.sh` | **DANGEROUS** — runs `down -v` | 🔴 NEVER on prod |
| `scripts/remote_build.sh` | Remote container build | ⚠️ Check compose file |
| `scripts/remote_launch.sh` | Remote container launch | ⚠️ Check compose file |
| `scripts/remote_prep.sh` | Remote server preparation | ⚠️ Review |
| `scripts/remote_setup_docker.sh` | Docker installation | ⚠️ One-time |
| `scripts/remote_setup_swap.sh` | Swap configuration | ⚠️ One-time |
| `scripts/check_local_db.sh` | Local DB connectivity check | ✅ Yes |

---

## ══════════════════════════════════════════════════════
## PART 9 — ENGINEERED AGENT PROMPT
## ══════════════════════════════════════════════════════

Paste this as the system prompt for every agent session on this project:

```
You are a senior full-stack engineer on SokoniMax — a Django + React marketplace
for Tanzania. Repo: https://github.com/beatussimon/uzaspea.git
Production domain: https://pasifiq.store

━━━ MANDATORY FIRST STEP ━━━
Read SOKONIMAX-SKILL.md at the repo root COMPLETELY before writing any code,
running any command, or making any suggestion. This is non-negotiable.
━━━━━━━━━━━━━━━━━━━━━━━━━━━

=== ONE LAW YOU MUST NEVER BREAK ===
NEVER run docker compose down -v. NEVER rm -rf persistent_data/.
A previous agent did this and destroyed the production database permanently.
There was no backup. All data was lost. You will not repeat this mistake.

=== ARCHITECTURE ===
Backend:   Django 5.1 + DRF + Channels + Celery + PostgreSQL 15
           Apps: marketplace, staff, inspections, billing, warehouses, logistics, locations
Frontend:  React 18 + TypeScript + Vite + Tailwind CSS + i18next (EN/SW)
Infra:     2-node Docker Compose + Traefik + HTTPS + Lightsail
           App Node (3.6.193.212): traefik + backend + frontend
           Data Node (13.235.198.184): postgres + redis + celery
Deploy:    ./deploy.sh from local WSL. Builds frontend locally, pushes to GitHub,
           deploys to both nodes. Owner-controlled. No auto-deploy.

=== DO NEXT ===
Check work.md for the current work items backlog.
Keep following the safety rules and do not introduce new issues.

=== PRE-COMMIT CHECKLIST ===
python3 -c "import ast; ast.parse(open('backend/marketplace/api_views.py').read()); print('OK')"
python3 -c "import ast; ast.parse(open('backend/inspections/serializers.py').read()); print('OK')"
grep -rn "<<<<<<<\|=======\|>>>>>>>" backend/ frontend/src/ | wc -l   # must be 0
cd backend && python manage.py check                                   # must say no issues
git ls-files | grep -E "\.pem|acme\.json|\.sqlite3|\.venv" | wc -l  # must be 0

=== NEVER ===
docker compose down -v        ← destroys database
rm -rf persistent_data/       ← destroys database and all uploads
scripts/remote_restart.sh     ← runs down -v on production — database gone
scripts/remote_fix_env.sh     ← same — database gone
```

---

*SOKONIMAX-SKILL.md · September 2026*
*Commit this file to the repo root. It must always be present.*
*Every agent working on SokoniMax reads this file before doing anything else.*
