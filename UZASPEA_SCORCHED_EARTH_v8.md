# UZASPEA — SCORCHED EARTH AUDIT v8
# Full Progress Rating + New Findings + Agent Prompt

---

## PART 1 — RATING: 78/100 ⚠️ (DOWN FROM 91)

### The score dropped — but for good reason.

v7 rated 91/100 based on code review of *intended* fixes. The fresh clone audit
of the *actual committed code* reveals that several v7 fixes were only partially
applied, and the commit added significant new problems — including a broken
real-time chat, a massive repo bloat catastrophe, a private TLS key committed
to git, and a live Let's Encrypt ACME account private key in the repo. These
findings override the v7 score.

The architecture is solid. The product concept is real. The CI/CD pipeline
structure is good. But the repo is currently a security liability and the
flagship "real-time chat" feature does not work.

---

## PART 2 — V7 ISSUE TRACKER: WHAT ACTUALLY GOT FIXED

| ID | Issue | v7 Status | Actual Status |
|---|---|---|---|
| CRIT-01 | CheckoutPage delivery_fee field mismatch | ❌ | ⚠️ HALF-FIXED (line 153 fixed, line 36 still broken) |
| CRIT-02 | ProductVariantViewSet auth blocks buyers | ❌ | ✅ FIXED |
| CRIT-03 | CI/CD VITE_API_BASE_URL not passed | ❌ | ✅ FIXED |
| CRIT-04 | Staff support-tickets/FAQ routes missing | ❌ | ✅ FIXED |
| CRIT-05 | No health check on deploy | ❌ | ✅ FIXED |
| HIGH-01 | WS chat one-way only | ❌ | ❌ STILL BROKEN (new consumer added but no receive() / no broadcast) |
| HIGH-02 | No staff dispute resolver UI | ❌ | ✅ FIXED (DisputesManager in StaffDashboardLayout) |
| HIGH-03 | Buyer can message themselves | ❌ | ❌ NOT FIXED |
| HIGH-04 | backup.sh hardcoded path | ❌ | ✅ FIXED |
| HIGH-05 | Remote scripts hardcoded credentials | ❌ | ✅ FIXED (scripts excluded from git) |
| HIGH-06 | docker-compose.yml.bak in repo | ❌ | ✅ FIXED |
| MED-01 | No test job in CI | ❌ | ✅ FIXED |
| MED-02 | No test suite | ❌ | ✅ FIXED (basic tests) |
| MED-03 | fix_compose.py in repo | ❌ | ✅ FIXED |
| MED-04 | ALLOWED_HOSTS for production | ❌ | ⚠️ PARTIAL (wildcard added, but see SEC-03 below) |
| MED-05 | push_notification lacks logging | ❌ | ✅ FIXED |
| MED-06 | Seller not notified on new order | ❌ | ✅ FIXED |
| LOW-01 | GITHUB_USER not in .env.example | ❌ | ✅ FIXED |
| LOW-02 | SupportTicket anonymous user lookup | ❌ | ✅ FIXED |

**Net: 14/19 fully fixed, 3 partial/broken, 2 new regressions introduced.**

---

## PART 3 — NEW FINDINGS: 18 ISSUES

---

### 🔴 CRITICAL

---

#### CRIT-NEW-01 · Private TLS key committed to git — rotate immediately

`certs/key.pem` is tracked by git and contains a real RSA private key:
```
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEA...
```

The `.gitignore` has `*.pem` and `certs/` — but these were added to
`.gitignore` **after** the files were committed. Once a file is tracked,
`.gitignore` does not un-track it. The key is now in git history forever
and is publicly readable on GitHub.

**Impact:** Anyone who clones the repo has the private key. If this cert/key
pair is in any DNS or server config, the TLS connection can be decrypted.

**Fix:**
```bash
# 1. Remove from git tracking (history still has it — treat key as compromised)
git rm --cached certs/cert.pem certs/key.pem
git commit -m "security: stop tracking TLS cert/key — never commit private keys"

# 2. Regenerate the key pair (the old one is compromised)
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem \
  -days 365 -nodes -subj "/CN=localhost"

# 3. Verify .gitignore blocks them
git check-ignore -v certs/key.pem   # should print a match

# 4. Consider git-filter-repo to purge history if this is ever a production key
pip install git-filter-repo
git filter-repo --path certs/key.pem --invert-paths
git filter-repo --path certs/cert.pem --invert-paths
```

