# SokoniMax Core Mandates & AI Agent Skill

This document defines the foundational architecture, safety protocols, and coding standards for SokoniMax. All AI agents **MUST** internalize these mandates before modifying any files.

> **For the complete reference**, see [SOKONIMAX-SKILL.md](SOKONIMAX-SKILL.md).

---

## 0. Project Overview & Structure

SokoniMax is a **Django + React e-commerce marketplace for Tanzania** where sellers list products, buyers purchase, staff manage the platform, and sub-systems handle inspections, warehousing, logistics, and billing.

```
uzaspea/
├── backend/                 # Django 5.1 + DRF + Django Channels + Celery
│   ├── marketplace/         # Products, orders, reviews, messages, payments, notifications, subscriptions
│   ├── staff/               # Dispute resolution, support tickets, user management
│   ├── inspections/         # Inspection booking, assignment, checklists, reports
│   ├── billing/             # Commission ledger, monthly invoices, payment approval
│   ├── warehouses/          # Warehouse hubs, intake, inter-hub transfers, staff assignments
│   ├── logistics/           # Shipments, delivery options, pickup codes, GPS tracking, drivers
│   ├── locations/           # Tanzania regions & districts
│   ├── uzachuo/             # Core settings, WSGI, ASGI, routing, middleware, auth
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
│   │   │   └── staff/       # Staff administration tools (incl. warehouse)
│   │   ├── types/           # TypeScript interfaces & types
│   │   ├── i18n/            # Internationalization (EN + SW)
│   │   ├── App.tsx          # Main React entry, routing structure
│   │   ├── index.css        # Core stylesheet (True Black dark mode theme)
│   │   └── main.tsx         # Vite bootstrapper + service worker registration
│   ├── public/              # Static assets, manifest.json, sw.js, logo
│   ├── package.json         # Node frontend dependencies
│   └── vite.config.ts       # Vite build config
├── persistent_data/         # Live database (Postgres), Redis, media, static files
├── scripts/                 # Deploy, backup, monitoring & utility scripts
├── docker-compose.app.yml   # Multi-node: App server (traefik + backend + frontend)
├── docker-compose.data.yml  # Multi-node: Data server (postgres + redis + celery)
├── docker-compose.prod.yml  # Single-node: All services on one instance
├── docker-compose.yml       # Local development compose
└── deploy.sh                # Multi-node deploy orchestrator
```

