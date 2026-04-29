# UZASPEA — SCORCHED EARTH AUDIT v6
# Deployed to Lightsail · Full Analysis · Agent Prompt

---

## PART 1 — RATING: 84/100

### Huge improvement. This is now a real, deployed product.

---

### ✅ WHAT'S WORKING (confirmed in code + datadump)

| Area | Status |
|---|---|
| Uvicorn ASGI — HTTP + WebSocket unified | ✅ |
| Traefik ForwardAuth for dashboard (superuser-gated) | ✅ |
| Jaeger removed from compose | ✅ |
| All new models (Notification, Conversation, Message, SavedSearch, PriceAlert, Dispute, ProductVariant, DeliveryZone, SiteSettings) | ✅ |
| Comprehensive inspection checklists (45 car items, 28 phone items, 55 property items, 22 laptop items, 18 generator items) | ✅ |
| Inspection system actually working end-to-end (real data: UZ-PHO, UZ-SED, UZ-VEH inspections completed) | ✅ |
| GPS check-in/checkout working (lat/lng in checkin records) | ✅ |
| Fraud flags auto-generated (speed_anomaly, no_media) | ✅ |
| Inspection reports with hash verification | ✅ |
| LipaNumber per-seller (real data: 4 numbers for seller bsans) | ✅ |
| Notification bell + system | ✅ |
| MessagesPage exists and functional | ✅ |
| Follow UI in ProfilePage | ✅ |
| SettingsPage + HelpCenterPage wired | ✅ |
| PaymentNumbersManager in dashboard | ✅ |
| All rate limiting applied | ✅ |
| All DevOps from v5 applied | ✅ |
| Celery + beat in single container | ✅ |
| Saved searches + price alerts tasks in Celery | ✅ |
| WhiteNoise compression | ✅ |
| IsOwnerOrStaff class exists and correct | ✅ |
| SiteSettings singleton model | ✅ |
| Seller rating property on UserProfile | ✅ |
| Dispute model + DISPUTED state in services | ✅ |
| ProductVariant model with FK on OrderItem | ✅ |
| Postgres FTS with SearchVector | ✅ |
| Inspected badge in ProductCard serializer + frontend | ✅ |
| auto_heal.sh + monitor.sh scripts | ✅ |
| Memory limits on all containers | ✅ |
| Postgres tuned for 1GB VPS | ✅ |
| Redis maxmemory + LRU policy | ✅ |

---

### ❌ BUGS & ISSUES FOUND (30 total)

---

#### 🔴 CRITICAL — Fix immediately (security + data integrity)

---

**CRIT-01 · `datadump.json` contains real user credentials and PII committed to public GitHub repo**

The file `/backend/datadump.json` contains:
- Hashed passwords for ALL real users including superusers `bsans` and `kali`
- Real email addresses: `bsans47@gmail.com`, `deo55@gmail.com`, `seya@gmail.com`, `crimsonwhite@gmail.com`, `nickdarling@gmail.com`
- Real phone numbers: `0620781737`, `0764442025`, `0764441938`
- Session tokens (expired but still sensitive)
- Real payment numbers and transaction data
- Real inspection data including GPS coordinates

**This is the most urgent issue in the entire project.** Anyone who clones the repo now has hashed passwords they can attack offline with hashcat/john, real emails to target for phishing, and full knowledge of your user base and activity.

**Fix immediately:**
```bash
# 1. Remove from git history (BFG Repo Cleaner is fastest)
brew install bfg  # or: pip install bfg
bfg --delete-files datadump.json
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force

# 2. Add to .gitignore (already there for .env but not for *.json data files)
echo "backend/datadump.json" >> .gitignore
echo "backend/seed_data*.json" >> .gitignore

# 3. Change ALL real user passwords immediately via Django admin
# Users affected: bsans, kali, deo, somebody, seller1, seya, crimson, nickdarking, nickdarling21

# 4. Remove all other debug scripts from the repo:
git rm backend/debug_*.py backend/audit_requests.py backend/check_lipa_numbers.py \
       backend/repro_500.py backend/security_audit.py backend/staff_audit.py \
       backend/test_staff_dashboard.py backend/fix_*.py backend/cleanup.py \
       backend/list_*.py backend/scratch/ -r
```

---

**CRIT-02 · SidebarOffer links hardcode `http://127.0.0.1:8000` — internal URLs exposed publicly**

From datadump: `"link": "http://127.0.0.1:8000/product/used-vw-jetta-engine-1/"` in multiple `SidebarOffer` and `SidebarNewsItem` records. These are live in production and clickable by users. Clicking them sends users to localhost, which is a 404/connection-refused on their device.

**Fix:** Update all SidebarOffer and SidebarNewsItem records via Django admin — replace all `http://127.0.0.1:8000/` with relative paths like `/product/used-vw-jetta-engine-1/`.

---

**CRIT-03 · Product pk=170 (`Injector pump`) has `stock=0` but `is_available=True` — available with zero stock**

From datadump: `"stock": 0, "is_available": true`. This product shows in the public listing but cannot be ordered (stock validation will fail). Creates a broken experience — buyer sees the product, adds to cart, gets an error at checkout.

