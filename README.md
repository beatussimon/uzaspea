# SokoniMax

**Tanzania's Trusted Marketplace** — Buy and sell car parts, electronics, vehicles, and goods with verified sellers, secure payments, and fast delivery.

🌐 **Live**: [https://pasifiq.store](https://pasifiq.store)

## Stack

| Layer | Technology |
|---|---|
| Backend | Django 5.1, DRF, Django Channels, Celery, PostgreSQL 15 |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| ASGI | Uvicorn (websockets) |
| i18n | i18next (English + Swahili) |
| Infra | Docker Compose, Traefik v2.11, AWS Lightsail (2-node) |
| TLS | Let's Encrypt (ACME via Traefik) |

## Django Apps

| App | Purpose |
|---|---|
| `marketplace` | Products, orders, reviews, messages, payments, notifications, subscriptions |
| `staff` | Dispute resolution, support tickets, user management |
| `inspections` | Pre-purchase verification: booking, assignment, checklists, reports |
| `billing` | Commission ledger, monthly invoices, payment approval |
| `warehouses` | Warehouse hubs, intake, inter-hub transfers, staff assignments |
| `logistics` | Shipments, delivery options, pickup codes, GPS tracking, drivers |
| `locations` | Tanzania regions & districts |

## Quick Start (Local Dev)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your local settings
python manage.py migrate
python manage.py seed
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

## Deploy

```bash
./deploy.sh   # Multi-node deploy (App + Data nodes)
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

## Documentation

- [SOKONIMAX-SKILL.md](SOKONIMAX-SKILL.md) — **Read this first.** Agent safety rules, architecture, and complete reference.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Deployment workflow and scripts.
- [work.md](work.md) — Current work items backlog.

## Mobile Strategy

Currently deployed as a mobile-optimized PWA (manifest.json + service worker). A dedicated React Native app will be required for native notifications and offline support in phase 2.

## Safety

> ⚠️ **NEVER** run `docker compose down -v` or `rm -rf persistent_data/`. See [SOKONIMAX-SKILL.md](SOKONIMAX-SKILL.md) for the complete safety protocol.
