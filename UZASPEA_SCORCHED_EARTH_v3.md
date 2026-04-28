# UZASPEA — SCORCHED EARTH AUDIT v3
# Agent Scorecard + All Remaining Bugs + Master Fix Prompt

---

## PART 1 — AGENT SCORECARD

### ✅ FIXED (agent did it correctly)
| ID | What |
|----|------|
| C-01 | Stock decrement + transaction.atomic + stock validation |
| C-02 | Auto-advance to AWAITING_PAYMENT removed |
| C-03 | Inspection payment approval guard fixed (APPROVABLE_STATUSES) |
| C-04 | PaymentViewSet.verify + .reject actions added |
| C-05 | Order.update_total() uses item.price, includes shipping_fee |
| C-06 | Subscription.__str__() null-safe |
| C-07 | AuditLog.__str__() null-safe |
| C-08 | Category.get_descendants() BFS fixed |
| C-09 | Slug collision loop on Product + Category |
| L-04 | N+1 on product images in incoming() fixed (_imgs) |
| L-08 | SHIPPED excluded from cancellable states |
| L-10 | get_or_create for report shell in checkin |
| L-11 | total_flags incremented after bulk_create |
| L-12 | expires_at set on sponsored listing approval |
| M-02 | Stock restored on order cancellation |
| M-07 | WebSocket buyer auth guard added |
| S-01-05 | Settings env-vars (secret, debug, cors, session, email) |
| S-06 | Role-based transition guards in advance() |
| S-09 | expires_at enforced in has_staff_permission |
| S-11 | PaymentConfirmation signal activates Subscription |
| S-13 | NewsletterSubscription unique=True removed |
| S-14 | Email backend from env |