**Fix:** Run: `python manage.py shell -c "from marketplace.models import Product; Product.objects.filter(stock=0).update(is_available=False)"`

Also: the `is_available=False` auto-set logic was implemented in C-01 fix but clearly isn't catching existing stale records.

---

**CRIT-04 · Multiple orders stuck in `status='Pending'` — old status value, not in state machine**

From datadump: Orders 1–6 have `status='Pending'`. The current `OrderStateMachine.VALID_TRANSITIONS` has no `'Pending'` key — only `'CART'`, `'AWAITING_PAYMENT'`, etc. Calling `advance()` on any of these orders raises `ValueError: Invalid transition from Pending to X`. These are real orders with real users and real money amounts.

**Fix:** One-time data migration:
```python
# In a Django management command or shell:
from marketplace.models import Order
Order.objects.filter(status='Pending').update(status='AWAITING_PAYMENT')
# These are all old test orders — verify individually before updating
```
Add `'Pending': ['AWAITING_PAYMENT', 'CANCELLED']` to `VALID_TRANSITIONS` as a temporary bridge.

---

**CRIT-05 · `SponsoredListing` pk=1 has `expires_at=null` — approved listing never expires**

From datadump: `"expires_at": null`. The v5 fix set expires_at on NEW approvals but existing approved listings in production still have `null`. This listing is live and will stay promoted forever.

**Fix:** Run: `python manage.py shell -c "from marketplace.models import SponsoredListing; from django.utils import timezone; from datetime import timedelta; SponsoredListing.objects.filter(status='approved', expires_at__isnull=True).update(expires_at=timezone.now()+timedelta(days=30))"`

---

**CRIT-06 · Multiple duplicate InspectionPayment balance records for same request**

From datadump: Request 2 has balance payments pk=2, pk=3, pk=4 all `status='approved'` for the same `amount=71000`. This means TZS 213,000 was "approved" for a balance of TZS 71,000. The system accepted three payment proof uploads for the same stage with no duplicate guard.

**Fix in `inspections/api_views.py` → `InspectionPaymentViewSet.create()` or `perform_create()`:**
```python
def perform_create(self, serializer):
    request_obj = serializer.validated_data['request']
    stage = serializer.validated_data['stage']
    # FIX CRIT-06: prevent duplicate payment submissions for same stage
    existing = InspectionPayment.objects.filter(
        request=request_obj, stage=stage, status__in=['pending', 'approved']
    )
    if existing.exists():
        raise serializers.ValidationError(
            f'A {stage} payment already exists for this inspection. Contact support if there is an issue.'
        )
    serializer.save()
```

---

#### 🟠 HIGH — Fix before next release

---

**HIGH-01 · `uvicorn --workers 1` is correct for 1GB RAM but loses all requests during deploy (no graceful reload)**

When you run `docker compose up --build`, uvicorn stops and restarts with zero graceful shutdown. All WebSocket connections drop and in-flight requests fail. For a marketplace with real users this is jarring.

**Fix:** Use `uvicorn` with `--timeout-graceful-shutdown 30` and in your deploy script:
```bash
# Instead of docker compose up -d (which kills and recreates):
docker compose up -d --no-recreate  # keep running containers
docker compose pull                  # pull new image
docker compose up -d backend         # only restart backend
```
Or better: add a `restart: unless-stopped` + `stop_grace_period: 30s` to the backend service in compose.

**`docker-compose.yml` backend service:**
```yaml
  backend:
    stop_grace_period: 30s    # ADD THIS — gives uvicorn time to finish requests
    restart: unless-stopped   # ADD THIS
```

---

**HIGH-02 · `celery -A uzachuo worker --beat` combined in one process — not safe for production**

Running worker and beat in the same process means if the worker crashes, beat stops scheduling too. Beat should be a separate process, especially for Celery 5+.

The current compose has one `celery` service running both. For a 1GB VPS with tight memory, this is an acceptable trade-off BUT the `--scheduler django_celery_beat.schedulers:DatabaseScheduler` should be used if you want to manage schedules via admin, otherwise the schedule is only in `celery.py`.

**Fix (memory-conscious but safer):** Split into two services but keep them lightweight:
```yaml
  celery-worker:
    <<: *backend-common
    command: celery -A uzachuo worker --loglevel=warning --concurrency=1 --max-tasks-per-child=50
    deploy:
      resources:
        limits:
          memory: 150M

  celery-beat:
    <<: *backend-common
    command: celery -A uzachuo beat --loglevel=warning --scheduler celery.beat:PersistentScheduler
    deploy:
      resources:
        limits:
          memory: 60M
```

---

**HIGH-03 · Checkout page has no DeliveryZone selector — delivery fee is always TSh 0 or manual**

The `DeliveryZone` model exists and the API is registered, but `CheckoutPage.tsx` has no zone picker. Buyers select DELIVERY but can't pick a zone, so `shipping_fee` is always 0 or the default. Sellers can't charge delivery fees.

**Fix in `frontend/src/pages/CheckoutPage.tsx`:**
Add a delivery zone fetch and selector when `shippingMethod === 'DELIVERY'`. (Full code provided in v5 prompt — apply it.)

---

**HIGH-04 · `ProductVariantViewSet` is not registered in `urls.py` — variants can't be created via API**

