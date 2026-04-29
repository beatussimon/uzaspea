# UZASPEA — AUDIT v5 · Scorecard + Master Agent Prompt

---

## PART 1 — SCORECARD

### RATING: 72/100 — Best commit yet. Real progress. Not production-ready yet.

---

### What's Fixed ✅ (cumulative across all runs)

| Category | Fixed |
|---|---|
| LipaNumber has seller FK | ✅ |
| Order highlights on redirect | ✅ |
| Promoted products is a real grid | ✅ |
| Recharts fixed pixel heights | ✅ |
| Settings page exists and wired | ✅ |
| Help & Support page exists | ✅ |
| Follow API (follow/unfollow/status) | ✅ |
| FAQ + SupportTicket models | ✅ |
| Change password endpoint | ✅ |
| tier default = 'free' | ✅ |
| InspectionCategory → marketplace_category link | ✅ |
| Seed inspections comprehensive (264 lines) | ✅ |
| CategorySerializer depth guard | ✅ |
| SubscriptionForm correct model (C-14) | ✅ |
| Ghost models_subscription.py deleted | ✅ |
| is_verified + tier read_only on serializer | ✅ |
| L14 subtotal math fixed | ✅ |
| L15 self-transition removed | ✅ |
| L18 assigned_to writable | ✅ |
| L19 revenue only counts paid orders | ✅ |
| L20 WS exponential backoff | ✅ |
| S18 api.ts uses env var | ✅ |
| S17 sellers see own unavailable products | ✅ |
| .dockerignore both frontend+backend | ✅ |
| dj-database-url + psycopg2 in requirements | ✅ |
| DATABASES from env | ✅ |
| CHANNEL_LAYERS Redis from env | ✅ |
| Celery worker + beat in compose | ✅ |
| Redis healthcheck in compose | ✅ |
| env_file path correct | ✅ |
| SECURITY headers (HSTS, SSL, XFrame) | ✅ |
| SESSION_COOKIE_SECURE from DEBUG | ✅ |
| npm ci in frontend Dockerfile | ✅ |
| nginx.conf with SPA routing | ✅ |
| frontend nginx in compose | ✅ |
| PaymentNumbersManager in dashboard | ✅ |
| DashboardLayout routes wired | ✅ |

---

### Still Broken / Missing ❌

**CODE BUGS (unfixed or new)**

| ID | File | Issue |
|----|------|-------|
| B-01 | docker-compose.yml | backend service uses `gunicorn wsgi` — WebSockets DEAD in production. Only `websocket` service uses daphne. But `/api/` calls go through gunicorn which can't handle WS. The problem: if a buyer is on the order page and triggers a WS update, it hits gunicorn and fails. ALL WebSocket connections must go through the daphne container. |
| B-02 | docker-compose.yml | Traefik `--api.insecure=true` exposes the admin dashboard publicly on port 8081. Anyone on the internet can access your full routing config, TLS status, and service map. |
| B-03 | docker-compose.yml | Jaeger ports `16686`, `4317`, `4318`, `9411` all exposed to public internet. Jaeger has no auth. Anyone can query your full request traces, which leak internal service names, URLs, query params, and timings. |
| B-04 | docker-compose.yml | Self-signed certs in `./certs/cert.pem` + `key.pem` committed to repo. Browsers will reject these. Let's Encrypt or real certs needed. |
| B-05 | docker-compose.yml | Traefik routes `/api` to `backend` (gunicorn) and `/ws` to `websocket` (daphne). But `/api/` also needs WebSocket fallback for long-polling. Also: the gunicorn backend has no `websocket` label — if someone hits `/ws/` without Traefik routing it correctly, they get a 502. |
| B-06 | settings.py | `WHITENOISE_STORAGE` not configured for compression. WhiteNoise is installed but static files are served uncompressed. Add `STORAGES` with `whitenoise.storage.CompressedManifestStaticFilesStorage`. |
| B-07 | marketplace/models.py | All `ImageField` uploads have no size validation, no dimension validation, no format restriction. A user can upload a 50MB TIFF. Add `validate_image_size` validator. |
| B-08 | marketplace/api_views.py | Zero rate limiting on any endpoint. Registration, login, support ticket creation, order creation — all hammerable. DDoS / abuse surface is wide open. |
| B-09 | marketplace/serializers.py | `UserProfileSerializer` `is_verified` and `tier` are `read_only` — correct. BUT `UserProfileViewSet` still uses `get_permissions` that only requires `IsAuthenticated` for update. The `IsOwnerOrStaff` permission class is referenced but may not exist in `permissions.py`. Verify it exists. |
| B-10 | permissions.py | `IsStaffMember` still has bare `except:` — catches `SystemExit` and `KeyboardInterrupt`. |
| B-11 | marketplace/models.py | No `Notification` model for in-app notification inbox. `InspectionNotification` exists for inspections but there's nothing for marketplace events (order status, new follower, new review, payment confirmed). |
| B-12 | marketplace/models.py | No `Message`/`Conversation` model for buyer-seller chat. |
| B-13 | marketplace/models.py | No `SavedSearch`/`PriceAlert` model. |
| B-14 | marketplace/models.py | No `SellerRating` model (aggregate from product reviews per seller). |
| B-15 | marketplace/models.py | No `Dispute` model + no `DISPUTED` state in `OrderStateMachine`. |
| B-16 | marketplace/models.py | No `ProductVariant` model (size, color, stock per variant). |
| B-17 | marketplace/api_views.py | No Postgres full-text search — search is `name__icontains` only. |
| B-18 | marketplace/models.py | No `SiteSettings` model for company contact info (phone, address, email) — HelpCenterPage has these hardcoded. |
| B-19 | frontend/src/components/ProductCard.tsx | No "Inspected ✓" badge shown when product has a published inspection report. |
| B-20 | frontend/src/pages/ProfilePage.tsx | Follow UI still missing — follow button, follower/following counts not shown. API exists but frontend not wired. |
| B-21 | marketplace/models.py | `Order.SHIPPING_CHOICES` has DELIVERY and PICKUP but no zone-based delivery fee calculation. Seller sets no delivery zones or fees. Fee is manual field only. |
| B-22 | frontend/src/pages/dashboard/DashboardLayout.tsx | Seller dashboard has no "Delivery Zones" management — sellers can't define where they deliver and what they charge per zone. |
| B-23 | frontend/src/pages/dashboard/SettingsPage.tsx | Currency preference (TZS/USD) setting does not exist yet — was requested as a feature. No `preferred_currency` on UserProfile. |
| B-24 | marketplace/api_views.py | No `GET /api/products/?following=true` filter for "feed from followed sellers". Follow API exists, product filter not wired. |
| B-25 | inspections/api_views.py | `suggest` endpoint for inspection categories referenced in prompt but not confirmed implemented. |
| B-26 | marketplace/tasks.py | Celery tasks exist but `check_expirations` is a management command, not a Celery periodic task. It won't run via celery-beat. |
| B-27 | frontend | No real-time notification bell/inbox UI. |
| B-28 | inspections frontend | Inspector mobile workflow has `InspectorLayout.tsx` but no dedicated check-in → checklist → evidence → submit flow. |
| B-29 | staff panel | No staff UI for managing SupportTickets or FAQ entries. |
| B-30 | frontend | No `PublicVerifyPage` component for `/verify/:inspection_id` route (referenced in App.tsx but may not exist). |

