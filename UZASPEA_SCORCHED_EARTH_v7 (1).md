# UZASPEA — SCORCHED EARTH AUDIT v7
# Full Analysis + Agent Prompt

---

## PART 1 — RATING: 91/100 🎉

### This is a real, shippable product. The biggest leap yet.

---

### ✅ CONFIRMED FIXED FROM v6

| Item | Status |
|---|---|
| datadump.json removed from repo | ✅ |
| All debug/fix scripts removed | ✅ |
| auto_heal.sh `--volumes` danger removed | ✅ |
| backup.sh created | ✅ |
| Celery worker + beat split into separate services | ✅ |
| Delivery zone selector in CheckoutPage | ✅ |
| Dispute UI in OrdersPage (form + modal) | ✅ |
| Saved search "Save" button in ProductList | ✅ |
| Price alert input in ProductDetailPage | ✅ |
| Product variant selector in ProductDetailPage | ✅ |
| Staff support tickets UI in StaffDashboardLayout | ✅ |
| Inspection duplicate payment guard | ✅ |
| CI/CD pipeline (GitHub Actions → GHCR → Lightsail) | ✅ |
| docker-compose.prod.yml using pre-built GHCR images | ✅ |
| stop_grace_period + restart: unless-stopped on backend | ✅ |
| VerifySuperuserRateThrottle applied | ✅ |

---

### ❌ BUGS & ISSUES REMAINING (22 total)

---

#### 🔴 CRITICAL

---

**CRIT-01 · Delivery zone fee field name mismatch — wrong fee always charged**

`DeliveryZoneSerializer` serializes the field as `delivery_fee` (the model field name). But `CheckoutPage.tsx` reads `zone.fee` and `zone.name` — neither of which exists on the serialized object. `zone.fee` is `undefined`, so `Number(undefined)` = `NaN`, then `shippingFee` becomes `NaN`, and the order is placed with `shipping_fee: NaN`. The backend receives NaN and either crashes or stores `0`.

File `CheckoutPage.tsx` line 36: `Number(selectedZone.fee)` → should be `Number(selectedZone.delivery_fee)`
File `CheckoutPage.tsx` line 153: `zone.fee` → `zone.delivery_fee`
File `CheckoutPage.tsx` line 153: `zone.name` → `zone.zone_name`

**Fix:**
```tsx
// Line 36:
? (deliveryZones.length > 0 ? (selectedZone ? Number(selectedZone.delivery_fee) : 0) : 5000)

// Line 153:
<option key={zone.id} value={zone.id}>
    {zone.zone_name} — TSh {Number(zone.delivery_fee).toLocaleString()}
</option>
```

---

**CRIT-02 · ProductVariantViewSet has `permission_classes = [IsAuthenticated]` — anonymous users and buyers cannot see variants**

Buyers browsing a product page call `GET /api/variants/?product=123`. But the viewset requires authentication, so anonymous users get a 401 and logged-in buyers who aren't the seller get an empty queryset (filtered to `product__seller=request.user`). No buyer can ever see a product's variants except the seller who created them.

**Fix in `backend/marketplace/api_views.py` → `ProductVariantViewSet`:**
```python
class ProductVariantViewSet(viewsets.ModelViewSet):
    serializer_class = ProductVariantSerializer

    def get_permissions(self):
        # Public read (list/retrieve for buyers), auth required for write
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        product_id = self.request.query_params.get('product')
        user = self.request.user

        # Public: fetch variants for a specific product (buyer view)
        if product_id:
            return ProductVariant.objects.filter(
                product_id=product_id, is_available=True
            ).select_related('product')

        # Seller: manage their own variants
        if user.is_authenticated:
            if user.is_staff:
                return ProductVariant.objects.all().select_related('product')
            return ProductVariant.objects.filter(
                product__seller=user
            ).select_related('product')

        return ProductVariant.objects.none()

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        if product.seller != self.request.user and not self.request.user.is_staff:
            raise serializers.ValidationError('You do not own this product.')
        serializer.save()
```

---

**CRIT-03 · CI/CD: `VITE_API_BASE_URL` not passed as build-arg — frontend bakes in `localhost:8000` for all production deployments**

`frontend/Dockerfile` has `ARG VITE_API_BASE_URL` and uses it during `npm run build`. But `.github/workflows/deploy.yml` never sets this build arg when building the frontend image. The built frontend always uses `http://localhost:8000` as the API URL (the fallback in `api.ts`). Every user on production hits localhost in their browser and gets a network error.

**Fix in `.github/workflows/deploy.yml`** — add `build-args` to the frontend build step:
```yaml
- name: Build and push Frontend image
  uses: docker/build-push-action@v5
  with:
    context: ./frontend
    push: true
    tags: ${{ env.REGISTRY }}/${{ env.REPO_OWNER }}/uzaspea-frontend:latest
    labels: ${{ steps.meta-frontend.outputs.labels }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
    build-args: |
      VITE_API_BASE_URL=${{ secrets.VITE_API_BASE_URL }}
```

Add `VITE_API_BASE_URL` as a GitHub Actions secret (e.g. `http://13.xx.xx.xx` or your domain once you have one).

---

**CRIT-04 · Staff support-ticket and FAQ routes missing from `staff/api_urls.py` — staff panel ticket UI calls wrong endpoints and gets 404**

`StaffDashboardLayout.tsx` calls `GET /api/staff/support-tickets/` and the staff FAQ editor. But `staff/api_urls.py` has NO `support-ticket` or `faq` registration. The public `marketplace/urls.py` registers these, but those routes are `/api/support-tickets/` not `/api/staff/support-tickets/`. The staff panel makes calls to non-existent routes and gets 404s.