The `ProductVariant` model and serializer exist. The `ProductVariant` fields appear in `OrderItem` datadump (as `null` — no variants used yet). But there is no `ProductVariantViewSet` in `api_views.py` and no URL registration. Sellers cannot add variants to their products.

**Fix in `backend/marketplace/api_views.py`:**
```python
class ProductVariantViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProductVariantSerializer

    def get_queryset(self):
        product_slug = self.kwargs.get('product_slug')
        if product_slug:
            return ProductVariant.objects.filter(product__slug=product_slug, product__seller=self.request.user)
        return ProductVariant.objects.filter(product__seller=self.request.user)

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        if product.seller != self.request.user:
            raise serializers.ValidationError('You do not own this product.')
        serializer.save()
```

Register: `router.register(r'variants', ProductVariantViewSet, basename='variant')`

Also add variant selector to `ProductDetailPage.tsx` — if product has variants, show dropdown before "Add to Cart".

---

**HIGH-05 · Staff support ticket management has no frontend UI**

`SupportTicketViewSet` and `FAQViewSet` exist with correct permissions. But `StaffDashboardLayout.tsx` has no support ticket management table or FAQ editor. Staff cannot see, assign, or resolve tickets submitted by users.

**Fix in `frontend/src/pages/staff/StaffDashboardLayout.tsx`:**
Add two sections:
1. Support Tickets table: `GET /api/staff/support-tickets/` — columns: subject, category, user, status, created_at. Actions: assign to me, change status, add notes.
2. FAQ Manager: `GET/POST/PATCH/DELETE /api/staff/faq/` — list with edit/delete, create form.

---

**HIGH-06 · `DisputeViewSet` exists but no frontend UI for buyers to open or view disputes**

The dispute model and API exist but there's no "Open Dispute" button on `OrdersPage.tsx` for DELIVERED orders, and no dispute detail view.

**Fix in `frontend/src/pages/OrdersPage.tsx`:**
```tsx
// In the DELIVERED order card, add:
{order.status === 'DELIVERED' && !order.dispute && (
    <button onClick={() => setOpenDisputeId(order.id)}
        className="text-xs text-red-500 underline mt-2">
        Open Dispute
    </button>
)}
// Dispute form modal: reason + evidence_description + evidence_image upload
```

---

**HIGH-07 · `auto_heal.sh` uses `docker system prune -f --volumes` on disk pressure — DESTROYS postgres data**

Line 43: `docker system prune -f --volumes`. The `--volumes` flag removes unused Docker volumes. If postgres is ever stopped (maintenance, crash) and the auto-heal script fires during disk pressure, it will delete `persistent_data/postgres`. This is catastrophic and unrecoverable.

**Fix immediately:**
```bash
# Remove --volumes flag:
docker system prune -f  # NOT --volumes
```

Also: postgres data is in `./persistent_data/postgres` as a bind mount (not a named Docker volume), so Docker prune wouldn't touch it anyway — but the script intent is dangerous and should be corrected.

---

**HIGH-08 · No HTTPS — running on plain HTTP in production (Lightsail)**

Traefik config has HTTPS commented out: `# NO HTTPS/ACME — no domain yet`. The site is running on port 80 only. All JWT tokens, session cookies, and payment proof images are transmitted in cleartext. This is a real deployed marketplace handling real user data.

**Fix:** Get a domain (even a cheap one like `.co.tz` or `.com`) and enable Let's Encrypt. Steps:
1. Point domain A record to Lightsail IP
2. Uncomment HTTPS lines in `docker-compose.yml` Traefik command
3. Set `ACME_EMAIL` in `.env`
4. `docker compose up -d traefik`
5. Set `FORCE_HTTPS=True` in `.env` → triggers `SECURE_SSL_REDIRECT`, `SECURE_HSTS`, `CSRF_COOKIE_SECURE`

Until then, add to `.env`:
```
DJANGO_ALLOWED_HOSTS=<lightsail-ip>,localhost
```

---

**HIGH-09 · Debug scripts left in repo pollute the codebase and expose internal structure**

21 debug/fix scripts in `backend/`: `debug_500.py`, `audit_requests.py`, `security_audit.py`, `fix_integrity.py`, `staff_audit.py` etc. These scripts reveal your internal data structures, business logic, and past bugs to anyone who reads the repo. They also clutter `PYTHONPATH` and could accidentally be executed.

**Fix:** `git rm` all of them (see CRIT-01 fix command).

---

**HIGH-10 · `SavedSearch` and `PriceAlert` have no frontend UI**

Models, tasks, and API are all implemented. But no "Save Search" button in `ProductList.tsx` and no "Set Price Alert" button in `ProductDetailPage.tsx`. The feature is invisible to users.

**Fix in `frontend/src/ProductList.tsx`:**
```tsx
// Below the search bar, after searching:
{query && isAuthenticated && (
    <button onClick={async () => {
        await api.post('/api/saved-searches/', { query, category: selectedCategory, min_price: minPrice, max_price: maxPrice, notify_on_match: true });
        toast.success('Search saved! You\'ll be notified of new matches.');
    }} className="text-xs text-brand-600 font-bold mt-1 flex items-center gap-1">
        <Bell size={12} /> Save this search
    </button>
)}
```