**DEVOPS / DEVSEC**

| ID | Issue |
|----|-------|
| D-01 | Gunicorn in backend service CMD — WebSockets completely dead for HTTP API container |
| D-02 | Traefik dashboard exposed publicly (--api.insecure=true + port 8081) |
| D-03 | Jaeger ports exposed to internet (no auth, leaks traces) |
| D-04 | Self-signed certs committed to repo — browsers reject, meaningless security |
| D-05 | WhiteNoise compression not configured |
| D-06 | No image upload size validation |
| D-07 | No rate limiting anywhere |
| D-08 | check_expirations not wired as Celery periodic task |
| D-09 | `traefik_dynamic.yml` only handles TLS certs, no middleware for auth on Traefik dashboard |

---

## PART 2 — MASTER AGENT FIX PROMPT v5

```
You are a senior Django/React/DevOps/DevSecOps engineer. Fix every item below exactly. No partial work. Add # FIX [ID] comment on changed lines. After all fixes: python manage.py check (zero errors), npm run build (zero TS errors), docker compose config (valid). Items are ordered by severity.
```

---

### D-01 — Fix backend service to use Uvicorn not Gunicorn (CHANGED: Uvicorn instead of Daphne)

The `backend` service in `docker-compose.yml` must run **Uvicorn** — a high-performance ASGI server that handles both HTTP and WebSocket natively. The separate `websocket` service is redundant. Merge them into one Uvicorn service. Uvicorn is faster than Daphne, supports uvloop for performance, and scales with `--workers`.

**`backend/requirements.txt`** — add uvicorn, remove gunicorn:
```
uvicorn[standard]==0.34.0
# REMOVE: gunicorn==24.1.1
```

**`docker-compose.yml`** — replace `backend` and `websocket` services:
```yaml
  backend:
    <<: *backend-common
    container_name: uzaspea-backend
    volumes:
      - ./persistent_data/media:/app/media
      - ./persistent_data/static:/app/staticfiles
    command: >
      sh -c "python manage.py migrate --noinput &&
             python manage.py collectstatic --noinput &&
             uvicorn uzachuo.asgi:application --host 0.0.0.0 --port 8000 --workers 3 --ws websockets"
    # FIX D-01: uvicorn handles both HTTP and WebSocket — single server, scalable
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=PathPrefix(`/api`) || PathPrefix(`/admin`) || PathPrefix(`/media`) || PathPrefix(`/static`) || PathPrefix(`/ws`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls=true"
      - "traefik.http.services.backend.loadbalancer.server.port=8000"
```

Delete the entire `websocket:` service block.

Also fix `backend/Dockerfile` CMD:
```dockerfile
CMD ["uvicorn", "uzachuo.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--workers", "3", "--ws", "websockets"]
# FIX D-01: uvicorn not gunicorn — handles HTTP + WebSocket
```

---

### D-02 — Secure Traefik dashboard via ForwardAuth (CHANGED: kept enabled, gated behind superuser JWT)

Instead of disabling the dashboard, we **keep it enabled** but gate it behind Traefik ForwardAuth middleware. A Django endpoint `/api/auth/verify-superuser/` checks for a valid JWT with `is_superuser=True`. Only superusers can access.

**`docker-compose.yml`** — replace Traefik command and labels section:
```yaml
  traefik:
    image: traefik:v2.11
    container_name: uzaspea-traefik
    command:
      - "--api.insecure=false"          # FIX D-02: no public dashboard port
      - "--api.dashboard=true"          # FIX D-02: enabled, but routed via ForwardAuth
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=uzaspea_default"
      - "--providers.file.directory=/etc/traefik/dynamic"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.web.http.redirections.entryPoint.scheme=https"
      - "--entrypoints.websecure.address=:443"
      - "--accesslog=true"
      - "--metrics.prometheus=true"
      - "--tracing.jaeger=true"
      - "--tracing.jaeger.samplingServerURL=http://jaeger:5778/sampling"
      - "--tracing.jaeger.localAgentHostPort=jaeger:6831"
    ports:
      - "80:80"
      - "443:443"
      # FIX D-02: removed port 8081 — dashboard accessed via ForwardAuth only
    labels:
      - "traefik.enable=true"
      # Dashboard router — gated behind superuser ForwardAuth
      - "traefik.http.routers.dashboard.rule=PathPrefix(`/dashboard`) || PathPrefix(`/api/traefik`)"
      - "traefik.http.routers.dashboard.entrypoints=websecure"
      - "traefik.http.routers.dashboard.tls=true"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.middlewares=superuser-auth@file"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik_dynamic.yml:/etc/traefik/dynamic/dynamic.yml:ro
```