**Fix in `backend/staff/api_urls.py`:**
```python
from marketplace.api_views import SupportTicketViewSet, FAQViewSet

router.register(r'support-tickets', SupportTicketViewSet, basename='staff-support-ticket')
router.register(r'faq', StaffFAQViewSet, basename='staff-faq')
```

Also add `StaffFAQViewSet` to `staff/api_views.py`:
```python
from marketplace.models import FAQ, SupportTicket
from marketplace.serializers import FAQSerializer, SupportTicketSerializer

class StaffFAQViewSet(viewsets.ModelViewSet):
    """Staff: full CRUD on FAQ entries."""
    permission_classes = [IsStaffMember]
    queryset = FAQ.objects.all().order_by('category', 'order')
    serializer_class = FAQSerializer

class StaffSupportTicketViewSet(viewsets.ModelViewSet):
    """Staff: manage all support tickets."""
    permission_classes = [IsStaffMember]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        qs = SupportTicket.objects.all().order_by('-created_at')
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs
```

Update `staff/api_urls.py` to import `StaffSupportTicketViewSet` and `StaffFAQViewSet`.

---

**CRIT-05 · CI/CD: Deploy step has no health check — broken containers go live silently**

`deploy.yml` runs `docker compose -f docker-compose.prod.yml up -d` and exits. If the backend container crashes immediately (bad env var, migration failure, import error), the deploy "succeeds" from GitHub's perspective and the old container is replaced with a broken one. There's no smoke test or health check.

**Fix in `.github/workflows/deploy.yml`** — add health check to deploy step:
```yaml
script: |
    cd /home/ubuntu/uzaspea
    export GITHUB_USER=$(echo "$REPO_OWNER" | tr '[:upper:]' '[:lower:]')
    
    docker compose -f docker-compose.prod.yml pull
    docker compose -f docker-compose.prod.yml up -d
    docker image prune -f
    
    # Wait for backend to be healthy
    echo "Waiting for backend to start..."
    for i in $(seq 1 30); do
      if curl -sf http://localhost/api/site-settings/ > /dev/null 2>&1; then
        echo "✅ Backend healthy after ${i}×5s"
        break
      fi
      if [ $i -eq 30 ]; then
        echo "❌ Backend failed health check after 150s — rolling back"
        docker compose -f docker-compose.prod.yml rollback 2>/dev/null || true
        exit 1
      fi
      sleep 5
    done
```

---

#### 🟠 HIGH

---

**HIGH-01 · Messages have no real-time delivery — no WebSocket consumer for chat**

`MessagesPage.tsx` has no WebSocket connection. Messages are only fetched on mount. If Alice sends Bob a message, Bob only sees it when he manually refreshes the page. The `push_notification` helper creates a Notification record, but there's no live message delivery. This is especially problematic in a marketplace conversation context.

**Fix:** Add a message consumer to `marketplace/consumers.py`:
```python
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return
        self.group_name = f'chat_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'conversation_id': event['conversation_id'],
            'message': event['message'],
        }))
```

Add to `marketplace/routing.py`:
```python
re_path(r'ws/chat/$', ChatConsumer.as_asgi()),
```

In `ConversationViewSet.messages()` after creating the message, broadcast:
```python
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
channel_layer = get_channel_layer()
async_to_sync(channel_layer.group_send)(
    f'chat_{other.id}',
    {'type': 'chat.message', 'conversation_id': conv.id, 'message': MessageSerializer(msg).data}
)
```

**Frontend `MessagesPage.tsx`** — add WebSocket hook:
```tsx
useEffect(() => {
    if (!isAuthenticated) return;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/chat/`);
    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'chat_message' && data.conversation_id === parseInt(id || '0')) {
            setMessages(prev => [...prev, data.message]);
        }
    };
    return () => ws.close();
}, [id, isAuthenticated]);
```

---

**HIGH-02 · Dispute has no staff resolve/close action — disputes stuck forever**

`DisputeViewSet` has `perform_create` (buyer opens dispute) and the staff can see all disputes via `get_queryset`. But there is no `resolve` or `close` action. Staff cannot mark a dispute as resolved or add resolution notes. Disputes opened by buyers remain in `open` status permanently.

**Fix in `backend/marketplace/api_views.py` → `DisputeViewSet`:**
```python
@decorators.action(detail=True, methods=['post'], permission_classes=[IsStaffMember])
def resolve(self, request, pk=None):
    """Staff: resolve a dispute in favour of buyer or seller."""
    dispute = self.get_object()
    resolution = request.data.get('resolution')  # 'resolved_buyer' or 'resolved_seller'
    notes = request.data.get('notes', '')

    if resolution not in ['resolved_buyer', 'resolved_seller', 'closed']:
        return Response({'error': 'resolution must be resolved_buyer, resolved_seller, or closed'}, status=400)

    dispute.status = resolution
    dispute.resolution_notes = notes
    dispute.resolved_at = timezone.now()
    dispute.assigned_staff = request.user
    dispute.save()

    # If resolved in buyer's favour, transition order back to AWAITING_PAYMENT
    # If resolved in seller's favour, transition to COMPLETED
    if resolution == 'resolved_buyer':
        try:
            from .services import OrderStateMachine
            OrderStateMachine.transition_order(
                dispute.order, 'CANCELLED',
                notes=f'Dispute resolved in buyer favour by {request.user.username}. {notes}'
            )
        except ValueError:
            pass
    elif resolution == 'resolved_seller':
        try:
            from .services import OrderStateMachine
            OrderStateMachine.transition_order(
                dispute.order, 'COMPLETED',
                notes=f'Dispute resolved in seller favour by {request.user.username}. {notes}'
            )
        except ValueError:
            pass

    # Notify both parties
    push_notification(dispute.opened_by, 'order_status',
        f'Your dispute has been resolved',
        f'Resolution: {resolution.replace("_", " ").title()}. {notes}',
        f'/orders?highlight={dispute.order_id}')

    return Response({'status': dispute.status, 'notes': dispute.resolution_notes})