**Fix in `frontend/src/pages/ProductDetailPage.tsx`:**
```tsx
// Near the price, add:
{isAuthenticated && (
    <div className="flex items-center gap-2 mt-2">
        <input type="number" placeholder="Alert me when price drops to..."
            value={alertPrice} onChange={e => setAlertPrice(e.target.value)}
            className="input text-sm w-48" />
        <button onClick={async () => {
            await api.post('/api/price-alerts/', { product: product.id, target_price: alertPrice });
            toast.success('Price alert set!');
        }} className="btn-ghost text-xs">Set Alert</button>
    </div>
)}
```

---

#### 🟡 MEDIUM — Important but not blocking

---

**MED-01 · `VerifySuperuserView` is exposed on `/api/auth/verify-superuser/` with `AllowAny` permission**

The endpoint itself is safe (only returns 200 for valid superuser JWTs) but it's publicly reachable. An attacker can probe it to check if any JWT they've stolen or forged belongs to a superuser. Should have a very tight rate limit.

**Fix in `backend/marketplace/api_views.py`:**
```python
class VerifySuperuserRateThrottle(AnonRateThrottle):
    scope = 'verify_superuser'

class VerifySuperuserView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [VerifySuperuserRateThrottle]
    # ...
```
Add `'verify_superuser': '30/minute'` to throttle rates in settings.

---

**MED-02 · InspectionCategory `marketplace_category` FK is `null` for all 21 categories in production**

All inspection categories have `"marketplace_category": null` in the datadump. The suggestion endpoint exists but cannot return useful results without the mapping. The category conflict bug that was the original motivation for this feature is still present in practice.

**Fix:** Via Django admin, manually link inspection categories to marketplace categories:
- Inspection "Cars & SUVs" (pk=10) → Marketplace "Cars" (pk=18) + "SUVs" (pk=21)
- Inspection "Motorcycles & Boda Boda" (pk=11) → Marketplace "Motorcycles" (pk=20)
- Inspection "Trucks & Commercial" (pk=12) → Marketplace "Trucks" (pk=19)

Since `marketplace_category` is a single FK, you need a M2M or a different approach for one-to-many mapping. Consider changing to `ManyToManyField`.

---

**MED-03 · `InspectionRequest` pk=7 used "Vehicle Spares" inspection category for a product named "react nat"**

From datadump: A product called "react nat" (description: "react") was put through an inspection with category "Vehicle Spares" and received a PASS verdict. This is clearly test data but it's in a published state and visible publicly via `/verify/UZ-VEH-20260428-00001`. The public verify page would show a verified inspection for a nonsense product.

**Fix:** Mark this inspection as `status='cancelled'` via Django admin. Also delete or mark test products (pk=175 Fuel sensor, pk=176 Exhaust pipe, pk=177 Loo, pk=178 react nat) as unavailable.

---

**MED-04 · `Review` records have inappropriate content in production (including hateful comment pk=8)**

From datadump: Review pk=8 has `comment: "Heil hitler my nigga"` with `approved=False`. Since the bug fix correctly filters unapproved reviews, this is not public-facing. But it exists in the database. The staff has no UI to find and delete inappropriate unapproved reviews.

**Fix:** Staff review management queue should show ALL reviews (approved and not) with delete capability. The staff panel fix in HIGH-05 should include this.

---

**MED-05 · `Order.total_amount` is `0.00` for 8 orders in CART status**

Orders 7–13 and 16 all have `total_amount: 0.00` while in CART. This is correct — items haven't been added to CART-status orders via the serializer's locking logic. But if `update_total()` is called on these or they advance, the total stays 0.

This is architectural: CART orders are created before items are added (the frontend creates the order shell first, then adds items). Confirm the item creation endpoint properly triggers `update_total()` after each item is added.

---

**MED-06 · `CeleryBeat + Worker combined` loses schedules on crash**

Already flagged as HIGH-02. The in-memory scheduler loses its state if the celery container crashes. Use `--scheduler celery.beat:PersistentScheduler` with a `--schedule /app/celerybeat-schedule` file persisted as a volume.

---

**MED-07 · No CSRF protection on WebSocket handshake**

WebSocket connections at `/ws/` go through Traefik → Uvicorn. The Channels `AuthMiddlewareStack` validates the session/token but there's no CSRF check on the WS handshake (standard for WebSockets — CSRF doesn't apply to WS protocol). This is actually fine — document it clearly so it's not flagged in a future audit.

---

**MED-08 · `persistent_data/` directory needs proper backup strategy**

Media uploads (`persistent_data/media/`), Postgres data (`persistent_data/postgres/`), and Redis data (`persistent_data/redis/`) are all on the Lightsail instance disk with no offsite backup. If the instance fails, all data is lost.

**Fix:** Set up Lightsail snapshots (automatic daily, $0.05/GB/month) AND add a backup script:
```bash
# /home/ubuntu/uzaspea/scripts/backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/home/ubuntu/uzaspea/backups
mkdir -p $BACKUP_DIR
# Postgres dump
docker exec uzaspea-postgres pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz
# Media backup (optional — large)
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /home/ubuntu/uzaspea/persistent_data/media/
# Keep 7 days
find $BACKUP_DIR -mtime +7 -delete
echo "Backup complete: $DATE"
```
Add to crontab: `0 2 * * * /home/ubuntu/uzaspea/scripts/backup.sh >> /home/ubuntu/uzaspea/logs/backup.log 2>&1`