---

#### CRIT-NEW-02 · Let's Encrypt ACME account private key committed to git

`traefik_acme.json` is tracked in git and contains a live Let's Encrypt
account private key (4096-bit RSA) in the `PrivateKey` field, plus the
registered account URI `https://acme-v02.api.letsencrypt.org/acme/acct/3287068365`.

This is the key used to request SSL certificates from Let's Encrypt on behalf
of `admin@uzaspea.com`. Anyone with this key can issue or revoke certificates
for your domains.

**Fix:**
```bash
# 1. Remove from git NOW
git rm --cached traefik_acme.json
echo "traefik_acme.json" >> .gitignore
git commit -m "security: remove ACME private key from git"

# 2. Revoke the compromised Let's Encrypt account via certbot or ACME API
# 3. Let Traefik regenerate acme.json on first start with a blank file:
echo '{}' > traefik_acme.json
chmod 600 traefik_acme.json  # Traefik requires 600 on this file

# 4. Purge from git history
pip install git-filter-repo
git filter-repo --path traefik_acme.json --invert-paths
```

---

#### CRIT-NEW-03 · CRIT-01 half-fixed — shipping fee is still NaN on selection

v7 fixed line 153 (the `<option>` display) but missed line 36 which calculates
the actual fee sent to the backend:

```tsx
// Line 36 — STILL BROKEN:
? (deliveryZones.length > 0 ? (selectedZone ? Number(selectedZone.fee) : 0) : 5000)

// zone.fee does not exist on the API response — it's zone.delivery_fee
// Number(undefined) = NaN → order submitted with shipping_fee: NaN
```

**Fix in `frontend/src/pages/CheckoutPage.tsx` line 36:**
```tsx
const shippingFee = shippingMethod === 'DELIVERY'
  ? (deliveryZones.length > 0 ? (selectedZone ? Number(selectedZone.delivery_fee) : 0) : 5000)
  : 0;
```

---

#### CRIT-NEW-04 · Real-time chat is non-functional — ChatConsumer has no receive()

The `ChatConsumer` WebSocket handler was added but is incomplete:

1. **No `receive()` method** — the consumer cannot receive messages sent by the
   browser over WebSocket. The connection opens successfully but any message
   sent from the client is silently dropped.

2. **Messages REST endpoint does not broadcast to WebSocket** — when a user
   POSTs to `/api/conversations/{id}/messages/`, the endpoint saves the message
   and calls `push_notification()` (a notification, not a chat message), but
   never calls `channel_layer.group_send()` to push the new message to the
   recipient's WebSocket. The `ChatConsumer.chat_message()` handler exists but
   is never called.

**Result:** `MessagesPage.tsx` connects to `ws://host/ws/chat/?token=...` and
`onmessage` fires — but only if and when a chat message event reaches the
consumer, which never happens. Real-time delivery is entirely broken.

**Fix in `backend/marketplace/consumers.py` — add `receive()` to ChatConsumer:**
```python
async def receive(self, text_data):
    """Receive message from WebSocket, save to DB, broadcast to recipient."""
    import json
    from asgiref.sync import sync_to_async
    
    data = json.loads(text_data)
    conv_id = data.get('conversation_id')
    content = data.get('content', '').strip()
    
    if not conv_id or not content:
        return
    
    # Save message and get recipient
    result = await self._save_message(conv_id, content)
    if result is None:
        return
    
    msg_data, recipient_id = result
    
    # Broadcast to recipient's personal channel group
    await self.channel_layer.group_send(
        f'chat_{recipient_id}',
        {
            'type': 'chat_message',
            'conversation_id': conv_id,
            'message': msg_data,
        }
    )
    # Echo back to sender for confirmation
    await self.send(text_data=json.dumps({
        'type': 'chat_message',
        'conversation_id': conv_id,
        'message': msg_data,
    }))

@database_sync_to_async
def _save_message(self, conv_id, content):
    from marketplace.models import Conversation, Message
    from marketplace.serializers import MessageSerializer
    try:
        conv = Conversation.objects.select_related('buyer', 'seller').get(id=conv_id)
        if self.user not in (conv.buyer, conv.seller):
            return None
        msg = Message.objects.create(conversation=conv, sender=self.user, content=content)
        conv.save()  # bump updated_at
        recipient = conv.seller if self.user == conv.buyer else conv.buyer
        return MessageSerializer(msg).data, recipient.id
    except Conversation.DoesNotExist:
        return None
```