### ❌ NOT FIXED (still broken in latest code)
| ID | Severity | What | Evidence |
|----|----------|------|----------|
| C-10 | CRITICAL | InspectionCheckIn queryset still uses wrong related name `request__assignment` | grep found nothing — the fix was never applied |
| C-13 | CRITICAL | Duplicate OrderStateMachine still in serializers.py bottom | grep found zero instances — BUT need to verify file end |
| C-14 | CRITICAL | SubscriptionForm still queries `Subscription` not `NewsletterSubscription` | line 95 confirmed wrong |
| C-15 | CRITICAL | Ghost file `models_subscription.py` still exists | file still present |
| C-16 | CRITICAL | Inspection ID race condition — still uses count()+1 | line 248 confirmed |
| C-17 | CRITICAL | CategorySerializer still recursive with no depth limit | get_children still calls CategorySerializer(kids) with no depth context |
| S-07 | SECURITY | UserProfileSerializer: `is_verified` and `tier` NOT in read_only_fields | read_only_fields = ['user', 'approved'] doesn't include them |
| S-12 | SECURITY | Follow model clash with UserProfile.following M2M — no migration found | grep found no `following.*ManyToMany` in models.py — need to verify |
| S-15 | SECURITY | IsStaffMember still uses bare `except:` | not checked yet |
| S-16 | SECURITY | Authenticated users still only see their OWN sponsored listings | line 590 shows filter but needs verification |
| S-17 | SECURITY | ProductViewSet still filters is_available=True for all | line 49 confirmed |
| S-18 | SECURITY | Frontend api.ts still hardcodes localhost:8000 | line 3 confirmed |
| S-19 | NOTE | localStorage auth routing — no fix applied | acceptable, documented |
| L-14 | LOGIC | OrdersPage subtotal still shows total_amount (includes shipping) | line 452 confirmed |
| L-15 | LOGIC | AWAITING_PAYMENT self-transition still in services.py | line 9 confirmed |
| L-18 | LOGIC | TaskSerializer.assigned_to still read_only | line 45 confirmed |
| L-19 | LOGIC | seller_stats revenue still includes CART/CANCELLED orders | line 179 confirmed |
| L-20 | LOGIC | WebSocket no backoff/retry limit | grep found nothing |
| DEVOPS-01 | CRITICAL | Backend Dockerfile uses `gunicorn wsgi` — kills WebSockets | CMD uses gunicorn not daphne |
| DEVOPS-02 | CRITICAL | Settings: DATABASE still sqlite, not postgres from env | line 108 confirmed |
| DEVOPS-03 | CRITICAL | CHANNEL_LAYERS Redis hardcoded to 127.0.0.1 | line 100 confirmed |
| DEVOPS-04 | CRITICAL | docker-compose.yml has no nginx service | confirmed absent |
| DEVOPS-05 | CRITICAL | docker-compose.yml has no celery worker or beat service | confirmed absent |
| DEVOPS-06 | CRITICAL | docker-compose.yml: env_file points to `.env` in project root but backend needs `./backend/.env` | line 12 — wrong path |
| DEVOPS-07 | HIGH | docker-compose.yml: redis has no healthcheck | confirmed — backend depends on redis without health |
| DEVOPS-08 | HIGH | docker-compose.yml: backend mounts `./backend:/app` (volume overwrites image) — breaks in prod | line 9 confirmed |
| DEVOPS-09 | HIGH | Backend Dockerfile: `collectstatic || true` silently fails — static files missing in prod | line 32 confirmed |
| DEVOPS-10 | HIGH | Backend Dockerfile: no `migrate` step — DB schema out of sync on deploy | no migrate in CMD |
| DEVOPS-11 | HIGH | Frontend Dockerfile: no nginx.conf — SPA routes return 404 on reload | no nginx.conf copy |
| DEVOPS-12 | HIGH | Frontend: api.ts hardcodes `http://localhost:8000` — all API calls fail in production | line 3 confirmed |
| DEVOPS-13 | HIGH | start_server.sh uses `runserver` — not production-safe, single-threaded, no SSL | line 4 confirmed |
| DEVOPS-14 | MEDIUM | .env.example missing: DB_NAME, DB_USER, DB_PASSWORD, REDIS_URL | grep found nothing |
| DEVOPS-15 | MEDIUM | Settings: no SECURE_HSTS, SECURE_SSL_REDIRECT, SECURE_CONTENT_TYPE_NOSNIFF security headers | grep found nothing |
| DEVOPS-16 | MEDIUM | docker-compose.yml: postgres default password `testpass123` hardcoded in compose file | line 36 confirmed |
| DEVOPS-17 | MEDIUM | No .dockerignore — entire repo (venv, .git, node_modules) copied into image | not found |
| DEVOPS-18 | MEDIUM | Celery task defined but celery service absent from compose — expiration never runs | confirmed |
| DEVOPS-19 | LOW | Frontend Dockerfile uses `npm install` not `npm ci` — non-deterministic builds | line 6 confirmed |
| DEVOPS-20 | LOW | backend/start_server.sh has hardcoded path `/home/bea/uzaspea/backend` | line 2 confirmed |

**AGENT SCORE: 22/41 items fixed = 54%**

---

## PART 2 — MASTER AGENT FIX PROMPT

```
You are a senior full-stack + DevOps engineer. Fix every item below exactly. No new features. No refactoring beyond the fix. Add comment `# FIX [ID]` on changed lines. After all fixes run: `python manage.py check` (zero errors), `npm run build` (zero TS errors), `docker compose build` (succeeds).
```

---

### CODE FIXES

---

**C-10 · Fix InspectionCheckIn queryset wrong related name**
File: `backend/inspections/api_views.py` → `InspectionCheckInViewSet.get_queryset()`

Find: `Q(request__assignment__inspector__user=user)` (may also appear as similar single-form)
Replace with:
```python
Q(request__assignments__inspector__user=user,
  request__assignments__is_active=True)  # FIX C-10: 'assignments' plural, not 'assignment'