### Tech Stack
| Layer | Technology |
|---|---|
| Web Frontend | React 18, Vite, TypeScript, Tailwind CSS, i18next (EN/SW) |
| Backend | Django 5.1, Django REST Framework, Django Channels |
| ASGI Server | Uvicorn (with `websockets` implementation) |
| Database | SQLite (local dev) / PostgreSQL 15 (production via `dj_database_url`) |
| Caching & Real-time | Redis 7 (cache, Channels transport, Celery broker) |
| Task Queue | Celery + Redis |
| Reverse Proxy | Traefik v2.11 (HTTPS via Let's Encrypt) |
| Host Environment | AWS Lightsail — 2-node (App: 3.6.193.212, Data: 13.235.198.184) |
| Production URL | `https://pasifiq.store` |
| PWA | manifest.json + sw.js + VAPID web push |
| SEO | Django Sitemaps + Bot SSR rendering + robots.txt |

---

## 1. System Integrity & Data Safety (CRITICAL)

> [!CAUTION]
> **A previous AI agent executed `sudo rm -rf persistent_data/postgres` on the production server. It permanently destroyed the entire production database. There was no backup. All user data was lost.** Adherence to the following laws is mandatory.

- **LAW 1 — NEVER destroy data to fix a problem.** `rm -rf`, `docker compose down -v`, `DROP TABLE`, or `DELETE FROM` without a `WHERE` clause are permanently destructive. If you think data deletion/reset is the right fix, STOP and request explicit written approval from the owner.
- **LAW 2 — `docker compose down -v` IS `rm -rf persistent_data/postgres`.** The `-v` flag destroys named Docker volumes. The postgres volume is the database. ALWAYS use `docker compose down` (without `-v`). Use `docker compose restart <service>` to restart individual containers.
- **LAW 3 — Never run destructive commands remotely.** If operating via SSH on either server and a fix requires deleting files or wiping volumes, STOP and request written authorization.
- **LAW 4 — Always backup before any migration or schema change.**
  ```bash
  ls -lh /home/ubuntu/uzaspea/backups/   # verify recent backup exists
  /home/ubuntu/uzaspea/scripts/backup.sh  # run backup script if stale/missing
  ```
- **LAW 5 — Never touch `persistent_data/` or its contents.** It holds the live database, Redis state, media, and static files. They cannot be recovered from git.
- **LAW 6 — LETHAL SCRIPTS.** `scripts/remote_restart.sh` and `scripts/remote_fix_env.sh` run `docker compose down -v` and wipe the database. DO NOT run them on the production server.
- **LAW 7 — Deploy is owner-controlled.** Do not automate the deployment pipeline without explicit instruction.
- **LAW 8 — Read before touching.** Read every file thoroughly and understand its context before editing.
- **LAW 9 — Pre-Commit Checklist.** Before committing any changes, run these syntax and safety checks:
  ```bash
  python3 -c "import ast; ast.parse(open('backend/marketplace/api_views.py').read()); print('OK')"
  python3 -c "import ast; ast.parse(open('backend/inspections/serializers.py').read()); print('OK')"
  grep -rn "<<<<<<<\\|=======\\|>>>>>>>" backend/ frontend/src/ | wc -l  # must be 0
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
- **Product Lifecycle**: Listing, inventory controls, hierarchical categories, reviews, and messaging.
- **Payment & Escrow Flow**: Safe handling of transaction flows and purchase locks.
- **Fulfillment Types**: `PLATFORM_DELIVERY`, `DIRECT_DELIVERY`, `WAREHOUSE_PICKUP`, `SELLER_PICKUP`.
- **Subscription Tiers**: Per-tier commission rates and subscription management.

### B. Billing & Commissions (`billing/`)
- **CommissionLedgerEntry**: Per-order, per-seller commission tracking.
- **MonthlyInvoice**: Aggregated monthly billing (commission + subscription fees).
- **CommissionPayment**: Payment submission with receipt screenshots and approval workflow.

### C. Warehouses (`warehouses/`)
- **Warehouse**: Regional hubs with geo-coordinates linked to `locations.Region`.
- **WarehouseIntake**: Package check-in with photos, signatures, condition notes.
- **WarehouseTransfer**: Inter-hub transfers with status tracking.
- **WarehouseStaffAssignment**: Maps staff to warehouses (with manager role).
- **Auto-routing**: On intake, auto-creates shipment + transfer if destination differs.

### D. Logistics (`logistics/`)
- **Shipment**: Line-haul (hub-to-hub) and local delivery (hub-to-customer).
- **DeliveryOption**: Configurable tiers with base + per-km + per-kg pricing.
- **PickupCode**: 6-digit codes for customer self-pickup verification.
- **LocationPing**: GPS tracking for in-transit shipments.
- **Driver**: Fleet profiles with vehicle info and assigned regions.
- **DriverPayment**: Auto-calculated payouts on delivery completion.

### E. Locations (`locations/`)
- **Region** and **District**: Tanzania administrative geography for warehouse routing and delivery.

### F. Inspection Sub-system
- **Inspection Lifecycle**: Booking → Assignment → Check-in → Checklists → Reports.
- **Roles**: Client (buyer), Seller (item owner), Inspector (assigned agent).
- **Contact Handling**: Inspector gets seller/client phone + email. Client gets inspector contact after assignment.
- **Fallback Templates**: Auto-creates default checklist if none defined for category.

### G. WebSockets & Messaging
- Real-time communications via Django Channels + Redis (Uvicorn websockets).
- Chat consumer: `backend/marketplace/consumers.py`.

### H. Design System & Theme
- **True Black Dark Mode**: `#000000` background, NOT bluish slate.
- **Brand Color**: Engine Light Amber (`#f59e0b`).
- **Neutral Grays**: Map all grays to neutral to eliminate blue/slate tints.

### I. SEO & PWA
- Sitemaps (static, category, product, seller) at `/sitemap.xml`.
- Bot SSR rendering via nginx user-agent detection → `SeoRenderView`.
- PWA: manifest.json + sw.js + VAPID web push.

### J. Background Tasks
- Celery worker + beat with Redis broker.
- Tasks: invoice generation, subscription expiry checks, notification dispatch.

---

## 3. Coding Standards

### Frontend (React 18 + TS + Vite + Tailwind CSS)
- **Strict Typing**: Avoid `any` types. Provide interface definitions in `frontend/src/types/` for all entities.
- **Layout & Structure**: Respect layouts (`DashboardLayout`, `InspectionLayout`, `StaffDashboardLayout`, `WarehouseStaffLayout`).
- **Asset/Style Consistency**: Follow the True Black and Amber (`#f59e0b`) styling rules.
- **i18n**: All user-facing strings should use `t()` translation keys.

### Backend (Django 5.1 + DRF)
- **Queryset Scoping**: Scope database queries to appropriate owners/users in view sets.
- **Safe Database Changes**: Use additive migrations. Do not run destructive database commands in management seeds.
- **Commission Logic**: Always use `billing.models.get_seller_commission_rate(seller)` for commission calculations.

---

## 4. Auth & Token Lifecycle
- JWT-based authentication (SimpleJWT: 2h access, 7d refresh, rotating tokens).
- Custom `GracefulJWTAuthentication` class in `uzachuo/authentication.py`.
- Public actions (login/signup) must bypass CSRF checks.

---

## 5. API Endpoint Map

| Endpoint | Purpose |
|---|---|
| `/api/token/` | JWT authentication / token generation |
| `/api/products/`, `/api/orders/`, `/api/messages/` | Marketplace operations |
| `/api/inspections/` | Pre-purchase verification flows |
| `/api/staff/` | Staff admin dashboards, disputes, user management |
| `/api/warehouses/` | Warehouse ops, intakes, transfers |
| `/api/logistics/` | Shipments, drivers, pickup codes, tracking |
| `/api/locations/` | Regions & districts |
| `/api/billing/...` | Commission ledger, invoices, payments |
| `/api/health/` | Health check (db + redis status) |
| `/api/seo/render/` | Bot SSR rendering |
| `/sitemap.xml` | Auto-generated sitemap |
| `/robots.txt` | Dynamic robots.txt |

---

## 6. Frontend Route Map

| Route | Component / Layout | Auth Required |
|---|---|---|
| `/` | `TrendingPage` / Discover | No |
| `/login` | `LoginPage` | No |
| `/register` | `RegisterPage` | No |
| `/products` | `ProductsPage` | No |
| `/product/:id` | `ProductPage` | No |
| `/cart` | `CartPage` | Yes |
| `/checkout` | `CheckoutPage` | Yes |
| `/orders` | `OrdersPage` | Yes |
| `/profile` | `ProfilePage` | Yes |
| `/messages` | `MessagesPage` | Yes |
| `/dashboard` | `DashboardLayout` | Yes |
| `/dashboard/settings` | `SettingsPage` | Yes |
| `/inspections` | `InspectionLayout` / `InspectorLayout` | Yes |
| `/staff` | `StaffDashboardLayout` / `StaffAdminLayout` | Yes (Staff/Admin) |
| `/staff/warehouse` | `WarehouseStaffLayout` | Yes (Warehouse Staff) |
| `/help`, `/terms`, `/privacy` | Static pages | No |

---

## 7. Production Environment (AWS Lightsail - 2-Node Architecture)

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment details.

### Instance 1: App Server (3.6.193.212)
Uses `docker-compose.app.yml`. Services: Traefik (80MB), Backend/Uvicorn (600MB), Frontend/Nginx (80MB).

### Instance 2: Data Node (13.235.198.184)
Uses `docker-compose.data.yml`. Services: Postgres (384MB), Redis (96MB), Celery Worker (200MB), Celery Beat (80MB).

**Firewall**: Data Node ports 5432/6379 restricted to App Node IP via iptables DOCKER-USER chain.

---

## 8. Deployment, Auto-Heal & Backups

### Deployment (`deploy.sh`)
Multi-node deploy from local WSL. Builds frontend locally, pushes to GitHub, deploys to Data Node first, then App Node with rsync'd frontend dist. See [DEPLOYMENT.md](DEPLOYMENT.md).

### Backups (`scripts/backup.sh`)
- Cron: daily at 2:00 AM. `pg_dump` → gzip → 7-day retention.

### Auto-Heal (`scripts/auto_heal.sh`)
- Cron: every 5 minutes. Restarts crashed containers, monitors RAM/disk.

### Bandwidth (`scripts/bandwidth.sh`)
- Cron: every 6 hours. Tracks transfer usage vs 3TB monthly budget.

---

## 9. Production Environment Variables (.env)

```env
DJANGO_SECRET_KEY=<python3 -c "import secrets; print(secrets.token_hex(50))">
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=pasifiq.store,3.6.193.212,localhost,127.0.0.1
DOMAIN=pasifiq.store

CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://pasifiq.store
CSRF_TRUSTED_ORIGINS=https://pasifiq.store,http://localhost
FORCE_HTTPS=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
ACME_EMAIL=admin@sokonimax.com

DATABASE_URL=postgres://postgres:YOURPASSWORD@<db-host>:5432/uzaspea
DB_NAME=uzaspea
DB_USER=postgres
DB_PASSWORD=YOURPASSWORD

REDIS_URL=redis://:YOURPASSWORD@<redis-host>:6379/0
REDIS_PASSWORD=YOURPASSWORD

VITE_API_BASE_URL=https://pasifiq.store
VITE_SITE_URL=https://pasifiq.store
DJANGO_EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend

WEBPUSH_VAPID_PRIVATE_KEY=<base64 P-256 private key>
WEBPUSH_VAPID_PUBLIC_KEY=<base64 P-256 public key>
```

---

## 10. Known Issues & Ongoing Backlog

Please refer to [work.md](work.md) for the current backlog of 11 work items covering:
inspection templates, warehouse logistics UI, subscription commission calculation,
language toggle, push notifications, regional hub intake, driver assignment,
live photo capture, JSONField mutation, profile tier labels, and warehouse/logistics UI streamlining.