**Also fix `backend/marketplace/api_views.py` — broadcast from REST too:**
```python
# In ConversationViewSet.messages() POST, after msg = Message.objects.create(...):
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .serializers import MessageSerializer as MsgSerializer

channel_layer = get_channel_layer()
try:
    async_to_sync(channel_layer.group_send)(
        f'chat_{other.id}',
        {
            'type': 'chat_message',
            'conversation_id': conv.id,
            'message': MsgSerializer(msg).data,
        }
    )
except Exception:
    pass  # WS delivery is best-effort; REST response still returns
```

---

### 🟠 HIGH

---

#### HIGH-NEW-01 · `.venv` (10,636 files) committed to git — repo is 266MB

The entire Python virtual environment is tracked in git. This is catastrophic:

- Repo is 266MB instead of ~5MB
- Every `git clone` downloads 10,636 package files
- CI/CD checkout takes minutes instead of seconds
- Security scanners will flag known-vulnerable package versions in `.venv`
- `__pycache__` in `.venv` contains compiled Python bytecode for two Python
  versions (3.12 AND 3.14) — which means the repo was committed from two
  different machines with different Python versions
- The `.gitignore` has `.venv/` — but again, the directory was committed first

**Fix:**
```bash
# Remove entire .venv from git tracking (this is a large operation)
git rm -r --cached backend/.venv
git rm -r --cached backend/__pycache__   # if any at root level
git rm -r --cached 'backend/inspections/__pycache__'
git rm -r --cached 'backend/marketplace/__pycache__'
git rm -r --cached 'backend/staff/__pycache__'
git rm -r --cached 'backend/uzachuo/__pycache__'

# Commit the removal
git commit -m "cleanup: remove .venv and __pycache__ from git tracking"

# To clean history (recommended — reduces clone size dramatically):
git filter-repo --path backend/.venv --invert-paths
git filter-repo --path-glob '*/__pycache__' --invert-paths

# Verify .gitignore will block future commits:
git check-ignore -v backend/.venv  # should show a match
```

---

#### HIGH-NEW-02 · Production database (`db.sqlite3`) committed to git

`backend/db.sqlite3` (996KB) is tracked in git. This is a SQLite database
containing real application data — user records, product listings, orders,
inspection records, possibly hashed passwords and PII.

The `.gitignore` has `*.sqlite3` — but the file was committed before that rule.

**Fix:**
```bash
git rm --cached backend/db.sqlite3
git commit -m "security: remove SQLite database from git"
# Purge from history:
git filter-repo --path backend/db.sqlite3 --invert-paths
```

---

#### HIGH-NEW-03 · `server.log` (424 lines) committed to git

`backend/server.log` is tracked. Server logs may contain:
- Stack traces with internal paths
- User emails from error reports
- Request details (URLs, query params)
- Exception messages with data

The `.gitignore` has `*.log` — committed before the rule.

**Fix:**
```bash
git rm --cached backend/server.log
git commit -m "cleanup: remove server log from git"
```

---

#### HIGH-NEW-04 · `staticfiles/` and `static_collected/` in git — built artifacts committed

Django's `collectstatic` output (hundreds of files) is tracked in git.
These are build artifacts — they should be generated at deploy time
(`manage.py collectstatic --noinput` already runs in the prod Dockerfile command).
Committing them bloats the repo and can cause stale static file confusion
in production.

**Fix:**
```bash
git rm -r --cached backend/staticfiles/
git rm -r --cached backend/static_collected/
echo "backend/staticfiles/" >> .gitignore
echo "backend/static_collected/" >> .gitignore
git commit -m "cleanup: stop tracking collectstatic output"
```

---

#### HIGH-NEW-05 · Media files (user uploads) committed to git

52 user-uploaded images in `backend/media/` are tracked in git — these are
inspection photos. User-uploaded media is runtime data, not source code. It
should live in `persistent_data/media/` (which is gitignored) and be mapped
via Docker volume.

**Fix:**
```bash
git rm -r --cached backend/media/
echo "backend/media/" >> .gitignore
git commit -m "cleanup: remove user-uploaded media from git"
```