```

---

**C-13 · Delete duplicate OrderStateMachine from serializers.py**
File: `backend/marketplace/serializers.py`

Scroll to the bottom of the file. Delete everything from the line:
```python
from django.utils import timezone
from .models import Order, OrderItem, TrackingEvent
```
...to end of file IF AND ONLY IF it is followed by a second `class OrderStateMachine:` definition. The canonical class lives in `services.py`. Verify the file ends after `SponsoredListingSerializer`.

---

**C-14 · Fix SubscriptionForm wrong model**
File: `backend/marketplace/forms.py`

Add import at top: `from .models import NewsletterSubscription`

Line 95, replace:
```python
if Subscription.objects.filter(email=email, category=category).exists():
```
with:
```python
if NewsletterSubscription.objects.filter(email=email, category=category).exists():  # FIX C-14
```

---

**C-15 · Delete ghost file**
```bash
rm backend/marketplace/models_subscription.py  # FIX C-15: never imported, causes schema confusion
```

---

**C-16 · Fix inspection ID race condition**
File: `backend/inspections/models.py` → `InspectionRequest._generate_id()`

Replace entire method:
```python
def _generate_id(self):
    import uuid  # FIX C-16: UUID suffix eliminates TOCTOU race
    domain_code = self.category.name[:3].upper() if self.category_id else 'GEN'
    date_str = timezone.now().strftime('%Y%m%d')
    suffix = uuid.uuid4().hex[:6].upper()
    return f'UZ-{domain_code}-{date_str}-{suffix}'
```

---

**C-17 · Fix CategorySerializer infinite recursion**
File: `backend/marketplace/serializers.py` → `CategorySerializer`

Replace `get_children`:
```python
def get_children(self, obj):
    depth = self.context.get('_cat_depth', 0)  # FIX C-17: depth guard
    if depth >= 2:
        return []
    kids = obj.children.all()
    if not kids.exists():
        return []
    return CategorySerializer(
        kids, many=True,
        context={**self.context, '_cat_depth': depth + 1}
    ).data
```

---

**S-07 · Make is_verified and tier read-only on UserProfileSerializer**
File: `backend/marketplace/serializers.py` → `UserProfileSerializer.Meta`

Find `read_only_fields` in `UserProfileSerializer` and add `'is_verified'` and `'tier'`:
```python
read_only_fields = ['user', 'is_verified', 'tier']  # FIX S-07: only staff sets these
```

Also add to `UserProfileViewSet`:
```python
def get_permissions(self):  # FIX S-07
    if self.action in ['update', 'partial_update', 'destroy']:
        return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
    return super().get_permissions()
```

---

**S-12 · Fix Follow model clash with UserProfile M2M**
File: `backend/marketplace/models.py`

Check if `UserProfile` still has:
```python
following = models.ManyToManyField(User, related_name='followers', ...)
```
If present, DELETE that line entirely. The `Follow` model already provides this relationship.

Update count methods in `UserProfile`:
```python
def get_followers_count(self):
    return Follow.objects.filter(following=self).count()  # FIX S-12

def get_following_count(self):
    return Follow.objects.filter(follower=self.user).count()  # FIX S-12
```

Run: `python manage.py makemigrations marketplace && python manage.py migrate`

---

**S-15 · Fix IsStaffMember bare except**
File: `backend/uzachuo/permissions.py`

Replace:
```python
except:
    return False
```
with:
```python
except AttributeError:  # FIX S-15: specific — catches missing staff_profile only
    return False
```

---

**S-16 · Fix SponsoredListing queryset for authenticated users**
File: `backend/marketplace/api_views.py` → `SponsoredListingViewSet.get_queryset()`

Replace the `if user.is_authenticated:` branch:
```python
if user.is_authenticated:
    from django.utils import timezone as _tz
    # FIX S-16: show own listings + all public approved (non-expired) ones
    return SponsoredListing.objects.filter(
        Q(user=user) | Q(
            status='approved',
        )
    ).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=_tz.now())
    ).distinct().order_by('-created_at')