```

Also add dispute management to the **staff panel frontend** — a disputes table with resolve button.

---

**HIGH-03 · Buyer can open a conversation with themselves if they're also a seller**

`ConversationViewSet.create()` calls:
```python
Conversation.objects.get_or_create(buyer=request.user, seller_id=seller_id, product_id=product_id)
```
If `seller_id == request.user.id`, the user messages themselves. The conversation is created but both "buyer" and "seller" are the same person — messages from yourself to yourself.

**Fix:**
```python
def create(self, request, *args, **kwargs):
    seller_id = request.data.get('seller')
    if str(seller_id) == str(request.user.id):
        return Response({'error': 'Cannot message yourself.'}, status=400)
    # ... rest of create
```

---

**HIGH-04 · backup.sh has hardcoded `/home/bea/` path — crashes on server where user is `ubuntu`**

```bash
BACKUP_DIR=/home/bea/uzaspea/backups  # wrong
source /home/bea/uzaspea/backend/.env  # wrong
```

The Lightsail default user is `ubuntu`. These paths don't exist, so every scheduled backup fails silently.

**Fix in `scripts/backup.sh`:**
```bash
#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"  # auto-detect project root
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p "$BACKUP_DIR"

source "$PROJECT_DIR/backend/.env"

echo "[$DATE] Starting backup from $PROJECT_DIR..."
docker exec uzaspea-postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "[$DATE] Backup complete: db_$DATE.sql.gz"
```

---

**HIGH-05 · `remote_build.sh`, `remote_fix_env.sh`, `remote_launch.sh`, `remote_prep.sh`, `remote_restart.sh`, `remote_setup_docker.sh`, `remote_setup_swap.sh`, `upload_to_server.sh` — likely contain server IP, SSH keys, or credentials**

These scripts interact with the Lightsail server. If they hardcode the server IP, SSH key paths, or passwords, they leak infrastructure details to anyone who reads the repo. They should use environment variables or be git-ignored.

**Fix:** Review each script. Replace hardcoded IPs with `$SERVER_IP`, keys with `$SSH_KEY_PATH`. Add to `.gitignore` if they contain any secrets. Example:
```bash
SERVER_IP="${SERVER_IP:-}" 
if [ -z "$SERVER_IP" ]; then echo "Set SERVER_IP env var"; exit 1; fi
```

---

**HIGH-06 · `docker-compose.yml.bak` committed to repo — contains a copy of compose config that may diverge**

`docker-compose.yml.bak` in the repo root is a leftover backup file. It creates confusion about which compose file is authoritative and will diverge from the real one over time.

**Fix:** `git rm docker-compose.yml.bak && echo "*.bak" >> .gitignore`

---

#### 🟡 MEDIUM

---

**MED-01 · CI/CD: No automated tests run before deploy — broken code ships automatically**

The GitHub Actions workflow builds and deploys on every push to `main` with zero test execution. A Python syntax error, a missing import, or a broken migration will build successfully (Docker build doesn't run tests) and deploy to production.

**Fix:** Add a test job before `build-and-push`:
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: test_uzaspea
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: testpass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: --health-cmd "redis-cli ping" --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with: { python-version: '3.11' }
      - run: pip install -r backend/requirements.txt
      - run: |
          cd backend
          python manage.py check
          python manage.py test marketplace.tests inspections.tests staff.tests --verbosity=0
        env:
          DATABASE_URL: postgres://postgres:testpass@localhost:5432/test_uzaspea
          REDIS_URL: redis://localhost:6379/0
          DJANGO_SECRET_KEY: test-secret-key
          DJANGO_DEBUG: "True"

  build-and-push:
    needs: test  # only build if tests pass
    # ... rest unchanged
```

---

**MED-02 · `tests.py` is completely empty — zero test coverage on a live marketplace handling real money**

`backend/marketplace/tests.py` contains only `# Create your tests here.` — a Django scaffold comment. There are no tests anywhere in the codebase.

**Fix:** Write minimum viable test coverage for critical paths:
```python
# backend/marketplace/tests.py
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Category, Product, Order, LipaNumber, MobileNetwork, UserProfile
from decimal import Decimal

class AuthTests(TestCase):
    def test_register_success(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'testuser', 'email': 'test@test.com',
            'password': 'StrongPass123!', 'password2': 'StrongPass123!'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        self.assertIn('access', res.json())

    def test_register_weak_password_fails(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'testuser2', 'email': 't2@test.com',
            'password': 'abc', 'password2': 'abc'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 400)

class OrderTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user('buyer', 'b@test.com', 'BuyerPass123!')
        self.seller = User.objects.create_user('seller', 's@test.com', 'SellerPass123!')
        self.cat = Category.objects.create(name='Test', slug='test')
        self.product = Product.objects.create(
            name='Test Product', slug='test-product', price=Decimal('1000'),
            stock=5, seller=self.seller, category=self.cat, is_available=True
        )
        self.client = APIClient()
        token = RefreshToken.for_user(self.buyer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

    def test_order_decrements_stock(self):
        res = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 2}],
            'shipping_method': 'PICKUP', 'shipping_fee': 0,
            'delivery_info': {}
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

    def test_order_over_stock_rejected(self):
        res = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 10}],
            'shipping_method': 'PICKUP', 'shipping_fee': 0, 'delivery_info': {}
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_state_machine_invalid_transition(self):
        from .services import OrderStateMachine
        order = Order.objects.create(user=self.buyer, status='CART', shipping_method='PICKUP')
        with self.assertRaises(ValueError):
            OrderStateMachine.transition_order(order, 'COMPLETED')

class LipaNumberTests(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user('seller2', 'sl@test.com', 'SellerPass123!')
        self.network = MobileNetwork.objects.create(name='M-Pesa')
        self.client = APIClient()
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

    def test_seller_can_add_lipa_number(self):
        res = self.client.post('/api/lipa-numbers/', {
            'network': self.network.id, 'number': '0712345678', 'name': 'Test Account'
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['seller'], self.seller.id)
```