---

**MED-09 · `media` volume mounted on frontend nginx but served via Django**

`frontend/docker-compose.yml` mounts `./persistent_data/media:/app/media:ro` and nginx serves it at `/media/`. This is actually correct and good — nginx serves media faster than Django/uvicorn. But nginx needs to know the correct alias path. Current `nginx.conf` has `alias /app/media/;` which matches the volume mount path. **This is correct — mark as verified.**

---

**MED-10 · `InspectionCheckin` pk=3 has `checkin_lat=null, checkin_lng=null`**

Inspector checked in without GPS for inspection UZ-VEH-20260428-00001. The checkin was accepted. GPS should be mandatory (or at minimum warn loudly) for check-in to prevent false location reporting.

**Fix in `inspections/api_views.py` → `InspectionCheckInViewSet.create()`:**
```python
if not data.get('checkin_lat') or not data.get('checkin_lng'):
    # Don't block — but flag it
    FraudFlag.objects.create(
        request=request_obj,
        flag_type='location_missing',
        details='Inspector checked in without GPS coordinates'
    )
```

---

#### 🟢 LOW — Polish and cleanup

---

**LOW-01 · `UserProfile.bio` is `null` for 14 users but field uses `TextField` without `null=True`**

From datadump: `"bio": null` for users 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18. `TextField` in Django allows null if `null=True` — check whether the field was defined with `null=True, blank=True` or just `blank=True`. If just `blank=True`, empty string is correct but null is a data inconsistency from old records.

**Fix:** Add a data migration: `UserProfile.objects.filter(bio__isnull=True).update(bio='')`

---

**LOW-02 · `scripts/remote_build.sh` and `scripts/remote_fix_env.sh` likely contain server IP or SSH config**

These scripts interact with the remote Lightsail server. If they contain hardcoded IPs, usernames, or SSH key paths, they leak infrastructure details.

**Fix:** Review these files. If they contain server details, add them to `.gitignore`.

---

**LOW-03 · `InspectorProfile` total_inspections shows 3 for user `deo` (pk=2) but only 2 inspection reports were approved through the normal flow**

From datadump: `"total_inspections": 3` for inspector pk=2. But only 3 inspection reports exist (pk=1,2,3) and all 3 were submitted by user 2. So this is actually correct — `deo` did all 3. Mark as verified.

---

**LOW-04 · `Subscription` model has 5 records all with `tier=null, is_active=false` for the same user (pk=1, bsans)**

From datadump: 5 Subscription records for user 1, all inactive, all with null tier. These are duplicate dead records created by the `get_or_create` logic in the `activate_subscription_on_payment_approval` signal. Each time a PaymentConfirmation was approved (or tested), it created a new subscription rather than updating the existing one.

**Fix:** The signal uses `get_or_create` which is correct, but something is creating duplicates. Check that `PaymentConfirmation` approval is only triggering the signal once. Also clean up: `Subscription.objects.filter(user_id=1, is_active=False).delete()`

---

## PART 2 — MASTER AGENT PROMPT v6

```
You are a senior Django/React/DevOps engineer performing a production hotfix pass on UZASPEA (deployed on AWS Lightsail). Fix every item below in order of priority. No new features. Add # FIX [ID] comment. After all fixes: python manage.py check (zero errors), npm run build (zero TS errors).
```

---

### PRIORITY 1 — CRIT-01: Remove datadump.json from repo history

```bash
# Run on the server AND locally:

# Install BFG
wget https://repo1.maven.org/maven2/com/madgraph-analytics/bfg-repo-cleaner/1.14.0/bfg-1.14.0.jar

# Remove file from all history
java -jar bfg-1.14.0.jar --delete-files datadump.json
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force

# Also remove all debug/scratch scripts:
git rm backend/debug_*.py backend/audit_requests.py backend/check_lipa_numbers.py \
       backend/repro_500.py backend/security_audit.py backend/staff_audit.py \
       backend/test_staff_dashboard.py backend/fix_departments.py backend/fix_integrity.py \
       backend/fix_slugs.py backend/cleanup.py backend/list_categories.py \
       backend/list_requests.py backend/optimize_templates_everything.py \
       backend/create_initial_data.py backend/export_templates.py \
       backend/assign_network_images.py backend/debug_null_fk.py \
       backend/debug_assignment.py backend/debug_api_available.py \
       backend/debug_status.py backend/debug_request_1.py
git commit -m "security: remove datadump and debug scripts from repo"

# Update .gitignore:
echo "backend/datadump.json" >> .gitignore
echo "backend/seed_data*.json" >> .gitignore
echo "backend/scratch/" >> .gitignore
echo "*.json.bak" >> .gitignore
```

After this: **change all real user passwords immediately** via Django admin.

---

### PRIORITY 2 — CRIT-04: Fix old 'Pending' order status

**`backend/marketplace/services.py`** → add to `VALID_TRANSITIONS`:
```python
'Pending': ['AWAITING_PAYMENT', 'CANCELLED'],  # FIX CRIT-04: bridge for legacy orders
```