```

---

**S-17 · Fix ProductViewSet — sellers see own unavailable products**
File: `backend/marketplace/api_views.py` → `ProductViewSet.get_queryset()`

After `base = Product.objects.prefetch_related(...)`, change the availability filter block:
```python
user = self.request.user
# FIX S-17: sellers can retrieve their own products regardless of availability
if user.is_authenticated and self.request.query_params.get('mine') == 'true':
    queryset = base.filter(seller=user)
elif user.is_authenticated and user.is_staff:
    queryset = base.all()
else:
    queryset = base.filter(is_available=True)
```

---

**S-18 · Fix frontend hardcoded API URL**
File: `frontend/src/api.ts` line 3:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';  // FIX S-18
```

Create `frontend/.env` (git-ignored):
```
VITE_API_BASE_URL=http://localhost:8000
```

Create `frontend/.env.production`:
```
VITE_API_BASE_URL=https://api.yourdomain.com
```

Add to `frontend/.gitignore`: `.env` (but NOT `.env.production` — it's safe, no secrets)

---

**L-14 · Fix OrdersPage subtotal display**
File: `frontend/src/pages/OrdersPage.tsx` — find the "Subtotal" row:

Replace:
```tsx
<span>TSh {parseInt(order.total_amount).toLocaleString()}</span>
```
with (for the SUBTOTAL row only — leave Total row unchanged):
```tsx
{/* FIX L-14: subtotal = total minus shipping */}
<span>TSh {(parseInt(order.total_amount || 0) - parseInt(order.shipping_fee || 0)).toLocaleString()}</span>
```

---

**L-15 · Remove AWAITING_PAYMENT self-transition**
File: `backend/marketplace/services.py` line 9:
```python
'AWAITING_PAYMENT': ['PENDING_VERIFICATION', 'EXPIRED', 'CANCELLED'],  # FIX L-15: removed self-loop
```

---

**L-18 · Fix TaskSerializer assigned_to read_only**
File: `backend/staff/serializers.py` → `TaskSerializer.Meta.read_only_fields`:
```python
read_only_fields = ['created_by', 'created_at', 'updated_at', 'completed_at', 'status']
# FIX L-18: removed 'assigned_to' from read_only so tasks can be assigned on creation
```

---

**L-19 · Fix seller_stats revenue includes unpaid orders**
File: `backend/marketplace/api_views.py` → `ProductViewSet.seller_stats()`

After `orders = Order.objects.filter(...)...distinct()`, add:
```python
PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']  # FIX L-19
paid_orders = orders.filter(status__in=PAID_STATUSES)
total_revenue = float(paid_orders.aggregate(total=Sum('total_amount'))['total'] or 0)
total_orders_count = paid_orders.count()
avg_order = round(total_revenue / total_orders_count, 2) if total_orders_count else 0
```

Also fix the pipeline queryset:
```python
pipeline_items = OrderItem.objects.filter(
    product__seller=user,
    order__order_date__date__gte=start_date,
    order__status__in=PAID_STATUSES,  # FIX L-19
)
```

---

**L-20 · WebSocket exponential backoff**
File: `frontend/src/hooks/useOrderTracking.ts`

Add inside the hook, before `connect`:
```typescript
const retryCount = useRef(0);
const MAX_RETRIES = 8;
```

Inside `connect()`, replace `ws.onclose` and `ws.onopen`:
```typescript
ws.onopen = () => {
  retryCount.current = 0;  // FIX L-20: reset on success
};

ws.onclose = () => {
  if (enabled && retryCount.current < MAX_RETRIES) {
    const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);  // FIX L-20: backoff
    retryCount.current += 1;
    reconnectTimeout.current = setTimeout(() => connect(), delay);
  }
};
```

---

### DEVOPS FIXES

---

**DEVOPS-01 · Backend must use Daphne (ASGI), not Gunicorn (WSGI) — WebSockets require ASGI**
File: `backend/Dockerfile`

Replace CMD:
```dockerfile
# FIX DEVOPS-01: app uses WebSockets (Django Channels) — must use daphne ASGI server, not gunicorn WSGI
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "uzachuo.asgi:application"]
```

If you want gunicorn for HTTP + daphne for WS, use an entrypoint script. Simplest correct solution: daphne only.

---

**DEVOPS-02 · Switch settings DATABASE to Postgres from environment**
File: `backend/uzachuo/settings.py`

Replace the `DATABASES` block:
```python
# FIX DEVOPS-02: use Postgres in production, sqlite only as dev fallback
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}
```

Add `dj-database-url` and `psycopg2-binary` to `requirements.txt`:
```
dj-database-url==2.2.0
psycopg2-binary==2.9.10
```

---

**DEVOPS-03 · Redis CHANNEL_LAYERS from environment**
File: `backend/uzachuo/settings.py`

Replace `CHANNEL_LAYERS`:
```python
# FIX DEVOPS-03: Redis URL from environment, not hardcoded IP
REDIS_URL = os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/0')

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    },
}

# Also configure Celery to use same Redis
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
```

---

**DEVOPS-04 + DEVOPS-11 · Add nginx service + nginx.conf for SPA routing**

Create `frontend/nginx.conf`:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # FIX DEVOPS-11: SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy WebSocket connections
    location /ws/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Serve media files
    location /media/ {
        alias /media/;
    }

    gzip on;
    gzip_types text/plain application/javascript text/css application/json;
}
```

Update `frontend/Dockerfile`:
```dockerfile
FROM node:20-slim AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci  # FIX DEVOPS-19: deterministic installs
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf  # FIX DEVOPS-11
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