**`backend/marketplace/api_views.py`** — add `VerifySuperuserView`:
```python
class VerifySuperuserView(APIView):
    """FIX D-02/D-03: ForwardAuth endpoint for Traefik.
    Returns 200 if request has valid superuser JWT, else 401/403."""
    permission_classes = [permissions.AllowAny]  # Traefik sends the raw request

    def get(self, request):
        from rest_framework_simplejwt.authentication import JWTAuthentication
        jwt_auth = JWTAuthentication()
        # Try Authorization header first
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header:
            return Response({'error': 'No authorization header'}, status=401)
        try:
            validated_token = jwt_auth.get_validated_token(
                jwt_auth.get_raw_token(auth_header)
            )
            user = jwt_auth.get_user(validated_token)
        except Exception:
            return Response({'error': 'Invalid token'}, status=401)
        if not user.is_superuser:
            return Response({'error': 'Superuser access required'}, status=403)
        return Response({'status': 'ok'})
```

**`traefik_dynamic.yml`** — add ForwardAuth middleware:
```yaml
http:
  middlewares:
    superuser-auth:
      forwardAuth:
        address: "http://backend:8000/api/auth/verify-superuser/"
        authResponseHeaders:
          - "X-Forwarded-User"
```

---

### D-03 — Secure Jaeger via ForwardAuth (CHANGED: kept running, gated behind superuser JWT)

Instead of removing Jaeger entirely, we **keep it running** on the internal Docker network but remove all public port mappings. Access the Jaeger UI through Traefik with the same ForwardAuth middleware.

**`docker-compose.yml`** — update Jaeger service:
```yaml
  jaeger:
    image: jaegertracing/all-in-one:1.55
    container_name: uzaspea-jaeger
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
      - QUERY_BASE_PATH=/jaeger  # FIX D-03: serve under /jaeger path
    # FIX D-03: NO public ports — all access via Traefik ForwardAuth
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.jaeger.rule=PathPrefix(`/jaeger`)"
      - "traefik.http.routers.jaeger.entrypoints=websecure"
      - "traefik.http.routers.jaeger.tls=true"
      - "traefik.http.routers.jaeger.middlewares=superuser-auth@file"
      - "traefik.http.services.jaeger.loadbalancer.server.port=16686"
```

Traefik tracing flags stay in the Traefik command — they use internal networking and don't need public ports.

---

### D-04 — Replace self-signed certs with Let's Encrypt

**`docker-compose.yml`** — replace manual cert approach with Traefik Let's Encrypt ACME:
```yaml
  traefik:
    command:
      # ... other flags ...
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/etc/traefik/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik_acme.json:/etc/traefik/acme.json  # FIX D-04: Let's Encrypt cert storage
      - ./traefik_dynamic.yml:/etc/traefik/dynamic/dynamic.yml:ro
```

Add to `backend/.env.example`:
```
ACME_EMAIL=your@email.com
```

Create `traefik_acme.json` (empty, chmod 600):
```bash
touch traefik_acme.json && chmod 600 traefik_acme.json
```

Update each service's Traefik labels to use Let's Encrypt:
```yaml
- "traefik.http.routers.backend.tls.certresolver=letsencrypt"
- "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

Remove the `./certs` volume mount and delete `certs/` directory from repo. Add `certs/` to `.gitignore`.

Update `traefik_dynamic.yml` to remove manual cert block (now handled by ACME).

---

### D-05 — Configure WhiteNoise compression

**`backend/uzachuo/settings.py`** — add after STATIC_ROOT:
```python
# FIX D-05: WhiteNoise compressed + hashed static files for production
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
```

---

### D-06 — Image upload validation

**`backend/marketplace/models.py`** — add validator function before first model:
```python
from django.core.exceptions import ValidationError

def validate_image(image):
    """FIX D-06: validate image size and format."""
    max_size_mb = 5
    if image.size > max_size_mb * 1024 * 1024:
        raise ValidationError(f'Image must be under {max_size_mb}MB. Yours is {image.size // (1024*1024)}MB.')
    valid_types = ['image/jpeg', 'image/png', 'image/webp']
    if hasattr(image, 'content_type') and image.content_type not in valid_types:
        raise ValidationError('Only JPEG, PNG, and WebP images are allowed.')
```

Apply to all `ImageField` definitions:
```python
# ProductImage
image = models.ImageField(upload_to='product_images/', validators=[validate_image])
# UserProfile
profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True, validators=[validate_image])
banner_image = models.ImageField(upload_to='profile_banners/', blank=True, null=True, validators=[validate_image])
```

Also add Pillow auto-resize in `ProductImage.save()`:
```python
def save(self, *args, **kwargs):
    super().save(*args, **kwargs)
    if self.image:
        from PIL import Image as PILImage
        img = PILImage.open(self.image.path)
        # FIX D-06: auto-resize large images to max 1200px wide
        if img.width > 1200:
            ratio = 1200 / img.width
            img = img.resize((1200, int(img.height * ratio)), PILImage.LANCZOS)
            img.save(self.image.path, optimize=True, quality=85)
```

---

### D-07 — Rate limiting

**`backend/uzachuo/settings.py`** — add to `REST_FRAMEWORK`:
```python
REST_FRAMEWORK = {
    # ... existing ...
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/hour',    # FIX D-07: anonymous users
        'user': '1000/hour',  # FIX D-07: authenticated users
        'register': '5/hour', # FIX D-07: registration
        'login': '10/hour',   # FIX D-07: login attempts
        'ticket': '5/hour',   # FIX D-07: support tickets
    }
}
```

**`backend/marketplace/api_views.py`** — add throttle classes to sensitive views:
```python
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'  # FIX D-07

class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'  # FIX D-07

class TicketRateThrottle(AnonRateThrottle):
    scope = 'ticket'  # FIX D-07

# Apply:
class RegisterView(APIView):
    throttle_classes = [RegisterRateThrottle]
    # ...

class CustomTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [LoginRateThrottle]
    # ...

class SupportTicketViewSet(viewsets.ModelViewSet):
    def get_throttles(self):
        if self.action == 'create':
            return [TicketRateThrottle()]
        return super().get_throttles()
```

---

### D-08 — Wire check_expirations as Celery periodic task

**`backend/uzachuo/celery.py`** — add beat schedule:
```python
from celery.schedules import crontab

app.conf.beat_schedule = {
    'check-expirations-every-30-min': {  # FIX D-08
        'task': 'marketplace.tasks.check_expirations_task',
        'schedule': crontab(minute='*/30'),
    },
}
```

**`backend/marketplace/tasks.py`** — add the task:
```python
@app.task(name='marketplace.tasks.check_expirations_task')
def check_expirations_task():
    """FIX D-08: run expiration logic as Celery task, not just management command."""
    from django.core.management import call_command
    call_command('check_expirations')
```

---

### B-08 — IsStaffMember bare except

**`backend/uzachuo/permissions.py`**:
```python
try:
    return request.user.staff_profile.is_active
except AttributeError:  # FIX B-08: specific — only catches missing staff_profile
    return False
```

---

### B-09 — Verify IsOwnerOrStaff exists in permissions.py

**`backend/uzachuo/permissions.py`** — add if missing:
```python
class IsOwnerOrStaff(permissions.BasePermission):
    """FIX B-09: object-level permission — only owner or staff can modify."""
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_staff or request.user.is_superuser:
            return True
        # Check common owner patterns
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'seller'):
            return obj.seller == request.user
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        return False
```

---

### B-11 — Notification model for marketplace events

**`backend/marketplace/models.py`** — add after `Follow` model:
```python
class Notification(models.Model):  # FIX B-11: in-app notifications
    TYPE_CHOICES = [
        ('order_status', 'Order Status Change'),
        ('payment_verified', 'Payment Verified'),
        ('new_follower', 'New Follower'),
        ('new_review', 'New Review on Your Product'),
        ('review_approved', 'Your Review Was Approved'),
        ('new_message', 'New Message'),
        ('inspection_update', 'Inspection Update'),
        ('sponsored_approved', 'Promotion Approved'),
        ('sponsored_expired', 'Promotion Expired'),
        ('low_stock', 'Low Stock Alert'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    link = models.CharField(max_length=255, blank=True, help_text='Frontend route e.g. /orders?highlight=42')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username}: {self.title}'

def push_notification(user, notification_type, title, message, link=''):
    """Helper to create a notification and broadcast via WebSocket."""
    n = Notification.objects.create(
        user=user, notification_type=notification_type,
        title=title, message=message, link=link
    )
    # Broadcast to user's notification channel
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    channel_layer = get_channel_layer()
    try:
        async_to_sync(channel_layer.group_send)(
            f'notifications_{user.id}',
            {'type': 'notification.push', 'notification': {
                'id': n.id, 'type': notification_type,
                'title': title, 'message': message, 'link': link,
            }}
        )
    except Exception:
        pass
    return n
```

**`backend/marketplace/api_views.py`** — add `NotificationViewSet`:
```python
class NotificationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete']

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        return NotificationSerializer

    @decorators.action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'all marked read'})

    @decorators.action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})
