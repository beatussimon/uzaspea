# SokoniMax Deployment Guide

This document outlines the deployment process for the SokoniMax marketplace.

---

## Quick Start

To deploy your latest local changes to production, run from your local WSL machine:
```bash
./deploy.sh
```

---

## Architecture

Production runs on **two AWS Lightsail instances**:

| Instance | IP | Compose File | Services |
|---|---|---|---|
| **App Node** | 3.6.193.212 | `docker-compose.app.yml` | Traefik, Backend (Uvicorn), Frontend (Nginx) |
| **Data Node** | 13.235.198.184 | `docker-compose.data.yml` | PostgreSQL, Redis, Celery Worker, Celery Beat |

- **Domain**: `pasifiq.store` (HTTPS via Let's Encrypt)
- **Fallback**: `docker-compose.prod.yml` runs all services on a single node

---

## Multi-Node Deploy (`deploy.sh`)

The main `deploy.sh` script orchestrates deployment across both nodes:

### 1. Local Frontend Build
- Runs `npm run build` in `frontend/` locally to avoid OOM on the App Node.

### 2. Push to GitHub (`push_script.sh`)
- Handles SSH authentication via `askpass.sh`.
- Pushes `master` branch and tags to the remote repository.

### 3. Deploy to Data Node (13.235.198.184)
- Connects via SSH with dedicated key (`LightsailDefaultKey-ap-south-1-sokonimax.pem`).
- Fetches latest code and hard resets to `origin/master`.
- Builds the celery-worker container.
- Runs `docker compose -f docker-compose.data.yml up -d --remove-orphans`.
- Configures `iptables DOCKER-USER` firewall chain to restrict Postgres (5432) and Redis (6379) to App Node IP only.
- Prunes old Docker images.

### 4. Deploy to App Node (3.6.193.212)
- Fetches latest code and hard resets to `origin/master`.
- **Rsync** compiled `frontend/dist/` to App Node (avoids rebuilding on server).
- Builds backend + frontend containers.
- Runs `docker compose -f docker-compose.app.yml up -d --remove-orphans`.
- Prunes old Docker images.

---

## Single-Node Deploy (`scripts/ship.sh`)

For the single-node fallback setup (all services on one instance):

```bash
scripts/ship.sh
```

1. **Local Verification**: Python syntax check + Django check + TypeScript compile.
2. **Push to GitHub**: Auto-commit + push via SSH agent.
3. **Server Deploy**: SSH → backup → pull → `docker compose -f docker-compose.prod.yml up -d --build`.
4. **Health Check**: `curl http://localhost/api/site-settings/`.

---

## Automated Operations

### Database Backups (`scripts/backup.sh`)
- **Cron**: `0 2 * * *` (daily at 2:00 AM)
- Runs `pg_dump` on the `uzaspea-postgres` container.
- Compresses to `db_<timestamp>.sql.gz`.
- Retains only the last 7 days.
- Cron entry: `0 2 * * * /home/ubuntu/uzaspea/scripts/backup.sh >> /var/log/uzaspea-backup.log 2>&1`

### Auto-Heal Watchdog (`scripts/auto_heal.sh`)
- **Cron**: `*/5 * * * *` (every 5 minutes)
- Detects exited/crashed containers → restarts via `docker compose up -d`.
- Monitors RAM (warns >95%) and swap (warns >1024MB).
- Cleans Docker cache if disk >90%.
- Self-rotates its log at >5MB.
- Cron entry: `*/5 * * * * /home/ubuntu/uzaspea/scripts/auto_heal.sh >> /home/ubuntu/uzaspea/logs/auto_heal.log 2>&1`

### Bandwidth Monitor (`scripts/bandwidth.sh`)
- **Cron**: `0 */6 * * *` (every 6 hours)
- Tracks daily transfer rate; warns if projected monthly exceeds 80% of 3TB budget.
- Cron entry: `0 */6 * * * /home/ubuntu/uzaspea/scripts/bandwidth.sh >> /home/ubuntu/uzaspea/logs/bandwidth.log 2>&1`

---

## Server Health Check

```bash
# Interactive health dashboard (RAM, swap, disk, containers, OOM kills):
ssh ubuntu@3.6.193.212 "bash ~/uzaspea/scripts/monitor.sh"
```

---

## Scripts Inventory

| Script | Purpose | Location |
|---|---|---|
| `deploy.sh` | Multi-node deploy orchestrator | Repo root |
| `push_script.sh` | Push to GitHub with SSH auth | Repo root |
| `askpass.sh` | SSH credential helper | Repo root |
| `scripts/ship.sh` | Single-node verify + push + deploy | scripts/ |
| `scripts/backup.sh` | Database backup + 7-day retention | scripts/ |
| `scripts/auto_heal.sh` | Crash recovery watchdog | scripts/ |
| `scripts/monitor.sh` | Server health dashboard | scripts/ |
| `scripts/bandwidth.sh` | Transfer usage monitoring | scripts/ |
| `scripts/push_to_github.sh` | WSL-compatible git push | scripts/ |

> ⚠️ **DANGEROUS SCRIPTS** — `scripts/remote_restart.sh` and `scripts/remote_fix_env.sh` run `docker compose down -v` which **destroys the database**. NEVER run them on production.

---

## Container Startup Sequence

The backend container automatically runs on startup:
1. `python manage.py migrate --noinput` — applies pending migrations
2. `python manage.py collectstatic --noinput` — collects static files
3. `uvicorn uzachuo.asgi:application` — starts ASGI server

Django migrations run automatically. Database seeding (`python manage.py seed`) should be run manually after a fresh database setup.