---

**MED-03 · `scripts/fix_compose.py` is a Python script in scripts/ — it likely modifies docker-compose files programmatically, which is risky**

This file wasn't in previous audits. Review it — if it modifies `docker-compose.yml` in-place, it could accidentally corrupt the production compose file.

**Fix:** Review the script. If it was a one-time fix, delete it. If it's ongoing, add documentation.

---

**MED-04 · No `DJANGO_ALLOWED_HOSTS` includes the Lightsail IP — Django rejects requests with a 400 Bad Request**

`settings.py` reads `ALLOWED_HOSTS` from env, defaulting to `localhost,127.0.0.1`. In production without a domain, requests hit the Lightsail IP directly. If `DJANGO_ALLOWED_HOSTS` in `.env` doesn't include the public IP, Django rejects all requests from Traefik (which forwards the real `Host` header).

**Fix:** In `backend/.env` on the server:
```
DJANGO_ALLOWED_HOSTS=<lightsail-ip>,localhost,127.0.0.1
```
Or (more robust): use Traefik to strip/replace the Host header, or add `ALLOWED_HOSTS = ['*']` only when `DEBUG=False` and behind a reverse proxy (acceptable since Traefik is the gatekeeper).

Better setting:
```python
# In settings.py — append this when behind a trusted proxy:
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
if not DEBUG:
    ALLOWED_HOSTS.append('*')  # Traefik validates the Host before it reaches Django
```

---

**MED-05 · `push_notification()` swallows ALL exceptions from Channel Layer — hides Redis connectivity issues**

```python
try:
    async_to_sync(channel_layer.group_send)(...)
except Exception:
    pass
```

If Redis goes down mid-session, all notifications silently fail. Operators have no way to know notifications aren't being delivered. At minimum, log the error.

**Fix in `backend/marketplace/models.py`:**
```python
import logging
logger = logging.getLogger(__name__)

def push_notification(user, notification_type, title, message, link=''):
    n = Notification.objects.create(...)
    channel_layer = get_channel_layer()
    try:
        async_to_sync(channel_layer.group_send)(...)
    except Exception as e:
        logger.warning(f'push_notification WS broadcast failed for user {user.id}: {e}')
        # Notification DB record still exists — user sees it on next page load
    return n
```

---

**MED-06 · `OrderSerializer.create()` doesn't push a notification to the seller on new order**

When a buyer places an order, the seller has no real-time signal. The seller's dashboard only updates when they manually refresh. With `push_notification` available, this is a one-line addition.

**Fix in `backend/marketplace/serializers.py` → `OrderSerializer.create()`** — after `order.save()`:
```python
# Notify sellers
from .models import push_notification
seller_ids = set()
for item in order.orderitem_set.select_related('product__seller'):
    if item.product.seller_id not in seller_ids:
        seller_ids.add(item.product.seller_id)
        push_notification(
            item.product.seller, 'order_status',
            'New Order Received!',
            f'Order #{order.id} — {item.product.name} × {item.quantity}',
            f'/dashboard/orders'
        )
```

---

**MED-07 · No HTTPS / domain still — all traffic including JWT tokens in cleartext**

The HTTPS section of `docker-compose.yml` and `docker-compose.prod.yml` is still commented out. Without a domain and TLS, JWT tokens (which grant full account access), payment proof images, and personal data travel in plaintext.

This isn't a code bug — it's an operational priority. Get a domain and enable the Let's Encrypt config already prepared in the compose files.

---

**MED-08 · `docker-compose.prod.yml` has `image: ghcr.io/${GITHUB_USER}/...` but frontend service has no `depends_on` for db/redis healthchecks**