Run one-time data fix:
```bash
docker exec uzaspea-backend python manage.py shell -c "
from marketplace.models import Order
count = Order.objects.filter(status='Pending').count()
print(f'Found {count} legacy Pending orders')
Order.objects.filter(status='Pending').update(status='AWAITING_PAYMENT')
print('Updated to AWAITING_PAYMENT')
"
```

---

### PRIORITY 3 — CRIT-06: Prevent duplicate InspectionPayment submissions

**`backend/inspections/api_views.py`** → `InspectionPaymentViewSet`:
```python
def perform_create(self, serializer):
    request_obj = serializer.validated_data['request']
    stage = serializer.validated_data['stage']
    # FIX CRIT-06: prevent duplicate payment proofs for same stage
    existing = InspectionPayment.objects.filter(
        request=request_obj,
        stage=stage,
        status__in=['pending', 'approved']
    )
    if existing.exists():
        raise serializers.ValidationError(
            f'A {stage} payment submission already exists for this inspection (status: {existing.first().status}). '
            f'Contact support if there is a payment issue.'
        )
    serializer.save()
```

---

### PRIORITY 4 — HIGH-07: Fix auto_heal.sh dangerous prune

**`scripts/auto_heal.sh`** line 43 — replace:
```bash
docker system prune -f --volumes 2>/dev/null
```
with:
```bash
docker system prune -f 2>/dev/null  # FIX HIGH-07: removed --volumes flag — never prune volumes automatically
docker image prune -f 2>/dev/null   # Only remove unused images, not volumes
```

---

### PRIORITY 5 — HIGH-01: Graceful shutdown on deploy

**`docker-compose.yml`** → backend service:
```yaml
  backend:
    <<: *backend-common
    container_name: uzaspea-backend
    stop_grace_period: 30s        # FIX HIGH-01: allow requests to complete before kill
    restart: unless-stopped       # FIX HIGH-01: auto-restart on crash
    volumes:
      - ./persistent_data/media:/app/media
      - ./persistent_data/static:/app/staticfiles
    command: >
      sh -c "python manage.py migrate --noinput &&
             python manage.py collectstatic --noinput &&
             uvicorn uzachuo.asgi:application --host 0.0.0.0 --port 8000 --workers 1 --ws websockets --timeout-graceful-shutdown 30"
```

---

### PRIORITY 6 — HIGH-02: Split Celery worker and beat

**`docker-compose.yml`** — replace `celery:` service with two services:
```yaml
  celery-worker:
    <<: *backend-common
    container_name: uzaspea-celery-worker
    restart: unless-stopped
    volumes:
      - ./persistent_data/media:/app/media
    command: celery -A uzachuo worker --loglevel=warning --concurrency=1 --max-tasks-per-child=50
    deploy:
      resources:
        limits:
          memory: 150M

  celery-beat:
    <<: *backend-common
    container_name: uzaspea-celery-beat
    restart: unless-stopped
    volumes:
      - ./persistent_data/media:/app/media
      - ./persistent_data/celerybeat:/app/celerybeat  # persist schedule state
    command: celery -A uzachuo beat --loglevel=warning --schedule /app/celerybeat/celerybeat-schedule
    deploy:
      resources:
        limits:
          memory: 60M
```

Create `persistent_data/celerybeat/` directory on server.

---

### PRIORITY 7 — HIGH-03: CheckoutPage delivery zone selector

**`frontend/src/pages/CheckoutPage.tsx`** — add delivery zone fetch and UI when `shippingMethod === 'DELIVERY'`:
```tsx
const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
const [selectedZone, setSelectedZone] = useState<any>(null);

// Fetch seller's delivery zones:
useEffect(() => {
    if (shippingMethod === 'DELIVERY' && cartItems.length > 0) {
        const sellerUsername = cartItems[0]?.seller_username;
        if (sellerUsername) {
            api.get(`/api/delivery-zones/?seller=${sellerUsername}`)
                .then(r => setDeliveryZones(r.data.results || r.data))
                .catch(() => {});
        }
    }
}, [shippingMethod, cartItems]);

// In JSX, below the DELIVERY radio button:
{shippingMethod === 'DELIVERY' && deliveryZones.length > 0 && (
    <div className="mt-3 space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase">Select Delivery Zone</p>
        {deliveryZones.map(zone => (
            <label key={zone.id}
                className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer ${selectedZone?.id === zone.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center gap-3">
                    <input type="radio" name="zone" checked={selectedZone?.id === zone.id}
                        onChange={() => { setSelectedZone(zone); setShippingFee(parseInt(zone.delivery_fee)); }} />
                    <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white">{zone.zone_name}</p>
                        {zone.estimated_days && <p className="text-xs text-gray-400">{zone.estimated_days}</p>}
                        {zone.notes && <p className="text-xs text-gray-400">{zone.notes}</p>}
                    </div>
                </div>
                <span className="font-black text-sm text-gray-900 dark:text-white">
                    {parseInt(zone.delivery_fee) === 0 ? 'FREE' : `TSh ${parseInt(zone.delivery_fee).toLocaleString()}`}
                </span>
            </label>
        ))}
        {deliveryZones.length === 0 && (
            <p className="text-xs text-yellow-600">Seller has not set up delivery zones. Contact them for delivery fee.</p>
        )}
    </div>
)}
```