---

#### HIGH-NEW-06 · HIGH-03 not fixed — buyer can message themselves

`ConversationViewSet.create()` still does not check if `seller_id == request.user.id`.
A seller can start a conversation with themselves, creating a degenerate
`Conversation` where `buyer == seller`. This will cause undefined behavior in
`messages()` where `other = conv.seller if request.user == conv.buyer else conv.buyer`
returns `request.user` — push notification fires to themselves.

**Fix in `backend/marketplace/api_views.py` → `ConversationViewSet.create()`:**
```python
def create(self, request, *args, **kwargs):
    seller_id = request.data.get('seller')
    product_id = request.data.get('product')
    
    if str(seller_id) == str(request.user.id):
        return Response({'error': 'You cannot message yourself.'}, status=400)
    
    conv, _ = Conversation.objects.get_or_create(
        buyer=request.user, seller_id=seller_id, product_id=product_id
    )
    return Response(ConversationSerializer(conv, context={'request': request}).data)
```

---

### 🟡 MEDIUM

---

#### MED-NEW-01 · `DJANGO_DEBUG` defaults to `True` — can go live in debug mode

`settings.py` line 11:
```python
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'
```

If `DJANGO_DEBUG` is not in the `.env` file (e.g., freshly deployed server
with a missing or incomplete `.env`), Django runs in **DEBUG mode in production**.
This exposes full stack traces with local variable values to any user who
triggers a 500 error.

The `.env.example` has `DJANGO_DEBUG=False` but the *default in code* should
also be `False` — defensive configuration.

**Fix in `backend/uzachuo/settings.py` line 11:**
```python
DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'  # Default SAFE
```

---

#### MED-NEW-02 · `ALLOWED_HOSTS` unconditionally appends wildcard in production

`settings.py` lines 20-21:
```python
if not DEBUG and '*' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('*')  # "safe — Traefik validates Host"
```

This unconditionally sets `ALLOWED_HOSTS = ['*']` in production. The comment
says "Traefik validates Host" — but this is false security. If the backend
port 8000 is ever directly accessible (security group misconfiguration,
developer testing, container IP exposure), Django's Host header validation is
the last line of defense. Removing it is not safe.

**Fix:** Remove the wildcard block entirely. Instead, set `DJANGO_ALLOWED_HOSTS`
properly in `.env`:
```python
# settings.py — remove lines 20-22 and just trust the env var:
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
ALLOWED_HOSTS.append('testserver')  # for tests
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```
```env
# backend/.env
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,13.x.x.x
```

---

#### MED-NEW-03 · CORS not configured in production docker-compose

`docker-compose.prod.yml` has no `CORS_ALLOWED_ORIGINS` environment variable.
The backend reads it from `.env` via `env_file: ./backend/.env`. If the `.env`
file doesn't have it (or has the placeholder `https://api.yourdomain.com`),
production CORS will block the frontend. This is silent — requests fail with
a CORS error in the browser, not a backend error.

`settings.py` line 112: `CORS_ALLOW_ALL_ORIGINS = DEBUG` — if DEBUG is True
(see MED-NEW-01), CORS is open to all. When DEBUG is False, CORS uses only
the `CORS_ALLOWED_ORIGINS` env var.

**Fix:** Add to `backend/.env` on the server:
```env
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```
And validate in the deploy health check that a cross-origin preflight succeeds.

---

#### MED-NEW-04 · `frontend/.env.production` is a placeholder committed to git

`frontend/.env.production` contains:
```
VITE_API_BASE_URL=https://api.yourdomain.com
```

This placeholder is committed to the repo. The CI/CD correctly passes
`VITE_API_BASE_URL` as a build arg (CRIT-03 fix), but `.env.production` is
read by Vite during build **before** build args — and it can shadow the build
arg depending on Vite's precedence rules. The build-arg is correct and takes
precedence, but the placeholder is confusing and could cause issues if the
Dockerfile build arg logic changes.

**Fix:**
```bash
# Remove the file and add to gitignore
git rm --cached frontend/.env.production
echo "frontend/.env.production" >> .gitignore
git commit -m "cleanup: remove frontend .env.production placeholder from git"
```

---

#### MED-NEW-05 · `dedup.sql` in repo — one-time maintenance script that deletes data