```

Register: `router.register(r'notifications', NotificationViewSet, basename='notification')`

Wire `push_notification` into key events:
- After order status change in `OrderStateMachine.transition_order()`
- After follow created in `UserProfileViewSet.follow()`
- After review approved in `ReviewViewSet.approve()`
- After sponsored listing approved in staff panel

**Frontend** — add notification bell to top nav in `App.tsx`:
```tsx
const NotificationBell: React.FC = () => {
    const [count, setCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        if (!isAuthenticated) return;
        api.get('/api/notifications/unread_count/').then(r => setCount(r.data.count));
    }, [isAuthenticated]);

    const openPanel = () => {
        setOpen(true);
        api.get('/api/notifications/').then(r => setNotifications(r.data.results || r.data));
        api.post('/api/notifications/mark_all_read/').then(() => setCount(0));
    };

    return (
        <div className="relative">
            <button onClick={openPanel} className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <Bell size={20} />
                {count > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 top-10 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-800 font-bold text-sm">Notifications</div>
                    {notifications.length === 0 ? (
                        <p className="p-4 text-sm text-gray-400 text-center">All caught up!</p>
                    ) : notifications.map(n => (
                        <div key={n.id} className={`p-3 border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${!n.is_read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                            onClick={() => { setOpen(false); if (n.link) window.location.href = n.link; }}>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
```

Run migration: `python manage.py makemigrations marketplace`

---

### B-12 — Buyer-Seller Messaging

**`backend/marketplace/models.py`** — add:
```python
class Conversation(models.Model):  # FIX B-12
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='buyer_conversations')
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='seller_conversations')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('buyer', 'seller', 'product')
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.buyer.username} ↔ {self.seller.username}'

class Message(models.Model):  # FIX B-12
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender.username}: {self.content[:50]}'
```

**`backend/marketplace/api_views.py`** — add `ConversationViewSet` and `MessageViewSet`:
```python
class ConversationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post']

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(buyer=user) | Q(seller=user)
        ).select_related('buyer', 'seller', 'product').order_by('-updated_at')

    def perform_create(self, serializer):
        seller_id = self.request.data.get('seller')
        product_id = self.request.data.get('product')
        # get_or_create to prevent duplicate conversations
        conv, _ = Conversation.objects.get_or_create(
            buyer=self.request.user,
            seller_id=seller_id,
            product_id=product_id
        )
        return Response(ConversationSerializer(conv).data)

    @decorators.action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        conv = self.get_object()
        if not (conv.buyer == request.user or conv.seller == request.user):
            return Response(status=403)
        if request.method == 'POST':
            msg = Message.objects.create(
                conversation=conv,
                sender=request.user,
                content=request.data.get('content', '').strip()
            )
            conv.save()  # bump updated_at
            # Notify other party
            other = conv.seller if request.user == conv.buyer else conv.buyer
            push_notification(other, 'new_message',
                f'New message from {request.user.username}',
                msg.content[:100], f'/messages/{conv.id}')
            return Response(MessageSerializer(msg).data, status=201)
        # GET — mark messages from other as read
        Message.objects.filter(conversation=conv, is_read=False).exclude(sender=request.user).update(is_read=True)
        msgs = conv.messages.all()
        return Response(MessageSerializer(msgs, many=True).data)
```

Register: `router.register(r'conversations', ConversationViewSet, basename='conversation')`

**Frontend** — create `frontend/src/pages/MessagesPage.tsx` with conversation list + message thread view. Add to App.tsx routes:
```tsx
<Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
<Route path="/messages/:id" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
```

Add "Message Seller" button on `ProductDetailPage.tsx`:
```tsx
const handleMessageSeller = async () => {
    const res = await api.post('/api/conversations/', { seller: product.seller_id, product: product.id });
    navigate(`/messages/${res.data.id}`);
};
```

Run migration: `python manage.py makemigrations marketplace`

---

### B-13 — Saved Searches & Price Alerts

**`backend/marketplace/models.py`**:
```python
class SavedSearch(models.Model):  # FIX B-13
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_searches')
    query = models.CharField(max_length=255, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    min_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    condition = models.CharField(max_length=20, blank=True)
    notify_on_match = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_checked = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

class PriceAlert(models.Model):  # FIX B-13
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='price_alerts')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='price_alerts')
    target_price = models.DecimalField(max_digits=12, decimal_places=2)
    is_active = models.BooleanField(default=True)
    triggered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'product')
```

**`backend/marketplace/tasks.py`** — add saved search matching task:
```python
@app.task
def check_saved_searches():
    """FIX B-13: notify users when new products match their saved searches."""
    from django.utils import timezone
    from .models import SavedSearch, Product
    from django.db.models import Q

    for ss in SavedSearch.objects.filter(notify_on_match=True):
        qs = Product.objects.filter(is_available=True, created_at__gt=ss.last_checked)
        if ss.query:
            qs = qs.filter(name__icontains=ss.query)
        if ss.category_id:
            qs = qs.filter(category=ss.category)
        if ss.min_price:
            qs = qs.filter(price__gte=ss.min_price)
        if ss.max_price:
            qs = qs.filter(price__lte=ss.max_price)
        if ss.condition:
            qs = qs.filter(condition=ss.condition)
        count = qs.count()
        if count > 0:
            push_notification(
                ss.user, 'order_status',
                f'{count} new product{"s" if count > 1 else ""} match your search "{ss.query or "Saved Search"}"',
                f'Check out the latest matches',
                f'/?q={ss.query}&category={ss.category_id or ""}'
            )
        ss.last_checked = timezone.now()
        ss.save(update_fields=['last_checked'])

@app.task
def check_price_alerts():
    """FIX B-13: notify users when product price drops to their target."""
    from .models import PriceAlert
    for alert in PriceAlert.objects.filter(is_active=True, triggered_at__isnull=True):
        if alert.product.price <= alert.target_price:
            push_notification(
                alert.user, 'order_status',
                f'Price dropped! {alert.product.name}',
                f'Now TSh {alert.product.price:,.0f} — your target was TSh {alert.target_price:,.0f}',
                f'/product/{alert.product.slug}'
            )
            alert.triggered_at = timezone.now()
            alert.is_active = False
            alert.save(update_fields=['triggered_at', 'is_active'])
```

Add to celery beat schedule in `celery.py`:
```python
'check-saved-searches-hourly': {
    'task': 'marketplace.tasks.check_saved_searches',
    'schedule': crontab(minute=0),  # every hour
},
'check-price-alerts-every-15-min': {
    'task': 'marketplace.tasks.check_price_alerts',
    'schedule': crontab(minute='*/15'),
},
```

Register API: `router.register(r'saved-searches', SavedSearchViewSet, basename='saved-search')`
`router.register(r'price-alerts', PriceAlertViewSet, basename='price-alert')`

Frontend: Add "Save Search" button to ProductList search bar. Add "Set Price Alert" button on ProductDetailPage.

Run migration: `python manage.py makemigrations marketplace`

---

### B-14 — Seller Rating

**`backend/marketplace/models.py`** — add computed property to `UserProfile`:
```python
@property
def seller_rating(self):
    """FIX B-14: aggregate rating from approved reviews on seller's products."""
    from django.db.models import Avg
    result = Review.objects.filter(
        product__seller=self.user, approved=True
    ).aggregate(avg=Avg('rating'), count=models.Count('id'))
    return {
        'average': round(float(result['avg'] or 0), 1),
        'count': result['count'],
    }
```

Add to `UserProfileSerializer`:
```python
seller_rating = serializers.SerializerMethodField()

def get_seller_rating(self, obj):
    return obj.seller_rating  # FIX B-14
```

Show on `ProfilePage.tsx` and `ProductDetailPage.tsx` seller info section.

---

### B-15 — Dispute System

**`backend/marketplace/models.py`** — add DISPUTED to Order status choices and Dispute model:
```python
# In Order.STATUS_CHOICES, add:
('DISPUTED', 'Disputed'),

class Dispute(models.Model):  # FIX B-15
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('under_review', 'Under Review'),
        ('resolved_buyer', 'Resolved — Favour Buyer'),
        ('resolved_seller', 'Resolved — Favour Seller'),
        ('closed', 'Closed'),
    ]
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='dispute')
    opened_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='opened_disputes')
    reason = models.TextField()
    evidence_description = models.TextField(blank=True)
    evidence_image = models.ImageField(upload_to='dispute_evidence/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    assigned_staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_disputes')
    resolution_notes = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Dispute on {self.order.id} ({self.status})'
```

**`backend/marketplace/services.py`** — add DISPUTED to valid transitions:
```python
'DELIVERED': ['COMPLETED', 'DISPUTED'],  # FIX B-15: buyer can dispute after delivery
'DISPUTED': ['PROCESSING', 'CANCELLED'],  # staff resolves
```

**`backend/marketplace/api_views.py`** — add `DisputeViewSet`:
```python
class DisputeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Dispute.objects.all().select_related('order', 'opened_by')
        return Dispute.objects.filter(
            Q(opened_by=user) | Q(order__orderitem_set__product__seller=user)
        ).distinct()

    def perform_create(self, serializer):
        order = serializer.validated_data['order']
        if order.user != self.request.user:
            raise serializers.ValidationError('You can only dispute your own orders.')
        if order.status not in ['DELIVERED']:
            raise serializers.ValidationError('Can only dispute orders in DELIVERED status.')
        serializer.save(opened_by=self.request.user)
        # Transition order to DISPUTED
        from .services import OrderStateMachine
        OrderStateMachine.transition_order(order, 'DISPUTED', notes=f'Dispute opened by buyer.')
        push_notification(
            order.orderitem_set.first().product.seller,
            'order_status', 'Dispute opened on your order',
            f'Order #{order.id} has been disputed. Please respond.',
            f'/orders?highlight={order.id}'
        )
```

Register: `router.register(r'disputes', DisputeViewSet, basename='dispute')`

Frontend: Add "Open Dispute" button on order card when status is DELIVERED. Staff panel: dispute management table.

Run migration: `python manage.py makemigrations marketplace`

---

### B-16 — Product Variants

**`backend/marketplace/models.py`**:
```python
class ProductVariant(models.Model):  # FIX B-16
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    name = models.CharField(max_length=100, help_text='e.g. "Red / XL" or "128GB Black"')
    sku = models.CharField(max_length=50, blank=True)
    price_adjustment = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text='Added to base product price. Can be negative.'
    )
    stock = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)
    image = models.ImageField(upload_to='variant_images/', blank=True, null=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.product.name} — {self.name}'

    @property
    def final_price(self):
        return self.product.price + self.price_adjustment
```

Add `variant` FK to `OrderItem`:
```python
variant = models.ForeignKey(
    ProductVariant, on_delete=models.SET_NULL,
    null=True, blank=True, related_name='order_items'
)
```

**Frontend** — on `ProductDetailPage.tsx`, if product has variants show a variant selector. On selection, show variant price and stock. Pass `variant` ID in order item creation.

Run migration: `python manage.py makemigrations marketplace`

---

### B-17 — Postgres Full-Text Search

**`backend/marketplace/api_views.py`** → `ProductViewSet.get_queryset()`:

Replace:
```python
if query:
    queryset = queryset.filter(
        Q(name__icontains=query) | Q(description__icontains=query)
    )
```
With:
```python
if query:
    from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
    search_vector = SearchVector('name', weight='A') + SearchVector('description', weight='B')
    search_query = SearchQuery(query)
    queryset = queryset.annotate(
        rank=SearchRank(search_vector, search_query)
    ).filter(rank__gte=0.1).order_by('-rank')  # FIX B-17: Postgres FTS
    # Fallback for non-postgres (dev with SQLite)
    if not queryset.exists():
        queryset = Product.objects.filter(is_available=True).filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        )
```

Note: FTS requires Postgres. The SQLite fallback keeps dev working.

---

### B-18 — SiteSettings model for company contact info

**`backend/marketplace/models.py`**:
```python
class SiteSettings(models.Model):  # FIX B-18
    """Singleton model — only one row. Edit via Django admin."""
    company_name = models.CharField(max_length=100, default='UZASPEA')
    tagline = models.CharField(max_length=255, blank=True)
    support_email = models.EmailField(blank=True)
    support_phone = models.CharField(max_length=30, blank=True)
    whatsapp_number = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    facebook_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    twitter_url = models.URLField(blank=True)
    working_hours = models.CharField(max_length=100, blank=True, default='Mon–Fri 8am–6pm EAT')

    class Meta:
        verbose_name = 'Site Settings'
        verbose_name_plural = 'Site Settings'

    def save(self, *args, **kwargs):
        self.pk = 1  # Force singleton
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Site Settings'
```

Add to `marketplace/admin.py`: `admin.site.register(SiteSettings)`

Add API endpoint:
```python
class SiteSettingsView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.get()).data)
```

Register: `path('site-settings/', SiteSettingsView.as_view())`

**`frontend/src/pages/dashboard/HelpCenterPage.tsx`** — fetch from API instead of hardcoded:
```tsx
useEffect(() => {
    api.get('/api/site-settings/').then(r => setSiteSettings(r.data));
}, []);
```

Run migration: `python manage.py makemigrations marketplace`

---

### B-19 — Inspected Badge on ProductCard

**`backend/marketplace/serializers.py`** → `ProductSerializer`:
```python
has_inspection = serializers.SerializerMethodField()
inspection_verdict = serializers.SerializerMethodField()

def get_has_inspection(self, obj):  # FIX B-19
    return obj.inspections.filter(status='published').exists()

def get_inspection_verdict(self, obj):
    insp = obj.inspections.filter(status='published').select_related('report').first()
    if insp and hasattr(insp, 'report'):
        return insp.report.verdict
    return None
```

Add to `ProductSerializer.Meta.fields`: `'has_inspection', 'inspection_verdict'`

**`frontend/src/components/ProductCard.tsx`** — add badge:
```tsx
{product.has_inspection && (
    <div className="absolute top-2 right-2 z-10">
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm ${
            product.inspection_verdict === 'pass' ? 'bg-green-500 text-white' :
            product.inspection_verdict === 'conditional' ? 'bg-yellow-500 text-white' :
            'bg-gray-500 text-white'
        }`}>
            {product.inspection_verdict === 'pass' ? '✓ Inspected' :
             product.inspection_verdict === 'conditional' ? '⚠ Conditional' : 'Inspected'}
        </span>
    </div>
)}
```

---

### B-20 — Wire Follow UI in ProfilePage

**`frontend/src/pages/ProfilePage.tsx`** — add:
```tsx
const [followStatus, setFollowStatus] = useState({ following: false, followers_count: 0, following_count: 0 });
const currentUser = localStorage.getItem('username');
const isOwnProfile = currentUser === username;

useEffect(() => {
    if (username && !isOwnProfile) {
        api.get(`/api/profiles/${username}/follow_status/`)
            .then(r => setFollowStatus(r.data)).catch(() => {});
    }
}, [username, isOwnProfile]);

const handleFollow = async () => {
    const action = followStatus.following ? 'unfollow' : 'follow';
    const res = await api.post(`/api/profiles/${username}/${action}/`);
    setFollowStatus(prev => ({...prev, following: res.data.following, followers_count: res.data.followers_count}));
    toast.success(followStatus.following ? 'Unfollowed' : 'Following!');
};

// In JSX — add after profile header:
<div className="flex items-center gap-6 mt-3">
    <div className="text-center cursor-pointer">
        <p className="font-black text-lg text-gray-900 dark:text-white">{followStatus.followers_count}</p>
        <p className="text-xs text-gray-500">Followers</p>
    </div>
    <div className="text-center">
        <p className="font-black text-lg text-gray-900 dark:text-white">{followStatus.following_count}</p>
        <p className="text-xs text-gray-500">Following</p>
    </div>
    {!isOwnProfile && isAuthenticated && (
        <button onClick={handleFollow} className={followStatus.following ? 'btn-ghost border border-gray-300' : 'btn-primary'}>
            {followStatus.following ? '✓ Following' : '+ Follow'}
        </button>
    )}
</div>
```

---

### B-21 + B-22 — Delivery Zones

**`backend/marketplace/models.py`**:
```python
class DeliveryZone(models.Model):  # FIX B-21
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='delivery_zones')
    zone_name = models.CharField(max_length=100, help_text='e.g. "Dar es Salaam", "Upcountry", "International"')
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estimated_days = models.CharField(max_length=50, blank=True, help_text='e.g. "1–2 days"')
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True, help_text='Additional info shown to buyer')

    class Meta:
        ordering = ['delivery_fee']
        unique_together = ('seller', 'zone_name')

    def __str__(self):
        return f'{self.seller.username}: {self.zone_name} — TSh {self.delivery_fee}'
```

Register API: `router.register(r'delivery-zones', DeliveryZoneViewSet, basename='delivery-zone')`

`DeliveryZoneViewSet`: seller-scoped CRUD. Public read with `?seller=username`.

**Frontend** — in `CheckoutPage.tsx`, after seller is identified from cart items, fetch their delivery zones:
```tsx
useEffect(() => {
    const sellerUsername = cartItems[0]?.seller_username;
    if (sellerUsername) {
        api.get(`/api/delivery-zones/?seller=${sellerUsername}`)
            .then(r => setDeliveryZones(r.data.results || r.data));
    }
}, [cartItems]);

// Show zone selector when shipping_method === 'DELIVERY':
<div className="space-y-2">
    {deliveryZones.map(zone => (
        <label key={zone.id} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer ${selectedZone?.id === zone.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3">
                <input type="radio" name="zone" value={zone.id} onChange={() => { setSelectedZone(zone); setShippingFee(zone.delivery_fee); }} />
                <div>
                    <p className="font-bold text-sm">{zone.zone_name}</p>
                    <p className="text-xs text-gray-500">{zone.estimated_days} {zone.notes && `· ${zone.notes}`}</p>
                </div>
            </div>
            <span className="font-black text-sm">{parseInt(zone.delivery_fee) === 0 ? 'FREE' : `TSh ${parseInt(zone.delivery_fee).toLocaleString()}`}</span>
        </label>
    ))}
</div>
```

Add to seller dashboard: `DeliveryZonesManager` component (CRUD for their zones).

Run migration: `python manage.py makemigrations marketplace`

---

### B-23 — Currency preference in settings

**`backend/marketplace/models.py`** → `UserProfile`:
```python
preferred_currency = models.CharField(
    max_length=3,
    choices=[('TZS', 'Tanzanian Shilling'), ('USD', 'US Dollar')],
    default='TZS'  # FIX B-23
)
```

**`frontend/src/pages/dashboard/SettingsPage.tsx`** — add currency section:
```tsx
<div className="card p-6">
    <h3 className="font-bold mb-3">Display Currency</h3>
    <div className="flex gap-3">
        {['TZS', 'USD'].map(c => (
            <label key={c} className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer ${form.preferred_currency === c ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <input type="radio" name="currency" value={c} checked={form.preferred_currency === c}
                    onChange={() => setForm({...form, preferred_currency: c})} className="hidden" />
                <span className="font-black">{c}</span>
                <span className="text-xs text-gray-500">{c === 'TZS' ? 'Tanzanian Shilling' : 'US Dollar'}</span>
            </label>
        ))}
    </div>
    <p className="text-xs text-gray-400 mt-2">Prices will be shown in your preferred currency. Exchange rate updated daily.</p>
</div>
```

Add currency context to `App.tsx` — read from profile and provide a `useCurrency()` hook that formats prices based on preference. Use a public exchange rate API (e.g. `api.exchangerate.host`) called once daily via a Celery task.

Run migration: `python manage.py makemigrations marketplace`

---

### B-24 — Following feed filter

**`backend/marketplace/api_views.py`** → `ProductViewSet.get_queryset()`:
```python
if self.request.query_params.get('following') == 'true' and user.is_authenticated:
    # FIX B-24: products from followed sellers
    from .models import Follow
    followed_sellers = Follow.objects.filter(
        follower=user
    ).values_list('following__user_id', flat=True)
    queryset = queryset.filter(seller_id__in=followed_sellers)
```

**Frontend** — add "Following" tab to `ProductList.tsx` tab bar (shows only for authenticated users).

---

### B-25 — Inspection category suggest endpoint

**`backend/inspections/api_views.py`** — verify exists and add if not:
```python
@decorators.action(detail=False, methods=['get'])
def suggest(self, request):
    """FIX B-25: suggest inspection categories matching a marketplace product."""
    product_id = request.query_params.get('product_id')
    if not product_id:
        return Response({'error': 'product_id required'}, status=400)
    from marketplace.models import Product
    try:
        product = Product.objects.select_related('category__parent').get(pk=product_id)
    except Product.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    direct = InspectionCategory.objects.filter(marketplace_category=product.category, is_active=True)
    parent_match = InspectionCategory.objects.filter(
        marketplace_category=product.category.parent, is_active=True
    ) if product.category.parent_id else InspectionCategory.objects.none()
    all_matches = list(direct) + [c for c in parent_match if c not in list(direct)]
    return Response(InspectionCategorySerializer(all_matches, many=True).data)
```

---

### B-26 — Already handled in D-08 (check_expirations as Celery task).

---

### B-27 — Already handled in B-11 (Notification system with bell UI).

---

### B-28 — Inspector mobile workflow

**`frontend/src/pages/inspections/InspectorLayout.tsx`** — ensure these sub-views exist and are complete:

1. **Job List** — `GET /api/inspector/assignments/` → list of assigned active jobs with status, SLA deadline, item address
2. **Check-In View** — GPS capture + photo upload → `POST /api/inspector/checkins/`
3. **Checklist View** — render `ChecklistTemplate` items one by one. For each: pass/fail toggle, scale slider, measurement input, text area, media upload button. Auto-save as draft.
4. **Evidence Upload** — per checklist item, capture photo → `POST /api/inspector/evidence/` with `checklist_item` FK
5. **Submit View** — summary of all responses, verdict selection, final submit → `POST /api/inspector/reports/{id}/finalize/`

The `InspectorLayout.tsx` exists but check which of these sub-views are implemented vs. skeleton.

---

### B-29 — Staff support ticket + FAQ management

**`frontend/src/pages/staff/StaffDashboardLayout.tsx`** — add sections:

```tsx
// Support Tickets section:
// GET /api/staff/support-tickets/ — table with status filter, assign to staff, resolve
// Columns: ID, user, category, subject, status, created_at, assigned_to
// Actions: Assign to me, Change status, Add notes

// FAQ management:
// GET/POST/PATCH/DELETE /api/staff/faq/
// Create/edit FAQ with category, question, answer, publish toggle
```

**Backend** — ensure `StaffFAQViewSet` exists in `staff/api_views.py`:
```python
class StaffFAQViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaffMember]
    queryset = FAQ.objects.all().order_by('category', 'order')
    serializer_class = FAQSerializer  # import from marketplace
```

Register in `staff/api_urls.py`:
```python
router.register(r'faq', StaffFAQViewSet, basename='staff-faq')
router.register(r'support-tickets', StaffSupportTicketViewSet, basename='staff-support-ticket')
```

---

### B-30 — PublicVerifyPage for inspection reports

**`frontend/src/pages/inspections/PublicVerifyPage.tsx`** — create if missing:
```tsx
const PublicVerifyPage: React.FC = () => {
    const { inspection_id } = useParams();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        api.get(`/api/inspections/requests/?inspection_id=${inspection_id}`)
            .then(r => {
                const data = r.data.results?.[0] || r.data;
                if (data?.report) setReport(data);
                else setNotFound(true);
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [inspection_id]);

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-brand-600 border-t-transparent rounded-full" /></div>;
    if (notFound) return <div className="text-center py-20"><p className="text-xl font-bold text-gray-900 dark:text-white">Report Not Found</p><p className="text-gray-500 mt-2">Inspection ID: {inspection_id}</p></div>;

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <ShieldCheck size={32} className={report.report.verdict === 'pass' ? 'text-green-500' : report.report.verdict === 'conditional' ? 'text-yellow-500' : 'text-red-500'} />
                    <div>
                        <h1 className="text-xl font-black">Inspection Report</h1>
                        <p className="text-xs text-gray-400 font-mono">{report.inspection_id}</p>
                    </div>
                    <span className={`ml-auto px-3 py-1 rounded-full text-sm font-black ${report.report.verdict === 'pass' ? 'bg-green-100 text-green-700' : report.report.verdict === 'conditional' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {report.report.verdict.toUpperCase()}
                    </span>
                </div>
                <div className="space-y-3 text-sm">
                    <div><span className="font-bold text-gray-500">Item:</span> <span className="text-gray-900 dark:text-white">{report.item_name}</span></div>
                    <div><span className="font-bold text-gray-500">Category:</span> <span className="text-gray-900 dark:text-white">{report.category_name}</span></div>
                    <div><span className="font-bold text-gray-500">Report Hash:</span> <span className="font-mono text-xs text-gray-400 break-all">{report.report.report_hash}</span></div>
                    <div><span className="font-bold text-gray-500">Summary:</span> <p className="text-gray-900 dark:text-white mt-1">{report.report.summary}</p></div>
                </div>
                <p className="mt-6 text-xs text-gray-400 text-center">This report was cryptographically signed and cannot be altered.</p>
            </div>
        </div>
    );
};
```

Import and add to `App.tsx` (already has the route `/verify/:inspection_id`).

---

### FINAL MIGRATIONS & VERIFICATION

```bash
cd backend
python manage.py makemigrations marketplace inspections staff
python manage.py migrate
python manage.py check              # ZERO errors
python manage.py seed_inspections   # re-run to pick up any new categories

cd ../frontend
npm ci && npm run build             # ZERO TypeScript errors

cd ..
docker compose config               # valid YAML, no errors
docker compose build                # all images build
docker compose up -d
curl https://yourdomain.com/api/products/           # 200
curl https://yourdomain.com/api/site-settings/      # 200
curl https://yourdomain.com/api/notifications/      # 401 (correct, needs auth)
# Browser: visit /dashboard/settings — loads
# Browser: visit /dashboard/help-center — shows real contact info from DB
# Browser: WebSocket on order page — connects and receives updates
# Docker: check celery-beat logs — shows check_expirations_task firing
```