---

### PRIORITY 8 — HIGH-04: ProductVariantViewSet

**`backend/marketplace/api_views.py`** — add:
```python
class ProductVariantViewSet(viewsets.ModelViewSet):
    """FIX HIGH-04: sellers can manage variants for their products."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProductVariantSerializer

    def get_queryset(self):
        product_id = self.request.query_params.get('product')
        qs = ProductVariant.objects.select_related('product')
        if product_id:
            qs = qs.filter(product_id=product_id)
        if not self.request.user.is_staff:
            qs = qs.filter(product__seller=self.request.user)
        return qs

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        if product.seller != self.request.user and not self.request.user.is_staff:
            raise serializers.ValidationError('You do not own this product.')
        serializer.save()
```

Register in `marketplace/urls.py`: `router.register(r'variants', ProductVariantViewSet, basename='variant')`

Add `ProductVariantSerializer` to `serializers.py`:
```python
class ProductVariantSerializer(serializers.ModelSerializer):
    final_price = serializers.ReadOnlyField()
    class Meta:
        model = ProductVariant
        fields = ['id', 'product', 'name', 'sku', 'price_adjustment', 'final_price', 'stock', 'is_available', 'image']
```

---

### PRIORITY 9 — HIGH-05: Staff support ticket + FAQ UI

**`frontend/src/pages/staff/StaffDashboardLayout.tsx`** — add two new sections:

```tsx
// Support Tickets Section
const SupportTicketsManager: React.FC = () => {
    const [tickets, setTickets] = useState<any[]>([]);
    const [statusFilter, setStatusFilter] = useState('open');

    useEffect(() => {
        api.get(`/api/staff/support-tickets/?status=${statusFilter}`)
            .then(r => setTickets(r.data.results || r.data))
            .catch(() => {});
    }, [statusFilter]);

    const updateStatus = async (id: number, status: string) => {
        await api.patch(`/api/staff/support-tickets/${id}/`, { status });
        setTickets(prev => prev.map(t => t.id === id ? {...t, status} : t));
        toast.success('Ticket updated');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white">Support Tickets</h3>
                <div className="flex gap-2">
                    {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={`text-xs px-3 py-1 rounded-full font-bold capitalize ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                            {s.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                {tickets.map(ticket => (
                    <div key={ticket.id} className="card p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">{ticket.subject}</p>
                                <p className="text-xs text-gray-500">{ticket.category} · {ticket.name} ({ticket.email})</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{ticket.message}</p>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                                {ticket.status === 'open' && (
                                    <button onClick={() => updateStatus(ticket.id, 'in_progress')}
                                        className="btn-primary text-xs py-1 px-2">Take</button>
                                )}
                                {ticket.status === 'in_progress' && (
                                    <button onClick={() => updateStatus(ticket.id, 'resolved')}
                                        className="btn-ghost text-xs py-1 px-2 text-green-600">Resolve</button>
                                )}
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-center ${ticket.status === 'open' ? 'bg-red-100 text-red-700' : ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {ticket.status.toUpperCase().replace('_', ' ')}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                {tickets.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No {statusFilter} tickets</p>}
            </div>
        </div>
    );
};
```

Add FAQ Manager section similarly with create/edit/delete/publish controls.

---

### PRIORITY 10 — HIGH-06: Dispute UI in OrdersPage

**`frontend/src/pages/OrdersPage.tsx`**:
```tsx
const [openDisputeOrderId, setOpenDisputeOrderId] = useState<number|null>(null);
const [disputeForm, setDisputeForm] = useState({ reason: '', evidence_description: '' });

// Add in DELIVERED order card:
{order.status === 'DELIVERED' && (
    <button onClick={() => setOpenDisputeOrderId(order.id)}
        className="text-xs text-red-500 font-bold underline mt-2 hover:text-red-700">
        Something wrong? Open Dispute
    </button>
)}

// Dispute modal:
{openDisputeOrderId && (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-lg">Open Dispute</h3>
            <p className="text-sm text-gray-500">Describe the issue with your order. Our team will review and mediate.</p>
            <textarea placeholder="What went wrong? Be specific." value={disputeForm.reason}
                onChange={e => setDisputeForm({...disputeForm, reason: e.target.value})}
                className="input resize-none" rows={4} />
            <textarea placeholder="Additional evidence details (optional)" value={disputeForm.evidence_description}
                onChange={e => setDisputeForm({...disputeForm, evidence_description: e.target.value})}
                className="input resize-none" rows={2} />
            <div className="flex gap-3">
                <button onClick={() => setOpenDisputeOrderId(null)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={async () => {
                    try {
                        await api.post('/api/disputes/', { order: openDisputeOrderId, ...disputeForm });
                        toast.success('Dispute opened. We\'ll review within 24 hours.');
                        setOpenDisputeOrderId(null);
                    } catch { toast.error('Failed to open dispute'); }
                }} className="btn-primary flex-1">Submit Dispute</button>
            </div>
        </div>
    </div>
)}
```

---

### PRIORITY 11 — HIGH-08: HTTPS (when domain is ready)

**`docker-compose.yml`** traefik command — uncomment HTTPS lines:
```yaml
  traefik:
    command:
      - "--api.insecure=false"
      - "--api.dashboard=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=uzaspea_default"
      - "--providers.file.directory=/etc/traefik/dynamic"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"      # uncomment
      - "--entrypoints.web.http.redirections.entryPoint.scheme=https"       # uncomment
      - "--entrypoints.websecure.address=:443"                              # uncomment
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"      # uncomment
      - "--certificatesresolvers.letsencrypt.acme.storage=/etc/traefik/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--accesslog=false"
    ports:
      - "80:80"
      - "443:443"   # add this
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik_acme.json:/etc/traefik/acme.json  # add this
      - ./traefik_dynamic.yml:/etc/traefik/dynamic/dynamic.yml:ro
```

Update backend + frontend routers to use Let's Encrypt:
```yaml
labels:
  - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
  - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

Add to `.env`: `ACME_EMAIL=your@email.com`
Create: `touch traefik_acme.json && chmod 600 traefik_acme.json`
Add to `.gitignore`: `traefik_acme.json`
Set in `.env`: `FORCE_HTTPS=True`

---

### PRIORITY 12 — HIGH-09 + MED-02: Link inspection categories to marketplace categories

**Via Django admin** — set `marketplace_category` on each `InspectionCategory`:

Or add a management command:
```python
# backend/inspections/management/commands/link_categories.py
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    def handle(self, *args, **options):
        from inspections.models import InspectionCategory
        from marketplace.models import Category

        mappings = [
            ('Cars & SUVs', ['Cars', 'SUVs']),
            ('Motorcycles & Boda Boda', ['Motorcycles']),
            ('Trucks & Commercial', ['Trucks']),
        ]

        for inspection_name, marketplace_names in mappings:
            try:
                ic = InspectionCategory.objects.get(name=inspection_name)
                # Since it's a FK not M2M, link to the primary one
                mc = Category.objects.filter(name=marketplace_names[0]).first()
                if mc:
                    ic.marketplace_category = mc
                    ic.save()
                    self.stdout.write(f'Linked {inspection_name} → {mc.name}')
            except InspectionCategory.DoesNotExist:
                self.stdout.write(f'Not found: {inspection_name}')
```

---

### PRIORITY 13 — HIGH-10: SavedSearch + PriceAlert frontend

Apply SavedSearch save button to `ProductList.tsx` and PriceAlert input to `ProductDetailPage.tsx` (full code in v5 prompt).

---

### PRIORITY 14 — MED-01: Rate limit VerifySuperuserView

Already described above — add `VerifySuperuserRateThrottle` with scope `'verify_superuser': '30/minute'`.

---

### PRIORITY 15 — LOW-01: Fix null bio values

```bash
docker exec uzaspea-backend python manage.py shell -c "
from marketplace.models import UserProfile
count = UserProfile.objects.filter(bio__isnull=True).count()
UserProfile.objects.filter(bio__isnull=True).update(bio='')
print(f'Fixed {count} null bio values')
"
```

---

### PRIORITY 16 — CRIT-02 + CRIT-03 + CRIT-05: Production data fixes

```bash
docker exec uzaspea-backend python manage.py shell -c "
from marketplace.models import Product, SponsoredListing
from django.utils import timezone
from datetime import timedelta

# Fix stock=0 but available
fixed = Product.objects.filter(stock=0, is_available=True).update(is_available=False)
print(f'Fixed {fixed} products with zero stock')

# Fix sponsored listings with no expiry
updated = SponsoredListing.objects.filter(status='approved', expires_at__isnull=True).update(
    expires_at=timezone.now() + timedelta(days=30)
)
print(f'Set expiry on {updated} sponsored listings')
"
```

Fix SidebarOffer links via Django admin — replace all `http://127.0.0.1:8000/` with `/`.

---

### ADD BACKUP SCRIPT

Create `scripts/backup.sh`:
```bash
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/home/ubuntu/uzaspea/backups
mkdir -p $BACKUP_DIR

source /home/ubuntu/uzaspea/backend/.env

echo "[$DATE] Starting backup..."

# Postgres dump
docker exec uzaspea-postgres pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "[$DATE] Backup complete: db_$DATE.sql.gz"
```

```bash
chmod +x scripts/backup.sh
# Add to crontab:
# 0 2 * * * /home/ubuntu/uzaspea/scripts/backup.sh >> /home/ubuntu/uzaspea/logs/backup.log 2>&1
```

---

### FINAL VERIFICATION AFTER ALL FIXES

```bash
# On Lightsail server:
cd ~/uzaspea

# Rebuild and restart
docker compose build backend
docker compose up -d

# Verify containers healthy
docker compose ps

# Run data fixes
docker exec uzaspea-backend python manage.py shell < /tmp/data_fixes.py

# Test key endpoints
curl http://localhost/api/products/ -H "Host: yourdomain.com"  # 200
curl http://localhost/api/site-settings/                        # 200
curl http://localhost/api/faq/                                  # 200

# Check celery is processing
docker exec uzaspea-celery-worker celery -A uzachuo inspect active

# Check no OOM kills
dmesg | grep oom | tail -5

# Run monitor
bash ~/uzaspea/scripts/monitor.sh
```