`backend/dedup.sql` contains:
```sql
DELETE FROM marketplace_review WHERE id NOT IN (
  SELECT MIN(id) FROM marketplace_review GROUP BY user_id, product_id
);
```

This is a one-time deduplication script. It has no place in the main repo — if
accidentally run again it deletes review data. It's also not protected by any
migration system.

**Fix:**
```bash
git rm backend/dedup.sql
git commit -m "cleanup: remove one-time dedup SQL script from repo"
```

---

#### MED-NEW-06 · Traefik dashboard exposed on plaintext HTTP with no TLS

`docker-compose.prod.yml` has HTTPS/TLS commented out (`# NO HTTPS/ACME — no
domain yet`). The Traefik dashboard is exposed on port 80 behind ForwardAuth —
but the admin credentials travel over HTTP unencrypted. The entire application
runs on HTTP only in production.

This is tracked as a known limitation ("no domain yet"), but it means:
- JWT tokens in API calls travel in plaintext
- Admin sessions are sniffable
- The traefik_acme.json ACME account (see CRIT-NEW-02) is set up but never
  actually activates TLS

**Fix:** This requires a domain. Once you have one:
```yaml
# docker-compose.prod.yml — uncomment and fill:
- "--entrypoints.web.http.redirections.entryPoint.to=websecure"
- "--entrypoints.web.http.redirections.entryPoint.scheme=https"
- "--entrypoints.websecure.address=:443"
- "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
- "--certificatesresolvers.letsencrypt.acme.storage=/etc/traefik/acme.json"
- "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
```

---

### 🟢 LOW

---

#### LOW-NEW-01 · `MessagesPage` reads `username` from `localStorage` — not from auth context

`MessagesPage.tsx` line 17:
```tsx
const username = localStorage.getItem('username') || 'User';
```

Used to determine message alignment (`msg.sender_username === username`). If
the user's username contains different casing or the localStorage key is stale,
messages will appear on the wrong side. Should use the auth context or the
user's ID, not a string comparison on username.

**Fix:** Use sender ID comparison:
```tsx
const currentUserId = parseInt(localStorage.getItem('user_id') || '0');
// In message render:
const isOwn = msg.sender === currentUserId;
```

---

#### LOW-NEW-02 · WS reconnection not implemented in MessagesPage

`MessagesPage.tsx` opens a WebSocket on mount and closes on unmount. There is
no reconnection logic — if the connection drops (server restart, network
hiccup), the user's chat goes silent with no indication. Messages sent by the
other party are lost until the user refreshes.

**Fix:** Add exponential backoff reconnect:
```tsx
const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const connectWS = useCallback(() => {
  const ws = new WebSocket(wsUrl);
  ws.onclose = () => {
    reconnectRef.current = setTimeout(connectWS, 3000); // retry in 3s
  };
  // ... rest of handlers
}, [wsUrl]);
useEffect(() => {
  connectWS();
  return () => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
  };
}, [connectWS]);
```

---

#### LOW-NEW-03 · CI test job installs packages without caching

`.github/workflows/deploy.yml` test job runs `pip install -r backend/requirements.txt`
on every push with no cache. Each CI run installs ~50 packages from scratch.

**Fix — add pip cache to test job:**
```yaml
- uses: actions/setup-python@v4
  with:
    python-version: '3.11'
    cache: 'pip'
    cache-dependency-path: backend/requirements.txt
```

---

#### LOW-NEW-04 · `REPO_OWNER` case handling is inconsistent between build and deploy jobs

In the `build-and-push` job: `REPO_OWNER` is set via `${GITHUB_REPOSITORY_OWNER,,}` (bash lowercase).
In the `deploy` job: the SSH script manually does `tr '[:upper:]' '[:lower:]'`.

If `GITHUB_REPOSITORY_OWNER` is already lowercase (it always is on GitHub), this
is harmless. But it's inconsistent — two places that must agree on the same
value are using different code. A single workflow-level env var is cleaner:

```yaml
env:
  REGISTRY: ghcr.io
  REPO_OWNER: ${{ github.repository_owner }}  # GitHub normalizes this to lowercase
```

---

## PART 4 — SCORCHED EARTH PRIORITIZED FIX ORDER

Execute in this exact order. Do not skip to "easier" items.

### PHASE 0 — SECURITY EMERGENCY (do before next commit)

