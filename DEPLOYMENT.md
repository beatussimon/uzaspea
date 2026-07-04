# UZASPEA Deployment Guide

This document outlines the streamlined deployment process for the Uzaspea marketplace.

## Quick Start

To deploy your latest local changes to the production server, simply run:
```bash
./deploy.sh
```

## How It Works

The `deploy.sh` script automates the entire CI/CD pipeline in a single step:

1. **Push to GitHub (`push_script.sh`)**:
   - Automatically handles SSH authentication via `askpass.sh`.
   - Force-pushes your local `master` branch and tags to the remote repository.

2. **Connect to Production Server**:
   - Establishes a secure SSH connection to the AWS Lightsail server (`3.6.193.212`).

3. **Automated Backups**:
   - Executes `./scripts/backup.sh` on the server to take a snapshot of the PostgreSQL database before any new code is pulled.

4. **Code Synchronization**:
   - Fetches the latest code from GitHub and performs a hard reset (`git reset --hard origin/master`) to perfectly mirror the repository. This prevents merge conflicts or untracked file issues.

5. **Docker Build & Restart**:
   - Rebuilds the Docker images (`docker compose up -d --build`). This step automatically compiles the React/Vite frontend and reinstalls Python dependencies for the backend.

6. **Database Seeding & Migrations**:
   - Executes `python manage.py seed` to ensure core data (like Site Settings, Inspection Categories, and Checklists) is injected.
   - Note: Django migrations are executed automatically during the container startup sequence.

7. **Cron Job Verification**:
   - Ensures that the nightly database backup cron job is registered in the `ubuntu` user's crontab.

## Script Cleanup

The deployment directory has been cleaned up. The following redundant/obsolete scripts were **removed** to reduce clutter:
- `deploy_production.sh` (Consolidated into `deploy.sh`)
- `remote_deploy.sh` (Consolidated into `deploy.sh`)
- `remote_env_fix.sh` (No longer needed, environment variables are managed directly on the server)
- `run_filter_repo.sh` (One-time Git history rewrite script)
- `add_key.exp` / `push_expect.exp` (Replaced by the robust `askpass.sh` solution)

## Remaining Scripts
- `deploy.sh`: The main deployment orchestrator.
- `push_script.sh`: Handles secure pushing to GitHub (called by `deploy.sh`).
- `askpass.sh`: Provides credentials to SSH non-interactively.