The `frontend` service in `docker-compose.prod.yml` only has `depends_on: backend`. But `backend` itself depends on `db` and `redis`. If the frontend starts before the backend is healthy (which is possible since `backend` isn't a healthcheck-capable service), nginx might start routing to a non-ready backend.

The actual risk is low (Traefik buffers requests), but the compose structure should be consistent.

---

#### 🟢 LOW

---

**LOW-01 · No `GITHUB_USER` secret — `docker-compose.prod.yml` fails without it**

`docker-compose.prod.yml` uses `${GITHUB_USER}` in image names. The deploy script exports it from `$REPO_OWNER`, but if run manually without that env var, docker-compose fails with an empty image name. Add a `.env.prod.example` documenting this.

**Fix:** Add to `.env.example`:
```
# Required for docker-compose.prod.yml
GITHUB_USER=your-github-username-lowercase
```

---

**LOW-02 · `scripts/remote_*.sh` and `upload_to_server.sh` are committed to public repo**

These operational scripts work fine locally but their presence in the public repo means any contributor can see the deployment workflow, server structure, and potentially SSH patterns. If any of them hardcode the server IP or key path, this is a medium security issue.

**Fix:** Add `scripts/remote_*.sh` to `.gitignore` OR review each one and ensure they contain no secrets, only parameterized commands.

---

**LOW-03 · `SupportTicket.user` is nullable (anonymous submissions ok) but `SupportTicketViewSet.get_queryset()` filters `filter(user=self.request.user)` for non-staff — authenticated users can't see tickets they submitted anonymously**

A user who submitted a ticket while logged out, then logs in, cannot see their ticket. This is an edge case but worth fixing.

**Fix:** For authenticated users, also filter by email:
```python
def get_queryset(self):
    user = self.request.user
    if user.is_staff:
        return SupportTicket.objects.all().order_by('-created_at')
    return SupportTicket.objects.filter(
        Q(user=user) | Q(email=user.email)
    ).order_by('-created_at')
```

---

**LOW-04 · Celery beat schedule file path creates a directory conflict**

`celery-beat` uses `--schedule /app/celerybeat/celerybeat-schedule`. The volume mounts `./persistent_data/celerybeat:/app/celerybeat`. If `persistent_data/celerybeat/` doesn't exist on the server when the container starts, Docker creates it as a directory — and then `celerybeat-schedule` is the filename inside it. This is fine IF the directory exists. But on a fresh server clone, `persistent_data/celerybeat/` may not exist.

**Fix:** Add to `scripts/remote_launch.sh` or the deploy script:
```bash
mkdir -p persistent_data/celerybeat persistent_data/media persistent_data/static persistent_data/redis
```

---

## PART 2 — MASTER AGENT PROMPT v7

```
You are a senior Django/React/DevOps engineer. Fix every item below in priority order. No new features beyond what's listed. Add # FIX [ID] comment on changed lines. After all fixes: python manage.py check (zero errors), npm run build (zero TypeScript errors), docker compose config (valid YAML).
```

---

### CRIT-01 — Fix delivery zone field name mismatch in CheckoutPage

**File: `frontend/src/pages/CheckoutPage.tsx`**

Find every occurrence of `zone.fee` and `zone.name` in the delivery zone context and replace:

```tsx
// Line ~36 — shipping fee calculation:
// BEFORE:
(selectedZone ? Number(selectedZone.fee) : 0)
// AFTER:
(selectedZone ? Number(selectedZone.delivery_fee) : 0)

// Line ~153 — option label:
// BEFORE:
{zone.name} — TSh {Number(zone.fee).toLocaleString()}
// AFTER:
{zone.zone_name} — TSh {Number(zone.delivery_fee).toLocaleString()}
```

Also verify `zone.estimated_days` and `zone.notes` field names match the serializer output (they should already be correct).

---

### CRIT-02 — Fix ProductVariantViewSet permissions and queryset

**File: `backend/marketplace/api_views.py` → `ProductVariantViewSet`**

Replace the entire class:
```python
class ProductVariantViewSet(viewsets.ModelViewSet):
    """FIX CRIT-02: public read for buyers, auth required for seller write."""
    serializer_class = ProductVariantSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        product_id = self.request.query_params.get('product')
        user = self.request.user

        if product_id:
            # Public: any visitor can see variants for a product
            qs = ProductVariant.objects.filter(
                product_id=product_id
            ).select_related('product')
            # Non-staff non-owners only see available variants
            if not (user.is_authenticated and (user.is_staff or
                    ProductVariant.objects.filter(product_id=product_id, product__seller=user).exists())):
                qs = qs.filter(is_available=True)
            return qs

        if user.is_authenticated:
            if user.is_staff:
                return ProductVariant.objects.all().select_related('product')
            return ProductVariant.objects.filter(product__seller=user).select_related('product')

        return ProductVariant.objects.none()

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        if product.seller != self.request.user and not self.request.user.is_staff:
            raise serializers.ValidationError('You do not own this product.')
        serializer.save()
```

---

### CRIT-03 — Fix CI/CD: pass VITE_API_BASE_URL as build-arg

**File: `.github/workflows/deploy.yml`**

In the "Build and push Frontend image" step, add `build-args`:
```yaml
- name: Build and push Frontend image
  uses: docker/build-push-action@v5
  with:
    context: ./frontend
    push: true
    tags: ${{ env.REGISTRY }}/${{ env.REPO_OWNER }}/uzaspea-frontend:latest
    labels: ${{ steps.meta-frontend.outputs.labels }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
    build-args: |
      VITE_API_BASE_URL=${{ secrets.VITE_API_BASE_URL }}
```

**Action:** Add `VITE_API_BASE_URL` to GitHub repo secrets (Settings → Secrets → Actions). Value: your Lightsail IP or domain, e.g. `http://13.xx.xx.xx`.

---

### CRIT-04 — Add staff support-ticket and FAQ routes

**File: `backend/staff/api_views.py`** — add at the bottom:
```python
from marketplace.models import FAQ, SupportTicket
from marketplace.serializers import FAQSerializer, SupportTicketSerializer
from django.utils import timezone as tz

class StaffFAQViewSet(viewsets.ModelViewSet):
    """FIX CRIT-04: staff full CRUD on FAQ entries."""
    permission_classes = [IsStaffMember]
    queryset = FAQ.objects.all().order_by('category', 'order')
    serializer_class = FAQSerializer

class StaffSupportTicketViewSet(viewsets.ModelViewSet):
    """FIX CRIT-04: staff manage all support tickets."""
    permission_classes = [IsStaffMember]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        qs = SupportTicket.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @decorators.action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = 'resolved'
        ticket.assigned_to = request.user
        ticket.staff_notes = request.data.get('notes', '')
        ticket.resolved_at = tz.now()
        ticket.save()
        return Response({'status': 'resolved'})
```

**File: `backend/staff/api_urls.py`** — add imports and registrations:
```python
from .api_views import (
    StaffProfileViewSet, TaskCategoryViewSet, TaskViewSet,
    TaskActionViewSet, ApprovalViewSet, AuditLogViewSet,
    StaffPermissionViewSet, StaffDashboardView, SponsoredListingReviewViewSet,
    StaffAdminDashboardView, StaffFAQViewSet, StaffSupportTicketViewSet  # FIX CRIT-04
)

# Add to router:
router.register(r'faq', StaffFAQViewSet, basename='staff-faq')  # FIX CRIT-04
router.register(r'support-tickets', StaffSupportTicketViewSet, basename='staff-support-ticket')  # FIX CRIT-04
```

**Frontend: `StaffDashboardLayout.tsx`** — update the ticket API call URL:
```tsx
// BEFORE:
api.get(`/api/staff/support-tickets/?status=${statusFilter}`)
// AFTER (already correct if staff URLs are registered):
api.get(`/api/staff/support-tickets/?status=${statusFilter}`)
// Also update PATCH call:
api.patch(`/api/staff/support-tickets/${id}/`, { status })
```

---

### CRIT-05 — Add health check to CI/CD deploy

**File: `.github/workflows/deploy.yml`** — replace the deploy script block:
```yaml
script: |
    cd /home/ubuntu/uzaspea
    export GITHUB_USER=$(echo "$REPO_OWNER" | tr '[:upper:]' '[:lower:]')
    
    # Ensure data directories exist
    mkdir -p persistent_data/celerybeat persistent_data/media persistent_data/static persistent_data/redis
    
    # Pull new images and bring up
    docker compose -f docker-compose.prod.yml pull
    docker compose -f docker-compose.prod.yml up -d
    docker image prune -f
    
    # Health check: wait up to 90s for backend to respond
    echo "Waiting for backend health check..."
    HEALTHY=false
    for i in $(seq 1 18); do
      if curl -sf --max-time 5 http://localhost/api/site-settings/ > /dev/null 2>&1; then
        echo "✅ Backend healthy (attempt $i)"
        HEALTHY=true
        break
      fi
      echo "⏳ Attempt $i/18 — waiting 5s..."
      sleep 5
    done
    
    if [ "$HEALTHY" = false ]; then
      echo "❌ Backend failed health check — showing logs:"
      docker compose -f docker-compose.prod.yml logs --tail=50 backend
      exit 1
    fi
    
    echo "🚀 Deployment complete"
```

---

### HIGH-01 — Add real-time WebSocket for messages

**File: `backend/marketplace/consumers.py`** — add `ChatConsumer` class:
```python
class ChatConsumer(AsyncWebsocketConsumer):
    """FIX HIGH-01: real-time message delivery via WebSocket."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            # Try token from query string
            qs = parse_qs(self.scope.get('query_string', b'').decode())
            token = qs.get('token', [None])[0]
            if token:
                user = await self._get_user_from_token(token)
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return
        self.user = user
        self.group_name = f'chat_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'conversation_id': event['conversation_id'],
            'message': event['message'],
        }))

    @database_sync_to_async
    def _get_user_from_token(self, token):
        try:
            from rest_framework_simplejwt.tokens import UntypedToken
            from rest_framework_simplejwt.authentication import JWTAuthentication
            UntypedToken(token)
            auth = JWTAuthentication()
            validated = auth.get_validated_token(token)
            return auth.get_user(validated)
        except Exception:
            return None
```

**File: `backend/marketplace/routing.py`** — add route:
```python
from .consumers import OrderTrackingConsumer, ChatConsumer  # FIX HIGH-01

websocket_urlpatterns = [
    re_path(r'ws/tracking/(?P<order_id>[^/]+)/$', OrderTrackingConsumer.as_asgi()),
    re_path(r'ws/chat/$', ChatConsumer.as_asgi()),  # FIX HIGH-01
]
```

**File: `backend/marketplace/api_views.py` → `ConversationViewSet.messages()`** — after `conv.save()`:
```python
# FIX HIGH-01: broadcast message to recipient's chat WebSocket
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
channel_layer = get_channel_layer()
if channel_layer:
    try:
        async_to_sync(channel_layer.group_send)(
            f'chat_{other.id}',
            {
                'type': 'chat.message',
                'conversation_id': conv.id,
                'message': MessageSerializer(msg).data,
            }
        )
    except Exception:
        pass  # DB record still exists; user sees it on next load
```

**File: `frontend/src/pages/MessagesPage.tsx`** — add WebSocket:
```tsx
// FIX HIGH-01: real-time message delivery
useEffect(() => {
    if (!id || !localStorage.getItem('access_token')) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('access_token');
    const wsUrl = `${proto}://${window.location.host}/ws/chat/?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'chat_message' && data.conversation_id === parseInt(id)) {
            setMessages(prev => {
                // Avoid duplicate if already in list
                if (prev.some((m: any) => m.id === data.message.id)) return prev;
                return [...prev, data.message];
            });
        }
    };

    return () => { ws.close(); };
}, [id]);
```

---

### HIGH-02 — Add dispute resolve action for staff

**File: `backend/marketplace/api_views.py` → `DisputeViewSet`** — add:
```python
@decorators.action(detail=True, methods=['post'], permission_classes=[IsStaffMember])
def resolve(self, request, pk=None):
    """FIX HIGH-02: staff can resolve disputes."""
    dispute = self.get_object()
    if dispute.status not in ['open', 'under_review']:
        return Response({'error': 'Dispute is already resolved.'}, status=400)

    resolution = request.data.get('resolution')
    notes = request.data.get('notes', '')

    if resolution not in ['resolved_buyer', 'resolved_seller', 'closed']:
        return Response({'error': 'resolution must be: resolved_buyer, resolved_seller, or closed'}, status=400)

    dispute.status = resolution
    dispute.resolution_notes = notes
    dispute.resolved_at = timezone.now()
    dispute.assigned_staff = request.user
    dispute.save(update_fields=['status', 'resolution_notes', 'resolved_at', 'assigned_staff'])

    # Transition order based on resolution
    from .services import OrderStateMachine
    if resolution == 'resolved_buyer':
        try:
            OrderStateMachine.transition_order(
                dispute.order, 'CANCELLED',
                notes=f'Dispute resolved in buyer favour by {request.user.username}. {notes}'
            )
        except ValueError:
            pass
    elif resolution == 'resolved_seller':
        try:
            OrderStateMachine.transition_order(
                dispute.order, 'COMPLETED',
                notes=f'Dispute resolved in seller favour by {request.user.username}. {notes}'
            )
        except ValueError:
            pass

    # Notify buyer
    push_notification(
        dispute.opened_by, 'order_status',
        'Dispute Resolution',
        f'Your dispute has been resolved: {resolution.replace("_", " ").title()}. {notes}',
        f'/orders?highlight={dispute.order_id}'
    )

    return Response({'status': dispute.status, 'resolution_notes': dispute.resolution_notes})