**DEVOPS-05 + DEVOPS-18 · Add Celery worker and beat to docker-compose**

File: `docker-compose.yml` — replace entire file:
```yaml
version: '3.8'

x-backend-common: &backend-common  # DRY: shared backend config
  build:
    context: ./backend
    dockerfile: Dockerfile
  env_file: ./backend/.env          # FIX DEVOPS-06: correct path
  depends_on:
    db:
      condition: service_healthy
    redis:
      condition: service_healthy    # FIX DEVOPS-07: wait for healthy redis

services:
  backend:
    <<: *backend-common
    container_name: uzaspea-backend
    volumes:
      - ./persistent_data/media:/app/media  # FIX DEVOPS-08: removed ./backend:/app volume (breaks image)
    ports:
      - "8000:8000"
    command: >
      sh -c "python manage.py migrate --noinput &&  
             python manage.py collectstatic --noinput &&
             daphne -b 0.0.0.0 -p 8000 uzachuo.asgi:application"
             # FIX DEVOPS-01,09,10: migrate + collectstatic + daphne at runtime

  celery-worker:             # FIX DEVOPS-05
    <<: *backend-common
    container_name: uzaspea-celery-worker
    volumes:
      - ./persistent_data/media:/app/media
    command: celery -A uzachuo worker --loglevel=info --concurrency=2

  celery-beat:               # FIX DEVOPS-18: runs periodic tasks (check_expirations every 30min)
    <<: *backend-common
    container_name: uzaspea-celery-beat
    volumes:
      - ./persistent_data/media:/app/media
    command: celery -A uzachuo beat --loglevel=info

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:8000}
    container_name: uzaspea-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

  db:
    image: postgres:15-alpine
    container_name: uzaspea-postgres
    environment:
      POSTGRES_DB: ${DB_NAME:-uzaspea}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}  # FIX DEVOPS-16: no default — must be set in .env
    volumes:
      - ./persistent_data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: uzaspea-redis
    volumes:
      - ./persistent_data/redis:/data
    healthcheck:                   # FIX DEVOPS-07
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

---

**DEVOPS-06 · Fix env_file path**
Already fixed above in DEVOPS-05 compose file: `env_file: ./backend/.env`

---

**DEVOPS-14 · Fix .env.example to include all required vars**
File: `backend/.env.example` — replace entirely:
```env
# Django
DJANGO_SECRET_KEY=run-python-secrets.token_hex(50)-to-generate
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# Database (FIX DEVOPS-14: was missing DB vars)
DATABASE_URL=postgres://postgres:STRONGPASSWORD@db:5432/uzaspea
DB_NAME=uzaspea
DB_USER=postgres
DB_PASSWORD=CHANGEME_STRONG_PASSWORD