```bash
# Step 1: Remove all secrets and private keys from tracking
git rm --cached certs/cert.pem certs/key.pem
git rm --cached traefik_acme.json
git rm --cached backend/db.sqlite3
git rm --cached backend/server.log
git rm --cached frontend/.env.production
git rm --cached backend/dedup.sql

# Step 2: Remove the entire .venv and compiled artifacts
git rm -r --cached backend/.venv
git rm -r --cached backend/static_collected/ backend/staticfiles/
git rm -r --cached backend/media/
# Also remove all __pycache__ that aren't inside .venv
find backend -name "__pycache__" -not -path "*/\.venv/*" | xargs git rm -r --cached 2>/dev/null || true

# Step 3: Update .gitignore to lock these out
cat >> .gitignore << 'EOF'
traefik_acme.json
backend/db.sqlite3
backend/server.log
frontend/.env.production
backend/dedup.sql
backend/static_collected/
backend/staticfiles/
backend/media/
EOF

# Step 4: Commit
git commit -m "security: purge private keys, database, venv, and build artifacts from git"

# Step 5: Purge from history (REQUIRED — keys are already public on GitHub)
pip install git-filter-repo
git filter-repo --path certs/key.pem --invert-paths --force
git filter-repo --path traefik_acme.json --invert-paths --force
git filter-repo --path backend/db.sqlite3 --invert-paths --force
git filter-repo --path backend/.venv --invert-paths --force
git push --force-with-lease

# Step 6: Revoke the compromised Let's Encrypt account
# Go to https://acme-v02.api.letsencrypt.org and revoke account 3287068365
# or contact Let's Encrypt support
```

### PHASE 1 — FUNCTIONAL BUGS

**Fix CRIT-NEW-03 (shipping fee NaN):**
```tsx
// frontend/src/pages/CheckoutPage.tsx line 36
const shippingFee = shippingMethod === 'DELIVERY'
  ? (deliveryZones.length > 0 ? (selectedZone ? Number(selectedZone.delivery_fee) : 0) : 5000)
  : 0;
```

**Fix CRIT-NEW-04 (real-time chat broken):**
Add `receive()` to `ChatConsumer` and add `channel_layer.group_send()` to
the messages POST endpoint (full code above in CRIT-NEW-04 section).

**Fix HIGH-NEW-06 (self-messaging):**
Add the `seller_id == request.user.id` check to `ConversationViewSet.create()`.

### PHASE 2 — CONFIGURATION HARDENING

**Fix MED-NEW-01 (DEBUG default True):**
```python
# settings.py line 11
DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'
```

**Fix MED-NEW-02 (ALLOWED_HOSTS wildcard):**
Remove the `if not DEBUG: ALLOWED_HOSTS.append('*')` block. Set the env var properly.

**Fix MED-NEW-03 (CORS in production):**
Add `CORS_ALLOWED_ORIGINS=https://yourdomain.com` to the server's `.env`.

### PHASE 3 — DEVOPS POLISH

**Fix LOW-NEW-03 (pip cache in CI):**
Add `cache: 'pip'` to the `setup-python` action in the test job.

**Fix MED-NEW-05 (dedup.sql):**
Delete from repo.

**Fix LOW-NEW-02 (WS reconnection):**
Add exponential backoff reconnect to MessagesPage.

---

## PART 5 — ENGINEERED AGENT PROMPT v8