@decorators.action(detail=True, methods=['post'], permission_classes=[IsStaffMember])
def assign(self, request, pk=None):
    """FIX HIGH-02: staff assign dispute to themselves."""
    dispute = self.get_object()
    dispute.assigned_staff = request.user
    dispute.status = 'under_review'
    dispute.save(update_fields=['assigned_staff', 'status'])
    return Response({'status': dispute.status, 'assigned_staff': request.user.username})
```

**Staff panel frontend** — add a Disputes table in `StaffDashboardLayout.tsx`:
```tsx
const DisputesManager: React.FC = () => {
    const [disputes, setDisputes] = useState<any[]>([]);
    const [filter, setFilter] = useState('open');

    useEffect(() => {
        api.get(`/api/disputes/?status=${filter}`)
            .then(r => setDisputes(r.data.results || r.data)).catch(() => {});
    }, [filter]);

    const handleResolve = async (id: number, resolution: string) => {
        const notes = prompt('Resolution notes (optional):') || '';
        await api.post(`/api/disputes/${id}/resolve/`, { resolution, notes });
        setDisputes(prev => prev.filter(d => d.id !== id));
        toast.success('Dispute resolved');
    };

    return (
        <div>
            <h3 className="text-xl font-bold mb-4">Disputes</h3>
            {['open', 'under_review', 'resolved_buyer', 'resolved_seller'].map(s => (
                <button key={s} onClick={() => setFilter(s)}
                    className={`mr-2 text-xs px-3 py-1 rounded-full font-bold ${filter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {s.replace(/_/g, ' ')}
                </button>
            ))}
            <div className="mt-4 space-y-3">
                {disputes.map(d => (
                    <div key={d.id} className="card p-4">
                        <p className="font-bold">Order #{d.order} — {d.opened_by_username}</p>
                        <p className="text-sm text-gray-600 mt-1">{d.reason}</p>
                        {d.status === 'open' && (
                            <div className="flex gap-2 mt-3">
                                <button onClick={() => handleResolve(d.id, 'resolved_buyer')}
                                    className="btn-ghost text-xs text-blue-600">Favour Buyer</button>
                                <button onClick={() => handleResolve(d.id, 'resolved_seller')}
                                    className="btn-ghost text-xs text-green-600">Favour Seller</button>
                                <button onClick={() => handleResolve(d.id, 'closed')}
                                    className="btn-ghost text-xs text-gray-500">Close</button>
                            </div>
                        )}
                    </div>
                ))}
                {disputes.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No {filter} disputes</p>}
            </div>
        </div>
    );
};
```

---

### HIGH-03 — Prevent buyer messaging themselves

**File: `backend/marketplace/api_views.py` → `ConversationViewSet.create()`:**
```python
def create(self, request, *args, **kwargs):
    seller_id = request.data.get('seller')
    product_id = request.data.get('product')

    # FIX HIGH-03: prevent self-messaging
    if str(seller_id) == str(request.user.id):
        return Response({'error': 'You cannot send a message to yourself.'}, status=400)

    conv, _ = Conversation.objects.get_or_create(
        buyer=request.user, seller_id=seller_id, product_id=product_id
    )
    return Response(ConversationSerializer(conv, context={'request': request}).data)
```

---

### HIGH-04 — Fix backup.sh hardcoded path

**File: `scripts/backup.sh`** — replace entirely:
```bash
#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p "$BACKUP_DIR"

if [ -f "$PROJECT_DIR/backend/.env" ]; then
    source "$PROJECT_DIR/backend/.env"
fi

DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-uzaspea}"

echo "[$DATE] Starting backup from $PROJECT_DIR..."
docker exec uzaspea-postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "[$DATE] Backup complete: db_$DATE.sql.gz ($(du -sh "$BACKUP_DIR/db_$DATE.sql.gz" | cut -f1))"
```

---

### HIGH-05 — Review and sanitize remote scripts

Review each file in `scripts/remote_*.sh` and `scripts/upload_to_server.sh`:
1. Replace any hardcoded IP with `${SERVER_IP:?SERVER_IP not set}`
2. Replace any hardcoded username with `${SERVER_USER:-ubuntu}`
3. Replace any hardcoded key paths with `${SSH_KEY:-~/.ssh/id_rsa}`
4. Add `.gitignore` entry: `scripts/remote_*.sh` if they contain irreducible secrets

---

### HIGH-06 — Remove docker-compose.yml.bak

```bash
git rm docker-compose.yml.bak
echo "*.bak" >> .gitignore
git commit -m "cleanup: remove .bak file, add *.bak to gitignore"
```

---

### MED-01 — Add test job to CI/CD pipeline

**File: `.github/workflows/deploy.yml`** — add test job before build-and-push:
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: test_uzaspea
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: testpass123
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 3s
          --health-retries 5
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with: { python-version: '3.11' }
      - name: Install dependencies
        run: pip install -r backend/requirements.txt
      - name: Run Django checks and tests
        working-directory: ./backend
        env:
          DATABASE_URL: postgres://postgres:testpass123@localhost:5432/test_uzaspea
          REDIS_URL: redis://localhost:6379/0
          DJANGO_SECRET_KEY: ci-test-secret-key-not-for-production
          DJANGO_DEBUG: "True"
          DJANGO_ALLOWED_HOSTS: localhost,127.0.0.1
        run: |
          python manage.py check
          python manage.py test marketplace staff inspections --verbosity=1

  build-and-push:
    needs: test  # blocks build if tests fail
    # ... rest unchanged
```

---

### MED-02 — Write minimum test suite

**File: `backend/marketplace/tests.py`** — replace with tests from the findings section above (AuthTests, OrderTests, LipaNumberTests). These are the critical paths that must pass on every deploy.

---

### MED-03 — Delete or document scripts/fix_compose.py

```bash
# If it was a one-time fix, delete it:
git rm scripts/fix_compose.py
git commit -m "cleanup: remove one-time fix script"
```

---

### MED-04 — Fix ALLOWED_HOSTS for production without domain

**File: `backend/uzachuo/settings.py`** — add after the ALLOWED_HOSTS line:
```python
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# FIX MED-04: when behind a trusted reverse proxy (Traefik), Django can trust all hosts
# Traefik is the gatekeeper — it validates the Host header before requests reach Django
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
if not DEBUG and '*' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('*')  # safe — Traefik validates Host; Django just processes the request
```

---

### MED-05 — Add logging to push_notification

**File: `backend/marketplace/models.py`** → `push_notification()`:
```python
import logging
logger = logging.getLogger(__name__)  # FIX MED-05: add at top of file

def push_notification(user, notification_type, title, message, link=''):
    n = Notification.objects.create(
        user=user, notification_type=notification_type,
        title=title, message=message, link=link
    )
    channel_layer = get_channel_layer()
    try:
        async_to_sync(channel_layer.group_send)(
            f'notifications_{user.id}',
            {'type': 'notification.push', 'notification': {
                'id': n.id, 'type': notification_type,
                'title': title, 'message': message, 'link': link,
            }}
        )
    except Exception as e:
        logger.warning(f'WS notification broadcast failed for user {user.id}: {e}')  # FIX MED-05
    return n
```

---

### MED-06 — Notify seller on new order

**File: `backend/marketplace/serializers.py`** → `OrderSerializer.create()` — after `order.save(update_fields=['total_amount'])`:
```python
# FIX MED-06: notify sellers of new order
try:
    from .models import push_notification
    seller_ids_notified = set()
    for item in order.orderitem_set.select_related('product__seller'):
        if item.product.seller_id not in seller_ids_notified:
            seller_ids_notified.add(item.product.seller_id)
            push_notification(
                item.product.seller,
                'order_status',
                '🛍️ New Order!',
                f'Order #{order.id} — {item.product.name} × {item.quantity} — TSh {int(item.subtotal()):,}',
                '/dashboard/orders'
            )
except Exception:
    pass  # never block order creation for notification failure
```

---

### LOW-01 — Document GITHUB_USER in .env.example

**File: `backend/.env.example`** — add:
```env
# Required when using docker-compose.prod.yml
GITHUB_USER=your-github-username-lowercase
```

---

### LOW-02 — Fix SupportTicket anonymous ticket retrieval

**File: `backend/marketplace/api_views.py`** → `SupportTicketViewSet.get_queryset()`:
```python
def get_queryset(self):
    user = self.request.user
    if user.is_staff:
        qs = SupportTicket.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs
    # FIX LOW-02: also match by email for anonymous-then-logged-in users
    return SupportTicket.objects.filter(
        Q(user=user) | Q(email=user.email)
    ).order_by('-created_at')
```

---

### FINAL VERIFICATION SEQUENCE

```bash
# Backend
cd backend
python manage.py check                  # zero errors
python manage.py test --verbosity=1     # all tests pass

# Frontend
cd ../frontend
npm run build                           # zero TypeScript errors

# Docker
cd ..
docker compose config                   # valid YAML
docker compose build --no-cache        # clean build
docker compose up -d
curl http://localhost/api/site-settings/   # 200
curl http://localhost/api/variants/?product=1  # 200 (no auth needed)

# Variants accessible without login:
curl http://localhost/api/variants/?product=112  # 200

# Staff ticket route works:
curl -H "Authorization: Bearer $STAFF_JWT" http://localhost/api/staff/support-tickets/  # 200

# Dispute resolve works:
curl -X POST -H "Authorization: Bearer $STAFF_JWT" \
  http://localhost/api/disputes/1/resolve/ \
  -d '{"resolution":"resolved_buyer","notes":"Item not delivered"}' \
  -H "Content-Type: application/json"  # 200

# WS chat connects:
# Open browser console: new WebSocket('ws://localhost/ws/chat/?token=<jwt>')  # 101

# CI health check: push to main → watch Actions → deploy job shows ✅ Backend healthy
```