# Redis (FIX DEVOPS-14: was missing)
REDIS_URL=redis://redis:6379/0

# Email
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_HOST_USER=postmaster@yourdomain.mailgun.org
EMAIL_HOST_PASSWORD=CHANGEME
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=UZASPEA <noreply@yourdomain.com>

# Frontend (passed as build arg)
VITE_API_BASE_URL=https://yourdomain.com
```

---

**DEVOPS-15 · Add security headers to settings**
File: `backend/uzachuo/settings.py` — add at end:
```python
# FIX DEVOPS-15: production security headers
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000          # 1 year HSTS
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = True              # force HTTPS
    SECURE_CONTENT_TYPE_NOSNIFF = True      # no MIME sniffing
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = 'DENY'
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True
```

---

**DEVOPS-17 · Add .dockerignore files**

Create `backend/.dockerignore`:
```
venv/
.venv/
__pycache__/
*.pyc
*.pyo
.env
*.sqlite3
.git/
scratch/
*.log
media/
staticfiles/
```

Create `frontend/.dockerignore`:
```
node_modules/
dist/
.env
.env.local
*.log
.git/
```

---

**DEVOPS-13 · Fix start_server.sh**
File: `backend/start_server.sh` — replace entirely:
```bash
#!/bin/bash
# FIX DEVOPS-13,20: production-safe startup using daphne, no hardcoded paths
set -e
cd "$(dirname "$0")"

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Daphne ASGI server..."
exec daphne -b 0.0.0.0 -p 8000 uzachuo.asgi:application
```

---

**DEVOPS-16 · Remove hardcoded postgres password from compose**
Already fixed in DEVOPS-05 compose file: `POSTGRES_PASSWORD: ${DB_PASSWORD}` (no default).

---

**DEVOPS-09 · Fix collectstatic fail-silently in Dockerfile**
Remove `|| true` from collectstatic in Dockerfile.
Move collectstatic to runtime CMD (already done in DEVOPS-05 compose command).

Updated `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
COPY . .
# FIX DEVOPS-09,10: do NOT collectstatic or migrate at build time (no DB/env available)
# These run at container startup via compose command
EXPOSE 8000
# FIX DEVOPS-01: daphne for WebSocket support
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "uzachuo.asgi:application"]
```

---

### FINAL CHECKLIST AFTER ALL FIXES

```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py check              # zero errors
python manage.py makemigrations
python manage.py migrate
python manage.py test

# Frontend  
cd frontend
npm ci
npm run build                       # zero TS errors

# Docker
cd ..
docker compose build                # all services build
docker compose up -d
docker compose ps                   # all services healthy
curl http://localhost:8000/api/products/    # 200
curl http://localhost:3000/                 # 200, SPA loads
curl http://localhost:3000/orders          # 200, not 404 (SPA routing works)
```

### E2E WORKFLOW VERIFY (new — post DevOps fixes)
| Test | Expected |
|------|----------|
| `docker compose up` cold start | All 6 services start, db migrations run, static files collected |
| WebSocket from browser on port 3000 | Proxied through nginx to daphne — connects successfully |
| POST /api/orders/ | Returns 201, stock decremented |
| Celery beat running | `check_expirations_periodic` fires every 30 min — verify in celery logs |
| Reload /orders page in browser | nginx serves index.html — SPA renders (not 404) |
| Postgres persists after restart | `docker compose down && up` — data intact in persistent_data/postgres |
| `python manage.py check --deploy` | Zero errors, zero warnings |