```
You are a senior full-stack engineer working on UZASPEA — a Django + React
e-commerce marketplace for Tanzania. The repo is at:
https://github.com/beatussimon/uzaspea.git

=== ARCHITECTURE ===
Backend: Django 5.1 + DRF + Channels (WebSocket) + Celery + PostgreSQL
Frontend: React + TypeScript + Vite + Tailwind
Infrastructure: Docker Compose + Traefik reverse proxy + AWS Lightsail
CI/CD: GitHub Actions → GHCR (container registry) → SSH deploy to Lightsail
Apps: marketplace (core), staff (internal tools), inspections (vehicle/property)

=== CURRENT STATE: v8 AUDIT ===
Rating: 78/100. 14 of 19 v7 issues fixed. 18 new issues found.

SECURITY EMERGENCIES (must fix before any other work):
1. certs/key.pem — RSA private key committed to git (rotate immediately)
2. traefik_acme.json — Let's Encrypt ACME account private key in git (revoke and rotate)
3. backend/db.sqlite3 — production database with user PII in git (remove and purge history)
4. backend/.venv (10,636 files) — entire Python virtualenv in git (remove and purge history)
5. backend/server.log — server logs with potential PII in git

CRITICAL FUNCTIONAL BUGS:
- CheckoutPage line 36: `selectedZone.fee` should be `selectedZone.delivery_fee` (NaN shipping fee)
- ChatConsumer: missing `receive()` method AND no `channel_layer.group_send()` in messages POST — real-time chat sends but recipients never receive
- ConversationViewSet.create(): no check for self-messaging (seller == buyer)

CONFIGURATION BUGS:
- settings.py: `DEBUG` defaults to 'True' (should default False)
- settings.py: `ALLOWED_HOSTS.append('*')` unconditionally in production (security bypass)
- CORS_ALLOWED_ORIGINS not set in production docker-compose.prod.yml

=== RULES ===
1. Always run `python manage.py check` before declaring backend done.
2. Always run `npm run build` before declaring frontend done — zero TS errors required.
3. Never hardcode credentials, IPs, or secrets. Always use env vars.
4. Never commit: .venv, __pycache__, *.pyc, *.sqlite3, *.log, media/, staticfiles/,
   static_collected/, *.pem, traefik_acme.json, *.env (not .env.example).
5. Every new API endpoint needs: authentication check, ownership check, input validation.
6. Fixes must not break existing tests. Add tests for new critical paths.
7. Do not change database schema without creating a migration.
8. WebSocket consumers must handle: connect (auth), receive (validate + save + broadcast),
   disconnect (cleanup). All three methods are required for bidirectional WS.

=== DO NEXT IN ORDER ===

PHASE 0 — EMERGENCY (before any other commit):
  git rm --cached certs/key.pem certs/cert.pem traefik_acme.json backend/db.sqlite3
  git rm --cached backend/server.log frontend/.env.production backend/dedup.sql
  git rm -r --cached backend/.venv backend/static_collected/ backend/staticfiles/ backend/media/
  Update .gitignore to block all of the above permanently.
  git commit then git filter-repo to purge history.
  Revoke and regenerate the compromised Let's Encrypt ACME account.

PHASE 1 — FUNCTIONAL:
  1. Fix CheckoutPage line 36: selectedZone.fee → selectedZone.delivery_fee
  2. Add receive() to ChatConsumer (full implementation above in audit CRIT-NEW-04)
  3. Add channel_layer.group_send() to ConversationViewSet.messages() POST
  4. Add self-messaging guard to ConversationViewSet.create()

PHASE 2 — CONFIGURATION:
  5. settings.py: DEBUG default → 'False'
  6. settings.py: remove ALLOWED_HOSTS wildcard block
  7. server .env: add CORS_ALLOWED_ORIGINS=https://yourdomain.com

PHASE 3 — DEVOPS:
  8. CI: add pip cache to test job (cache: 'pip')
  9. Remove dedup.sql from repo
  10. Add WS reconnection logic to MessagesPage.tsx

=== VERIFICATION SEQUENCE ===
# After all fixes:
cd backend
python manage.py check                    # zero errors
python manage.py test --verbosity=1      # all tests pass

cd ../frontend
npm run build                             # zero TS errors

# Docker smoke test:
docker compose build --no-cache
docker compose up -d
curl http://localhost/api/site-settings/              # 200
curl http://localhost/api/variants/?product=1         # 200 (no auth)
curl -X POST http://localhost/api/conversations/ \
  -H "Authorization: Bearer $JWT" \
  -d '{"seller": "'$USER_ID'", "product": 1}' \
  -H "Content-Type: application/json"                # 400 self-messaging

# WS chat e2e:
# Terminal 1: connect as user A
# Terminal 2: connect as user B
# User A sends message via WS → User B onmessage fires (MUST work)

# Verify no secrets in git:
git ls-files | grep -E "key\.pem|acme\.json|\.sqlite3|\.venv" | wc -l  # must be 0

# Verify repo size after cleanup:
du -sh .git    # should be <20MB, not 200MB+
```

---

*UZASPEA Scorched Earth Audit v8 — April 30, 2026*
*Audited from fresh clone of commit 0f79b146*
