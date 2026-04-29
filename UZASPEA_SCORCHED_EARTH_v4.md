# UZASPEA — SCORCHED EARTH AUDIT v4
# Agent Scorecard + New Feature Bugs + Master Fix Prompt

---

## PART 1 — AGENT SCORECARD (Latest Commit)

### ✅ FIXED SINCE LAST AUDIT
| ID | What |
|----|------|
| C-16 | Inspection ID race condition → UUID suffix |
| S-12 | Follow M2M clash removed, Follow model is canonical |
| S-11 | PaymentConfirmation signal activates Subscription |
| M-02 | Stock restored on cancellation |
| M-07 | WebSocket buyer auth guard |
| L-08 | SHIPPED excluded from cancellable |
| L-10 | get_or_create for report shell |
| L-11 | total_flags incremented |
| L-12 | expires_at set on sponsored approval |
| Recharts | ResponsiveContainer has flex-1 min-h-0 parent |

### ❌ STILL BROKEN + NEW BUGS FOUND

**Score: ~35/68 from previous audit fixed ≈ 51%**

New bugs from this audit (feature requests + deep code):

---

## PART 2 — FULL BUG LIST (New + Remaining)

---

### CRITICAL — BREAKS CORE WORKFLOWS

**X-01 · `LipaNumber` has no `seller` FK — payment numbers are global, not per-store**
`LipaNumber` model: `network FK, number, name` — no `seller`/`user` field. Every order in `OrdersPage` says "pay to any of the store's numbers" but there is no API to fetch the SPECIFIC seller's payment numbers. The buyer has no idea who to pay. The seller has no dashboard to add/edit their own Lipa numbers. This is the core offline payment flow and it is completely broken.

**Fix:**
1. Add `seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lipa_numbers')` to `LipaNumber`
2. Add `is_active = models.BooleanField(default=True)` and `display_name = models.CharField(max_length=100, blank=True)`
3. Add `LipaNumberViewSet` with `permission_classes = [IsAuthenticated]`, `get_queryset` scoped to `seller=request.user` for write, public read by seller username
4. Add to seller dashboard: a "Payment Numbers" management section (add/edit/delete)
5. In `OrdersPage`, fetch `GET /api/lipa-numbers/?seller={seller_username}` when order is `AWAITING_PAYMENT` and display each number with network logo/name

---

**X-02 · `InspectionCategory` has NO link to marketplace `Category` — wrong checklist is always selected**
When a user requests an inspection for a marketplace product, `InspectionRequest.category` is an `InspectionCategory` but `Product.category` is a marketplace `Category`. There is zero mapping between them. A user selling a Toyota Corolla under marketplace category "Cars" selects an inspection category manually — they can pick "Electronics → Phones" checklist for a car inspection. Nothing prevents or guides this. The wrong checklist produces meaningless results.

**Fix:**
1. Add `marketplace_category = models.ForeignKey('marketplace.Category', null=True, blank=True, on_delete=models.SET_NULL, related_name='inspection_categories')` to `InspectionCategory`
2. When `InspectionRequest.marketplace_product` is set, auto-suggest matching `InspectionCategory` by comparing `product.category` to `InspectionCategory.marketplace_category`
3. Add API endpoint: `GET /api/inspections/categories/suggest/?product_id=X` → returns ranked matching inspection categories
4. In the inspection request frontend form, when a marketplace product is selected, auto-populate the category dropdown filtered to matching inspection categories
5. Add a validation warning (not hard block) if the selected inspection category's domain doesn't match the product's category tree

---

**X-03 · Checklist templates are surface-level (4–5 items) — inspection is not credible**
Current checklists: Cars=5 items, Phones=4 items, Residential=4 items. A professional vehicle inspection has 50–80 checkpoints. An electronics inspection has 20–30. Property has 60+. The current depth makes the inspection service non-credible and legally useless.

**Fix:** Replace `seed_inspections.py` with comprehensive templates. Full item lists below in the agent prompt section.

---

**X-04 · `tier` field on `UserProfile` missing `'free'` choice — free users have no tier**
`UserProfile.tier` choices: `[('standard', 'Standard'), ('premium', 'Premium')]`. `default='standard'`. A new user with no subscription should be `'free'` — standard and premium are paid tiers. This means every user born into the system appears as a paying customer. Tier-gating logic (product limits, promotion eligibility, inspection discounts) is fundamentally wrong.

**Fix:**
```python
tier = models.CharField(
    max_length=20,
    choices=[('free', 'Free'), ('standard', 'Standard'), ('premium', 'Premium')],
    default='free'  # FIX X-04
)
```
Update `activate_subscription_on_payment_approval` signal to set `'standard'` or `'premium'` based on tier name. Update all tier-gating checks.

---

**X-05 · `PromotedProductsRow` is a horizontal scroll of 1 product per slot — not a proper featured grid**
The component uses `flex overflow-x-auto snap-x` with `min-w-[200px]` per item. The ask is a multi-product featured section (like a proper "Featured" grid block), clearly marked as promoted, showing 2–4 products per row depending on screen size, contained in a distinct visual block. Currently it looks like an afterthought scroll strip.

**Fix:** Replace with a responsive grid layout:
- Desktop: 4 products per row
- Tablet: 2–3 per row
- Mobile: 2 per row (half-width cards)
- Visual container: branded border, gradient header, "Sponsored" pill per card
- Show up to 8 promoted products (not unlimited scroll)
- Add "View All Promoted" link if >8

---

**X-06 · Recharts `ResponsiveContainer` warning: width/height must be > 0**
`ResponsiveContainer width="100%" height="100%"` inside a `flex-1 min-h-0` parent. The warning fires because on first render the parent has 0 height before CSS layout resolves. React strict mode makes this worse.

**Fix:** Use explicit pixel height as fallback and add `isAnimationActive={false}` on first render:
```tsx
// Replace height="100%" with explicit pixel value
<ResponsiveContainer width="100%" height={280}>
```
For every chart in `DashboardLayout.tsx` and any staff panel charts: replace `height="100%"` with `height={280}` (or appropriate fixed value). Remove the `flex-1 min-h-0` wrapper — just give the chart container a fixed height class: `h-[280px]`.

---

**X-07 · Settings page linked in nav but doesn't exist — 404 on click**
`DashboardLayout.tsx` line 261: `<Settings size={16} /> Settings` is rendered as a nav link but there is no `SettingsPage` component, no route in `App.tsx`, no settings API endpoint. User clicks Settings → blank/404.

**Fix:** Create `frontend/src/pages/dashboard/SettingsPage.tsx` with:
- Profile settings (name, bio, phone, profile picture, banner)
- Store settings (store display name, description)
- Notification preferences (email on order, email on review)
- Password change
- Tier/subscription status display with upgrade CTA
- Account deletion request

Backend: `GET/PATCH /api/settings/` endpoint returning user+profile combined.

---

**X-08 · Help & Support Center doesn't exist anywhere**
`DashboardLayout.tsx` line 264: `<HelpCircle size={16} /> Support` — same as above, no component, no route, no backend.

**Fix:**

**Backend models** (add to `marketplace/models.py`):
```python
class FAQ(models.Model):
    question = models.CharField(max_length=500)
    answer = models.TextField()
    category = models.CharField(max_length=50, choices=[
        ('orders', 'Orders'), ('payments', 'Payments'),
        ('inspections', 'Inspections'), ('account', 'Account'),
        ('general', 'General')
    ], default='general')
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'order']

class SupportTicket(models.Model):
    STATUS_CHOICES = [('open','Open'),('in_progress','In Progress'),('resolved','Resolved'),('closed','Closed')]
    CATEGORY_CHOICES = [('order_issue','Order Issue'),('payment_issue','Payment Issue'),
                        ('account_issue','Account Issue'),('inspection_issue','Inspection Issue'),
                        ('bug_report','Bug Report'),('other','Other')]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets', null=True, blank=True)
    name = models.CharField(max_length=100)
    email = models.EmailField()
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='assigned_tickets')
    staff_notes = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
```

**Backend API:**
```python
# GET /api/faq/ — public, filterable by category
# POST /api/support-tickets/ — authenticated or anonymous (name+email required)
# Staff: GET/PATCH /api/staff/support-tickets/ — manage tickets, assign, resolve
# Staff: CRUD /api/staff/faq/ — create/edit/publish FAQ entries
```

**Frontend `HelpCenterPage.tsx`:**
- Header with company contact info (phone, email, address — from settings)
- Search bar filtering FAQ
- Accordion FAQ by category
- "Submit a Ticket" form (name, email, category, subject, message)
- Shows ticket confirmation on submit

**Staff panel:** Ticket management table with status filter, assign to staff, reply/notes, mark resolved.

---

**X-09 · Follow system: no follow/unfollow API action, no UI in ProfilePage**
`Follow` model exists. `ProfilePage.tsx` has zero follow-related code. No `FollowViewSet` or action in `api_views.py`. Followers/following counts not shown. Following feed (products from followed sellers) doesn't exist.

**Fix:**
```python
# api_views.py - add to UserProfileViewSet
@decorators.action(detail=True, methods=['post'], url_path='follow')
def follow(self, request, pk=None):
    profile = self.get_object()
    if profile.user == request.user:
        return Response({'error': 'Cannot follow yourself'}, status=400)
    Follow.objects.get_or_create(follower=request.user, following=profile)
    return Response({'following': True, 'followers_count': profile.get_followers_count()})

@decorators.action(detail=True, methods=['post'], url_path='unfollow')
def unfollow(self, request, pk=None):
    profile = self.get_object()
    Follow.objects.filter(follower=request.user, following=profile).delete()
    return Response({'following': False, 'followers_count': profile.get_followers_count()})
```

`ProfilePage.tsx`: Add Follow/Unfollow button, show follower/following counts, "is_following" state from API.

---

**X-10 · Order placement redirects to `/orders?highlight=ID` but doesn't open/scroll to that order**
`CheckoutPage.tsx` line 69: `navigate('/orders?highlight=${orderId}')`. `OrdersPage.tsx` does not read the `highlight` query param, does not auto-scroll, does not auto-expand the highlighted order. The user lands on a list with no visual feedback about which order they just placed.

**Fix in `OrdersPage.tsx`:**
```typescript
const [searchParams] = useSearchParams();
const highlightId = searchParams.get('highlight');

// On load, scroll to and expand highlighted order
useEffect(() => {
    if (highlightId && orders.length > 0) {
        setExpandedOrderId(parseInt(highlightId));
        setTimeout(() => {
            document.getElementById(`order-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
}, [highlightId, orders]);

// Add id to order card div:
<div id={`order-${order.id}`} ...>
```

Also: after order redirect, the `AWAITING_PAYMENT` section should show the seller's Lipa numbers prominently (fix X-01).

---

**X-11 · Staff panel shows all tasks/inspections to all staff — no department/role scoping**
Staff with different roles (inspection reviewer, content moderator, support agent) all see the same dashboard. An inspection reviewer should see inspection tasks; a support agent should see tickets. Currently `StaffDashboardView` does filter by `assigned_to` and department but the frontend `StaffAdminLayout.tsx` renders everything to everyone.

**Fix:** Read `staff_profile.role` or `department` from the JWT/profile API and conditionally render nav items and dashboard sections.

---

**X-12 · `UserProfile.tier` default `'standard'` means new users appear as paid — gate features correctly**
Already flagged as X-04 above. Additionally: the dashboard shows "Upgrade to Premium" even for users who are already premium because the tier comparison logic doesn't account for the three-tier system properly.

---

**X-13 · Remaining unfixed code bugs from previous audits**
Still not fixed (confirmed in this commit):
- **C-14**: `SubscriptionForm.clean_email()` queries `Subscription` not `NewsletterSubscription` → crashes newsletter signup
- **C-15**: `models_subscription.py` ghost file still exists
- **C-17**: `CategorySerializer.get_children()` no depth limit → stack overflow risk
- **S-07**: `UserProfileSerializer` `is_verified` and `tier` still writable by any user
- **S-15**: `IsStaffMember` bare `except:` still present
- **S-17**: `ProductViewSet` filters `is_available=True` — sellers can't see own unavailable products
- **S-18**: `api.ts` hardcodes `localhost:8000`
- **L-14**: `OrdersPage` subtotal shows `total_amount` (includes shipping) as subtotal — math wrong
- **L-15**: `AWAITING_PAYMENT` self-transition still in services.py
- **L-18**: `TaskSerializer.assigned_to` still `read_only`
- **L-19**: `seller_stats` revenue includes CART/CANCELLED orders
- **L-20**: WebSocket no exponential backoff

---

### DEVOPS — Still Broken
- **DEVOPS-01**: Dockerfile still uses `gunicorn wsgi` → WebSockets dead in production
- **DEVOPS-02**: Settings DB still SQLite
- **DEVOPS-03**: Redis hardcoded `127.0.0.1`
- **DEVOPS-04**: No nginx service in compose
- **DEVOPS-05**: No celery worker/beat in compose
- **DEVOPS-06**: `env_file: .env` wrong path
- **DEVOPS-07**: Redis no healthcheck
- **DEVOPS-08**: Backend volume overwrites image
- **DEVOPS-09**: `collectstatic || true` silently fails
- **DEVOPS-10**: No migrate at startup
- **DEVOPS-11**: Frontend nginx no SPA routing conf
- **DEVOPS-12**: Frontend api.ts hardcodes localhost
- **DEVOPS-14**: .env.example missing DB/Redis vars
- **DEVOPS-15**: No SECURE_HSTS/SSL security headers
- **DEVOPS-16**: Postgres default password hardcoded
- **DEVOPS-17**: No .dockerignore
- **DEVOPS-18**: Celery task exists but no celery service
- **DEVOPS-19**: `npm install` not `npm ci`

---

## PART 3 — MASTER AGENT FIX PROMPT

```
You are a senior Django/React/DevOps engineer. Fix all items below completely. No partial fixes. No new features beyond what is specified. Add comment # FIX [ID] on changed lines. After all fixes: python manage.py check (zero errors), npm run build (zero TS errors), docker compose build (succeeds).
```

---

### FIX X-01 — Lipa Numbers Per Seller

**`backend/marketplace/models.py`** — modify `LipaNumber`:
```python
class LipaNumber(models.Model):
    seller = models.ForeignKey(          # FIX X-01: per-seller payment info
        User, on_delete=models.CASCADE, related_name='lipa_numbers'
    )
    network = models.ForeignKey(MobileNetwork, related_name='lipa_numbers', on_delete=models.CASCADE)
    number = models.CharField(max_length=30)
    name = models.CharField(max_length=100, help_text="Account or payee name shown to buyer")
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['display_order', 'network__name']
        unique_together = ('seller', 'network', 'number')

    def __str__(self):
        return f"{self.seller.username} — {self.network.name}: {self.number} ({self.name})"
```

Run migration: `python manage.py makemigrations marketplace`

**`backend/marketplace/api_views.py`** — add `LipaNumberViewSet`:
```python
class LipaNumberViewSet(viewsets.ModelViewSet):
    """FIX X-01: per-seller Lipa numbers — sellers manage their own, buyers read by seller username."""
    serializer_class = LipaNumberSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        seller_username = self.request.query_params.get('seller')
        if seller_username:
            # Public: fetch a specific seller's active payment numbers (shown to buyer on order page)
            return LipaNumber.objects.filter(
                seller__username=seller_username, is_active=True
            ).select_related('network')
        if self.request.user.is_authenticated:
            # Seller: manage their own numbers
            return LipaNumber.objects.filter(seller=self.request.user).select_related('network')
        return LipaNumber.objects.none()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)  # FIX X-01: always owned by requester
```

**`backend/marketplace/serializers.py`** — add `LipaNumberSerializer`:
```python
class LipaNumberSerializer(serializers.ModelSerializer):
    network_name = serializers.CharField(source='network.name', read_only=True)
    network_logo = serializers.ImageField(source='network.logo', read_only=True)

    class Meta:
        model = LipaNumber
        fields = ['id', 'network', 'network_name', 'network_logo', 'number', 'name',
                  'is_active', 'display_order']
        read_only_fields = ['seller']
```

**`backend/marketplace/urls.py`** — register:
```python
router.register(r'lipa-numbers', LipaNumberViewSet, basename='lipa-number')
```

**`frontend/src/pages/dashboard/DashboardLayout.tsx`** — add "Payment Numbers" section to seller dashboard:
```tsx
// In the sidebar nav, add:
{ label: 'Payment Numbers', icon: <CreditCard size={16}/>, path: 'payment-numbers' }

// New sub-component PaymentNumbersManager:
const PaymentNumbersManager: React.FC = () => {
    const [lipaNumbers, setLipaNumbers] = useState<any[]>([]);
    const [networks, setNetworks] = useState<any[]>([]);
    const [form, setForm] = useState({ network: '', number: '', name: '' });
    const [editingId, setEditingId] = useState<number|null>(null);

    useEffect(() => {
        api.get('/api/lipa-numbers/').then(r => setLipaNumbers(r.data.results || r.data));
        api.get('/api/mobile-networks/').then(r => setNetworks(r.data.results || r.data));
    }, []);

    const handleSave = async () => {
        if (editingId) {
            await api.patch(`/api/lipa-numbers/${editingId}/`, form);
        } else {
            await api.post('/api/lipa-numbers/', form);
        }
        // Refresh list
        api.get('/api/lipa-numbers/').then(r => setLipaNumbers(r.data.results || r.data));
        setForm({ network: '', number: '', name: '' });
        setEditingId(null);
        toast.success('Payment number saved');
    };

    const handleDelete = async (id: number) => {
        await api.delete(`/api/lipa-numbers/${id}/`);
        setLipaNumbers(prev => prev.filter(l => l.id !== id));
        toast.success('Removed');
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">Payment Numbers</h2>
            <p className="text-sm text-gray-500">These numbers are shown to buyers when they need to pay for your products offline.</p>
            {/* Form */}
            <div className="card p-5 space-y-3">
                <h3 className="font-bold text-sm">{editingId ? 'Edit Number' : 'Add New Number'}</h3>
                <select value={form.network} onChange={e => setForm({...form, network: e.target.value})} className="input">
                    <option value="">Select Network</option>
                    {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                <input placeholder="Phone Number e.g. 0712345678" value={form.number}
                    onChange={e => setForm({...form, number: e.target.value})} className="input" />
                <input placeholder="Account Name (shown to buyer)" value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})} className="input" />
                <button onClick={handleSave} className="btn-primary w-full">
                    {editingId ? 'Update' : 'Add Number'}
                </button>
            </div>
            {/* List */}
            <div className="space-y-2">
                {lipaNumbers.map(lipa => (
                    <div key={lipa.id} className="card p-4 flex items-center justify-between">
                        <div>
                            <p className="font-bold text-sm">{lipa.network_name}</p>
                            <p className="text-gray-900 dark:text-white font-mono">{lipa.number}</p>
                            <p className="text-xs text-gray-500">{lipa.name}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingId(lipa.id); setForm({network: lipa.network, number: lipa.number, name: lipa.name}); }}
                                className="btn-ghost text-xs">Edit</button>
                            <button onClick={() => handleDelete(lipa.id)} className="btn-ghost text-xs text-red-500">Remove</button>
                        </div>
                    </div>
                ))}
                {lipaNumbers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No payment numbers yet. Add one above.</p>}
            </div>
        </div>
    );
};
```

**`frontend/src/pages/OrdersPage.tsx`** — show seller's Lipa numbers in payment section:
```tsx
// Add state and fetch:
const [sellerLipa, setSellerLipa] = useState<Record<number, any[]>>({});

// When order expands and status is AWAITING_PAYMENT, fetch seller lipa numbers:
const fetchSellerLipa = async (order: any) => {
    if (order.status !== 'AWAITING_PAYMENT') return;
    const sellerUsername = order.items?.[0]?.seller_username;
    if (!sellerUsername || sellerLipa[order.id]) return;
    try {
        const res = await api.get(`/api/lipa-numbers/?seller=${sellerUsername}`);
        setSellerLipa(prev => ({ ...prev, [order.id]: res.data.results || res.data }));
    } catch {}
};

// In the AWAITING_PAYMENT payment section, replace the generic text with:
<div className="mb-4">
    <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
        Pay to these numbers:
    </p>
    {(sellerLipa[order.id] || []).length === 0 ? (
        <p className="text-sm text-yellow-600">The seller has not added payment numbers yet. Contact them directly.</p>
    ) : (
        <div className="space-y-2">
            {(sellerLipa[order.id] || []).map((lipa: any) => (
                <div key={lipa.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Smartphone size={16} className="text-green-600" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase">{lipa.network_name}</p>
                        <p className="font-mono font-black text-gray-900 dark:text-white text-sm">{lipa.number}</p>
                        <p className="text-xs text-gray-500">{lipa.name}</p>
                    </div>
                    <button onClick={() => {navigator.clipboard.writeText(lipa.number); toast.success('Copied!');}}
                        className="ml-auto btn-ghost text-xs py-1 px-2">Copy</button>
                </div>
            ))}
        </div>
    )}
</div>
```

---

### FIX X-02 — Inspection Category Conflict Resolution

**`backend/inspections/models.py`** — add mapping field to `InspectionCategory`:
```python
class InspectionCategory(models.Model):
    # ... existing fields ...
    marketplace_category = models.ForeignKey(  # FIX X-02
        'marketplace.Category',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='inspection_categories',
        help_text='Linked marketplace category for auto-suggestion'
    )
    product_origin = models.CharField(  # FIX X-02: native vs external product type
        max_length=20,
        choices=[('any', 'Any'), ('local', 'Local/Native'), ('imported', 'Imported/External')],
        default='any',
        help_text='Whether this category applies to locally-made or imported products'
    )
```

**`backend/inspections/api_views.py`** — add suggestion endpoint:
```python
class InspectionCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InspectionCategory.objects.filter(is_active=True)
    serializer_class = InspectionCategorySerializer

    @decorators.action(detail=False, methods=['get'])
    def suggest(self, request):
        """FIX X-02: suggest inspection categories for a given marketplace product."""
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({'error': 'product_id required'}, status=400)
        from marketplace.models import Product
        try:
            product = Product.objects.select_related('category', 'category__parent').get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=404)

        # Match by direct marketplace_category link first
        direct = InspectionCategory.objects.filter(
            marketplace_category=product.category, is_active=True
        )
        # Fallback: match by parent category
        parent_match = InspectionCategory.objects.filter(
            marketplace_category=product.category.parent, is_active=True
        ) if product.category.parent_id else InspectionCategory.objects.none()
        # Merge, deduplicate, score
        suggestions = list(direct) + [c for c in parent_match if c not in list(direct)]
        return Response(InspectionCategorySerializer(suggestions, many=True).data)
```

Run migration: `python manage.py makemigrations inspections`

---

### FIX X-03 — Comprehensive Inspection Checklists

**`backend/inspections/management/commands/seed_inspections.py`** — replace entire file:

```python
from django.core.management.base import BaseCommand
from inspections.models import InspectionCategory, ChecklistTemplate, ChecklistItem

class Command(BaseCommand):
    help = 'Seeds comprehensive inspection categories and checklist templates'

    def create_template(self, category, items):
        template, _ = ChecklistTemplate.objects.get_or_create(
            category=category, version=1, defaults={'is_active': True}
        )
        for order_idx, (label, ctype, mandatory, fail_flags, unit, help_text) in enumerate(items):
            ChecklistItem.objects.get_or_create(
                template=template, label=label,
                defaults={
                    'item_type': ctype, 'is_mandatory': mandatory,
                    'order': order_idx, 'fail_triggers_flag': fail_flags,
                    'unit': unit, 'help_text': help_text
                }
            )

    def handle(self, *args, **options):
        # ── VEHICLES DOMAIN ──
        vehicles, _ = InspectionCategory.objects.get_or_create(name='Vehicles', defaults={'level': 'domain', 'base_price': 0})
        cars, _ = InspectionCategory.objects.get_or_create(name='Cars & SUVs', parent=vehicles, defaults={'level': 'category', 'base_price': 60000, 'required_inspector_level': 'senior'})
        motorcycles, _ = InspectionCategory.objects.get_or_create(name='Motorcycles & Boda Boda', parent=vehicles, defaults={'level': 'category', 'base_price': 35000})
        trucks, _ = InspectionCategory.objects.get_or_create(name='Trucks & Commercial', parent=vehicles, defaults={'level': 'category', 'base_price': 90000, 'required_inspector_level': 'specialist'})

        # ── ELECTRONICS DOMAIN ──
        electronics, _ = InspectionCategory.objects.get_or_create(name='Electronics', defaults={'level': 'domain', 'base_price': 0})
        phones, _ = InspectionCategory.objects.get_or_create(name='Smartphones & Tablets', parent=electronics, defaults={'level': 'category', 'base_price': 25000})
        laptops, _ = InspectionCategory.objects.get_or_create(name='Laptops & Computers', parent=electronics, defaults={'level': 'category', 'base_price': 35000, 'required_inspector_level': 'senior'})
        tv_audio, _ = InspectionCategory.objects.get_or_create(name='TVs & Audio Equipment', parent=electronics, defaults={'level': 'category', 'base_price': 20000})

        # ── PROPERTY DOMAIN ──
        property_domain, _ = InspectionCategory.objects.get_or_create(name='Property', defaults={'level': 'domain', 'base_price': 0})
        residential, _ = InspectionCategory.objects.get_or_create(name='Residential Property', parent=property_domain, defaults={'level': 'category', 'base_price': 150000, 'required_inspector_level': 'specialist'})
        commercial, _ = InspectionCategory.objects.get_or_create(name='Commercial Property', parent=property_domain, defaults={'level': 'category', 'base_price': 200000, 'required_inspector_level': 'specialist'})
        land, _ = InspectionCategory.objects.get_or_create(name='Land & Plots', parent=property_domain, defaults={'level': 'category', 'base_price': 80000, 'required_inspector_level': 'senior'})

        # ── MACHINERY DOMAIN ──
        machinery, _ = InspectionCategory.objects.get_or_create(name='Machinery & Equipment', defaults={'level': 'domain', 'base_price': 0})
        generators, _ = InspectionCategory.objects.get_or_create(name='Generators & Power', parent=machinery, defaults={'level': 'category', 'base_price': 50000, 'required_inspector_level': 'senior'})
        agri, _ = InspectionCategory.objects.get_or_create(name='Agricultural Equipment', parent=machinery, defaults={'level': 'category', 'base_price': 70000, 'required_inspector_level': 'specialist'})

        # ═══ COMPREHENSIVE CHECKLISTS ═══

        # CARS — 45 items
        self.create_template(cars, [
            # Engine & Drivetrain (12 items)
            ('Engine Start & Idle Quality', 'pass_fail', True, True, '', 'Cold start and warm idle — listen for knocking, misfires, rough idle'),
            ('Engine Oil Level & Condition', 'pass_fail', True, True, '', 'Check dipstick — color, level, milky appearance indicates water ingress'),
            ('Coolant Level & Condition', 'pass_fail', True, True, '', 'Check reservoir and radiator cap — rust or oil contamination'),
            ('Transmission Shift Quality (All Gears)', 'scale', True, True, '', 'Test all gears including reverse — slipping, grinding, delays'),
            ('Clutch Engagement Point (Manual)', 'pass_fail', False, False, '', 'Clutch biting point — high biting point indicates wear'),
            ('Engine Oil Leaks (Visual)', 'pass_fail', True, True, '', 'Check under hood and beneath car for oil drips or seeping gaskets'),
            ('Timing Belt/Chain Condition', 'pass_fail', True, True, '', 'Check service history — timing belt typically replaced at 80,000–100,000 km'),
            ('Exhaust Smoke Color & Odor', 'pass_fail', True, True, '', 'Blue=oil burn, White=coolant burn, Black=rich mixture — all fail triggers'),
            ('Power Steering Fluid Level', 'pass_fail', True, False, '', 'Check reservoir — low level may indicate leak'),
            ('Drive Shaft & CV Joints', 'pass_fail', True, True, '', 'Turn steering full lock and accelerate — clicking indicates CV joint failure'),
            ('Fuel System (No Leaks, Correct Pressure)', 'pass_fail', True, True, '', 'Check for fuel smell, leaks at injectors and fuel lines'),
            ('Engine Compression Test', 'measurement', False, True, 'PSI', 'Cylinder compression — deviation >10% between cylinders is fail trigger'),

            # Body & Exterior (10 items)
            ('Paintwork Condition & Color Match', 'scale', True, False, '', 'Use paint thickness gauge if available — respray indicates accident repair'),
            ('Panel Gaps & Alignment', 'scale', True, True, '', 'Uneven gaps indicate accident damage or poor repair'),
            ('Rust & Corrosion Assessment', 'scale', True, True, '', 'Check wheel arches, sills, floor, chassis — structural rust is fail'),
            ('Glass & Windscreen (Chips/Cracks)', 'pass_fail', True, False, '', 'Any crack in driver sight line is mandatory replacement'),
            ('Doors, Boot & Bonnet Operation', 'pass_fail', True, False, '', 'All should open, close and latch smoothly with proper alignment'),
            ('VIN/Chassis Number Verification', 'pass_fail', True, True, '', 'Match chassis plate, windscreen sticker and registration documents — mismatch is fraud flag'),
            ('Undercarriage Rust & Damage', 'pass_fail', True, True, '', 'Lift vehicle or use mirror — check chassis rails, floor pan, crossmembers'),
            ('Airbag System (Warning Light)', 'pass_fail', True, True, '', 'SRS warning light off after startup — if on, system is compromised'),
            ('Headlights, Taillights & Indicators', 'pass_fail', True, False, '', 'All lights operational including hazards, reversing lights, number plate light'),
            ('Wiper Blades & Washer System', 'pass_fail', False, False, '', 'Wiper sweep quality and washer jet aim'),

            # Suspension & Brakes (10 items)
            ('Front Shock Absorbers', 'scale', True, True, '', 'Bounce test — should settle within 1–2 oscillations. Leaking = fail'),
            ('Rear Shock Absorbers', 'scale', True, True, '', 'Same bounce test — note any difference side-to-side'),
            ('Brake Pad Thickness (Front)', 'measurement', True, True, 'mm', 'Minimum legal thickness 3mm — below 2mm immediate fail'),
            ('Brake Pad Thickness (Rear)', 'measurement', True, True, 'mm', 'Check via caliper inspection or wheel removal if accessible'),
            ('Brake Disc Condition (Front & Rear)', 'scale', True, True, '', 'Check for scoring, warping, minimum thickness marking'),
            ('Handbrake Effectiveness', 'pass_fail', True, True, '', 'Should hold vehicle on gradient — count ratchet clicks (optimal 3–5)'),
            ('ABS System (Warning Light)', 'pass_fail', True, False, '', 'ABS light should go off after engine start — test on low-speed brake application'),
            ('Steering Play & Alignment', 'measurement', True, True, 'degrees', 'Measure free play in steering wheel — excessive play indicates worn rack or ball joints'),
            ('Wheel Bearing Condition', 'pass_fail', True, True, '', 'Jack each corner — wobble = bearing play. Spin wheel — grinding = worn bearing'),
            ('Tyre Tread Depth (All Four)', 'measurement', True, True, 'mm', 'Legal minimum 1.6mm — check inside, center, outside with tread gauge'),

            # Interior & Electrics (8 items)
            ('Air Conditioning (Cooling Temp)', 'measurement', True, False, '°C', 'Measure vent temperature — should reach 10–15°C on full cold'),
            ('All Power Windows Operation', 'pass_fail', True, False, '', 'Test up/down smoothness and auto-close on all windows'),
            ('Infotainment, Bluetooth & USB', 'pass_fail', False, False, '', 'Connect phone via Bluetooth and USB — test audio output'),
            ('Instrument Cluster (All Gauges)', 'pass_fail', True, True, '', 'Fuel, temperature, speedometer, warning lights — all should function'),
            ('Seat Belts (All Positions)', 'pass_fail', True, True, '', 'Test latch, retraction, and inertia lock on all seating positions'),
            ('Central Locking & Key Fob', 'pass_fail', False, False, '', 'All doors lock/unlock remotely and manually'),
            ('Interior Condition & Odor', 'scale', True, False, '', 'Mold, smoke, water damage odors — check under floor mats for damp'),
            ('Odometer Reading & Service History', 'text', True, True, '', 'Record exact reading — request full service book or digital history'),

            # Documentation (5 items)
            ('Registration Certificate (Log Book)', 'pass_fail', True, True, '', 'Verify owner name matches seller — request title transfer documents'),
            ('Insurance Certificate Validity', 'pass_fail', True, False, '', 'Note expiry date'),
            ('Road Worthiness Certificate', 'pass_fail', True, True, '', 'Valid certificate from SUMATRA'),
            ('Outstanding Finance Check', 'text', True, True, '', 'Ask seller to confirm no outstanding bank finance — request clearance letter if applicable'),
            ('Accident History Disclosure', 'text', True, True, '', 'Seller declaration of known accident history — cross-check with bodywork findings'),
        ])

        # SMARTPHONES & TABLETS — 28 items
        self.create_template(phones, [
            # Display (6 items)
            ('Screen Burn-In / Ghost Images', 'pass_fail', True, True, '', 'Display all-gray and all-white screens — ghost images indicate OLED burn-in'),
            ('Dead Pixels & Bright Spots', 'pass_fail', True, True, '', 'Display black screen — any lit pixels are dead/stuck pixel defects'),
            ('Touch Sensitivity (All Screen Zones)', 'pass_fail', True, True, '', 'Draw diagonal lines across all screen edges — dead zones indicate damage'),
            ('Screen Glass Condition (Cracks/Scratches)', 'scale', True, False, '', 'Check under bright light at angles — hairline cracks affect resale severely'),
            ('Display Brightness (Max & Auto)', 'measurement', True, False, 'nits', 'Max brightness should match device spec — dim display may indicate degraded backlight'),
            ('Face ID / Fingerprint Reader', 'pass_fail', False, False, '', 'Test biometric unlock — failures may indicate motherboard or sensor damage'),

            # Battery (5 items)
            ('Battery Health Percentage', 'measurement', True, True, '%', 'iOS: Settings > Battery > Battery Health. Android: Use AccuBattery app — below 80% is replacement threshold'),
            ('Charge Port Condition & Function', 'pass_fail', True, True, '', 'Inspect for bent pins, lint — test charging with known-good cable'),
            ('Wireless Charging (if applicable)', 'pass_fail', False, False, '', 'Test with compatible pad — functionality confirms charging coil intact'),
            ('Battery Swelling (Visual)', 'pass_fail', True, True, '', 'Screen lifting from body indicates swollen battery — immediate safety fail'),
            ('Charge Cycle Count', 'measurement', False, False, 'cycles', 'iOS: Use CoconutBattery or similar. Android: Battery info in system settings'),

            # Cameras (4 items)
            ('Rear Camera Photo Quality', 'scale', True, False, '', 'Photograph various subjects — check for autofocus speed, blur, lens marks'),
            ('Front Camera Photo Quality', 'scale', True, False, '', 'Selfie photo test — check sharpness and exposure'),
            ('Video Recording Stability', 'pass_fail', False, False, '', 'Record 30-second video — check stabilization, audio sync, 4K if applicable'),
            ('Camera Lens Condition (No Cracks)', 'pass_fail', True, True, '', 'Inspect physically — cracked lens causes haze in photos'),

            # Connectivity (5 items)
            ('SIM Card Slots & Network Reception', 'pass_fail', True, True, '', 'Insert test SIM — verify signal bars and voice call quality'),
            ('Wi-Fi Connection & Speed', 'pass_fail', True, False, '', 'Connect to known network — run speed test, check 5GHz band if applicable'),
            ('Bluetooth Pairing', 'pass_fail', True, False, '', 'Pair with headphones or speaker — test audio output quality'),
            ('GPS Accuracy', 'pass_fail', False, False, '', 'Open maps app outdoors — verify location accuracy within 10m'),
            ('NFC (if applicable)', 'pass_fail', False, False, '', 'Test with NFC-enabled payment terminal or tag'),

            # Hardware & Software (8 items)
            ('IMEI Verification', 'text', True, True, '', 'Dial *#06# — record both IMEIs. Check blacklist status on GSMA or local registry'),
            ('Speakers & Earpiece Quality', 'pass_fail', True, False, '', 'Play music at max volume — check for distortion. Test earpiece on a call'),
            ('Microphone (Voice & Noise Cancel)', 'pass_fail', True, False, '', 'Record voice memo and play back — check clarity and noise cancellation mic'),
            ('Vibration Motor', 'pass_fail', False, False, '', 'Enable haptic feedback — test vibration intensity and consistency'),
            ('Physical Buttons (Volume, Power, Mute)', 'pass_fail', True, False, '', 'Press all buttons — ensure tactile response and function'),
            ('Operating System Version & Updates', 'text', True, False, '', 'Record OS version — note if device can still receive security updates'),
            ('iCloud/Google Account Lock Status', 'pass_fail', True, True, '', 'Factory reset should proceed without account prompt — activation lock = fraud flag'),
            ('Water Damage Indicator', 'pass_fail', True, True, '', 'Check SIM slot for red water damage indicator strip — red/pink = water damage'),
        ])

        # RESIDENTIAL PROPERTY — 55 items
        self.create_template(residential, [
            # Structure (12 items)
            ('Foundation Condition (Visual)', 'pass_fail', True, True, '', 'Look for cracks, settlement, water staining around foundation'),
            ('Load-Bearing Wall Cracks', 'scale', True, True, '', 'Hairline=monitor, >3mm=structural concern, diagonal cracks=subsidence'),
            ('Roof Structure Integrity', 'pass_fail', True, True, '', 'Access roof space if possible — check for sagging rafters, rot, daylight through roof'),
            ('Roof Covering Condition', 'scale', True, True, '', 'Check tiles/iron sheets — cracked, missing, or rusted sheets cause leaks'),
            ('Ceiling Condition', 'scale', True, False, '', 'Water stains indicate past or current roof/plumbing leaks'),
            ('Floor Level & Structural Integrity', 'pass_fail', True, True, '', 'Check for bouncy or sloping floors indicating joist failure or subsidence'),
            ('External Wall Condition', 'scale', True, False, '', 'Check render, pointing, cracks — note any vegetation growth in cracks'),
            ('Damp Proof Course', 'pass_fail', True, True, '', 'Check for rising damp up to 1m on internal walls — tide marks, salt deposits'),
            ('Lintel Condition (Window & Door Openings)', 'pass_fail', True, True, '', 'Cracks above openings indicate failed or missing lintels'),
            ('Drainage Around Foundation', 'pass_fail', True, True, '', 'Ground should slope away from building — pooling water causes foundation damage'),
            ('Asbestos (if pre-1990 construction)', 'pass_fail', False, True, '', 'Flag any suspected asbestos roof/ceiling sheets — requires specialist test'),
            ('Structural Walls (No Unauthorized Removal)', 'pass_fail', True, True, '', 'Compare with any available plans — removed load-bearing walls are critical safety fail'),

            # Electrical (10 items)
            ('Consumer Unit / Fuse Box Condition', 'pass_fail', True, True, '', 'MCBs present, no scorch marks, proper labelling, RCD present'),
            ('Earthing & Bonding', 'pass_fail', True, True, '', 'Earth rod visible or confirmed — bonding to water and gas pipes'),
            ('Socket Outlets (Sample Test All Rooms)', 'pass_fail', True, True, '', 'Use socket tester — check live, neutral, earth wiring. Note polarity failures'),
            ('Lighting Circuit (All Rooms)', 'pass_fail', True, False, '', 'All light switches operate correct lights — check for non-functional switches'),
            ('ELCB/RCD Function Test', 'pass_fail', True, True, '', 'Press test button on RCD — should trip immediately'),
            ('Wiring Condition (Visible Sections)', 'scale', True, True, '', 'Fabric insulation indicates old pre-1960s wiring — flag for full rewire'),
            ('Outdoor/Garden Electrical Points', 'pass_fail', False, False, '', 'Check weatherproofing and RCD protection on external sockets'),
            ('Electric Meter & Tariff Type', 'text', True, False, '', 'Record meter number and type (prepaid/postpaid) — verify with utility provider'),
            ('Generator/Backup Power Connection', 'pass_fail', False, False, '', 'Check changeover switch — must prevent backfeed to mains grid'),
            ('Security Lighting & External Points', 'pass_fail', False, False, '', 'Motion sensors functional — dusk-to-dawn lights operational'),

            # Plumbing & Water (10 items)
            ('Water Supply Pressure', 'measurement', True, True, 'bar', 'Check pressure at kitchen tap — normal 1–3 bar. Low pressure indicates main issue'),
            ('Hot Water System (Geyser/Boiler)', 'pass_fail', True, False, '', 'Check age, pressure relief valve, anode rod condition, thermostat setting'),
            ('All Taps & Shower Mixers', 'pass_fail', True, False, '', 'Operate all taps — check for drips, correct hot/cold orientation'),
            ('Toilet Flush & Fill Valve', 'pass_fail', True, False, '', 'Flush — check fill time (should be <2 min), no continuous running'),
            ('Drain Waste & Overflow (All Basins/Baths)', 'pass_fail', True, False, '', 'Fill and drain — check flow rate and no backup between fixtures'),
            ('Waste Pipe & Soil Pipe Condition', 'pass_fail', True, True, '', 'Check for leaks, blockages, proper fall gradient, correct venting'),
            ('Roof Gutters & Downpipes', 'pass_fail', True, False, '', 'Check joints for gaps, blockages, and correct fall to downpipe'),
            ('Septic Tank / Sewage Connection', 'text', True, True, '', 'Confirm connection type — if septic: last emptying date, leach field condition'),
            ('Water Meter & Connection', 'text', True, False, '', 'Record meter reading and confirm correct property connection'),
            ('Underground Pipe Condition', 'pass_fail', False, False, '', 'CCTV drain survey recommended for older properties — flagged if suspected blockage'),

            # Security & Safety (8 items)
            ('Door Lock Quality (All External Doors)', 'scale', True, False, '', 'Check deadbolt throw, frame condition, door material thickness'),
            ('Window Locks & Security', 'scale', True, False, '', 'Test all window locks — note any that cannot be secured'),
            ('Perimeter Wall / Fence Condition', 'scale', True, False, '', 'Check height, structural integrity, anti-climb measures'),
            ('Gate & Gate Motor', 'pass_fail', False, False, '', 'Gate motor operation, remote function, manual override'),
            ('Smoke Detectors', 'pass_fail', True, True, '', 'Test each detector — mandatory in bedrooms and hallways'),
            ('Fire Extinguisher (Present & Valid)', 'pass_fail', False, False, '', 'Check pressure gauge and service date'),
            ('CCTV System (if present)', 'pass_fail', False, False, '', 'Check camera coverage, recording function, night vision'),
            ('Burglar Alarm System', 'pass_fail', False, False, '', 'Test arm/disarm — verify zones cover all entry points'),

            # Interior Finishes (8 items)
            ('Kitchen Units & Worktops', 'scale', True, False, '', 'Check door hinges, worktop condition, water damage under sink'),
            ('Bathroom Tiles & Grouting', 'scale', True, False, '', 'Loose tiles indicate water ingress behind — press each tile to check'),
            ('Floor Covering Condition (All Rooms)', 'scale', True, False, '', 'Tiles, timber, carpet — note damage, lifting edges, squeaks'),
            ('Internal Door Condition & Operation', 'scale', True, False, '', 'All should close and latch — sticking indicates structural movement'),
            ('Wall Finishes & Paintwork', 'scale', False, False, '', 'Note cracks, staining, flaking paint — may indicate damp'),
            ('Built-In Storage & Wardrobes', 'scale', False, False, '', 'Check internal condition, hinges, rail strength'),
            ('Kitchen Appliances (if included)', 'pass_fail', False, False, '', 'Test cooker, oven, extractor, dishwasher if included in sale'),
            ('Air Conditioning Units', 'pass_fail', False, False, '', 'Test cooling and heating modes — check filter condition and drainage'),

            # Documentation & Compliance (7 items)
            ('Title Deed Verification', 'text', True, True, '', 'Original title deed — check owner name, plot number, registered area'),
            ('Survey Plan (Cadastral)', 'text', True, True, '', 'Compare physical boundaries with survey plan — encroachments are fail'),
            ('Building Permit & Approved Plans', 'pass_fail', True, True, '', 'All structures must have approved permits — unauthorized extensions are flagged'),
            ('Occupancy Certificate', 'pass_fail', True, True, '', 'Certificate of occupancy from municipality — required for habitation'),
            ('Land Rates & Service Charges (Up to Date)', 'text', True, True, '', 'Request rates clearance certificate — unpaid rates transfer to new owner'),
            ('Utility Bills & Accounts', 'text', True, False, '', 'Check water and electricity accounts are in seller name — request clearance'),
            ('Encumbrances & Caveats', 'text', True, True, '', 'Search title for mortgages, caveats, court orders — any found = fail trigger'),
        ])

        # LAPTOPS — 22 items
        self.create_template(laptops, [
            ('Display (Dead Pixels, Backlight Bleed)', 'pass_fail', True, True, '', 'Display solid colors — check corners for backlight bleed'),
            ('Screen Hinge Condition', 'scale', True, False, '', 'Open/close — should hold position at all angles without wobble'),
            ('Keyboard (All Keys Function)', 'pass_fail', True, False, '', 'Use keyboard test website — check every key including Fn combinations'),
            ('Trackpad (Click & Gesture)', 'pass_fail', True, False, '', 'Test click, right-click, two-finger scroll, pinch-to-zoom'),
            ('Battery Cycle Count & Health', 'measurement', True, True, 'cycles', 'Windows: powercfg /batteryreport. Mac: System Info > Power — note design vs full capacity'),
            ('RAM Amount & Type', 'text', True, False, 'GB', 'Verify installed RAM matches advertised spec'),
            ('Storage Drive Health (SMART Data)', 'pass_fail', True, True, '', 'Run CrystalDiskInfo (Win) or DiskScan (Mac) — any SMART warnings = fail trigger'),
            ('Storage Capacity & Type (SSD/HDD)', 'text', True, False, 'GB', 'Verify actual storage matches spec — check if original or upgraded'),
            ('Processor (Benchmark Score)', 'measurement', False, False, 'score', 'Run Cinebench or PassMark — compare to known good score for that CPU'),
            ('GPU (if dedicated) Function', 'pass_fail', False, False, '', 'Stress test with GPU-Z or render test — check temperatures and artifacts'),
            ('USB Ports (All Types & Speeds)', 'pass_fail', True, False, '', 'Test each USB port with USB 3.0 drive — verify transfer speed'),
            ('HDMI / DisplayPort Output', 'pass_fail', False, False, '', 'Connect external monitor — verify signal and resolution'),
            ('Wi-Fi & Bluetooth', 'pass_fail', True, False, '', 'Connect to 5GHz and 2.4GHz — run speed test'),
            ('Webcam & Microphone', 'pass_fail', True, False, '', 'Test video call quality — check autofocus and audio clarity'),
            ('Speakers & Headphone Jack', 'pass_fail', True, False, '', 'Play audio — check for distortion at volume. Test 3.5mm jack'),
            ('Cooling System (Temperatures Under Load)', 'measurement', True, True, '°C', 'Run stress test for 5 min — CPU should not exceed 95°C. Throttling = fail'),
            ('Chassis Condition (Cracks, Warping)', 'scale', True, False, '', 'Check lid, base, and palm rest — cracks near hinge indicate drop damage'),
            ('Serial Number & BIOS Info', 'text', True, True, '', 'Record serial — check against any blacklist or theft registry'),
            ('Operating System & License', 'text', True, False, '', 'Note OS version and whether license is genuine and transferable'),
            ('Charger & Cable Condition', 'pass_fail', False, False, '', 'Check charger for fraying, correct wattage, and charging speed'),
            ('Battery Run-Time Test', 'measurement', True, False, 'hours', 'Discharge from 100% at normal load — note time to 20%'),
            ('Fan Noise & Vibration', 'scale', True, False, '', 'Excessive fan noise at idle indicates cooling paste degradation or failing fan'),
        ])

        # GENERATORS — 18 items
        self.create_template(generators, [
            ('Engine Start (Cold & Warm)', 'pass_fail', True, True, '', 'Cold start without choke assistance after warm-up — ease of starting indicates condition'),
            ('Engine Oil Level & Condition', 'pass_fail', True, True, '', 'Check dipstick — dark sludge indicates neglected maintenance'),
            ('Output Voltage (No Load)', 'measurement', True, True, 'V', '220–240V nominal — outside ±10% indicates regulator fault'),
            ('Output Voltage (Full Load)', 'measurement', True, True, 'V', 'Apply rated load — voltage should remain stable within ±5%'),
            ('Output Frequency', 'measurement', True, True, 'Hz', '50Hz nominal — check with meter under load'),
            ('Fuel Leaks (Tank, Lines, Carb)', 'pass_fail', True, True, '', 'Fuel smell or drips — immediate fail, fire hazard'),
            ('Air Filter Condition', 'scale', True, False, '', 'Remove and inspect — heavily clogged affects performance'),
            ('Spark Plug Condition', 'scale', True, False, '', 'Remove plug — check electrode gap, carbon fouling, oil fouling'),
            ('Automatic Voltage Regulator (AVR)', 'pass_fail', True, True, '', 'Confirm AVR type and operation — protects connected equipment'),
            ('Circuit Breaker & Overload Protection', 'pass_fail', True, True, '', 'Test trip function — breaker should trip at rated amperage'),
            ('Earth Connection', 'pass_fail', True, True, '', 'Verify proper earth stake connected — essential for safety'),
            ('Fuel Tank Capacity & Condition', 'measurement', True, False, 'L', 'Confirm tank capacity, check for rust inside tank'),
            ('Runtime Per Tank (Tested)', 'measurement', True, False, 'hours', 'Run until empty at 75% load — compare to manufacturer spec'),
            ('Noise Level', 'measurement', False, False, 'dB', 'Measure at 7 metres — relevant for residential use'),
            ('Control Panel (Meters & Switches)', 'pass_fail', True, False, '', 'All meters and switches operational — hourmeter shows actual use'),
            ('Battery (Electric Start Models)', 'pass_fail', False, False, '', 'Battery condition and cold cranking performance'),
            ('Frame & Body Condition', 'scale', True, False, '', 'Rust, cracks in frame, wheel condition'),
            ('Service History & Hours', 'text', True, False, 'hours', 'Record hourmeter reading — oil change due every 250 hours'),
        ])

        self.stdout.write(self.style.SUCCESS('Seeded comprehensive inspection checklists successfully'))
```

---

### FIX X-04 — Add 'free' tier to UserProfile

**`backend/marketplace/models.py`** → `UserProfile.tier`:
```python
tier = models.CharField(
    max_length=20,
    choices=[('free', 'Free'), ('standard', 'Standard'), ('premium', 'Premium')],
    default='free'  # FIX X-04: new users are free, not standard
)
```

Update the signal `activate_subscription_on_payment_approval`:
```python
if instance.tier:
    tier_name_lower = instance.tier.name.lower()
    if 'premium' in tier_name_lower:
        profile.tier = 'premium'
    elif 'standard' in tier_name_lower:
        profile.tier = 'standard'
    else:
        profile.tier = 'standard'
```

Run migration: `python manage.py makemigrations marketplace`

---

### FIX X-05 — Promoted Products Grid

**`frontend/src/components/PromotedProductsRow.tsx`** — replace entire component:
```tsx
import React, { useEffect, useState } from 'react';
import api from '../api';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';
import { Sparkles, ChevronRight } from 'lucide-react';

const PromotedProductsRow: React.FC = () => {
    const [promotions, setPromotions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const VISIBLE = 8;

    useEffect(() => {
        api.get('/api/sponsored/?public=true')
            .then(res => {
                const data = res.data.results || res.data;
                setPromotions(Array.isArray(data) ? data.slice(0, VISIBLE) : []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (!loading && promotions.length === 0) return null;

    return (
        <section className="mb-10 mt-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            Featured Selections
                        </h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest -mt-0.5">
                            Sponsored · Top picks from our community
                        </p>
                    </div>
                </div>
                <button className="flex items-center gap-1 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest hover:gap-2 transition-all">
                    View All <ChevronRight size={14} />
                </button>
            </div>

            {/* Grid — 2 cols mobile, 3 tablet, 4 desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {loading
                    ? [...Array(4)].map((_, i) => (
                        <div key={i} className="relative">
                            <ProductCardSkeleton viewMode="grid" />
                        </div>
                    ))
                    : promotions.map((promo) => (
                        <div key={promo.id} className="relative group">
                            <ProductCard product={promo.product_details} viewMode="grid" />
                            {/* Sponsored badge */}
                            <div className="absolute top-2 left-2 z-10 pointer-events-none">
                                <span className="bg-brand-600/90 backdrop-blur-sm text-[9px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                                    Sponsored
                                </span>
                            </div>
                        </div>
                    ))
                }
            </div>
        </section>
    );
};

export default PromotedProductsRow;
```

---

### FIX X-06 — Recharts Width/Height Warning

**`frontend/src/pages/dashboard/DashboardLayout.tsx`** — for every `ResponsiveContainer`:
```tsx
// BEFORE (causes warning):
<div className="flex-1 min-h-0">
    <ResponsiveContainer width="100%" height="100%">

// AFTER (FIX X-06: fixed pixel height, no zero-height parent):
<div className="h-[280px] w-full">
    <ResponsiveContainer width="100%" height={280}>
```

Apply this pattern to ALL charts in the file. Also apply to any staff panel charts.

---

### FIX X-07 — Settings Page

**`frontend/src/pages/dashboard/SettingsPage.tsx`** — create file:
```tsx
import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { User, Lock, Bell, Trash2 } from 'lucide-react';

const SettingsPage: React.FC = () => {
    const [profile, setProfile] = useState<any>({});
    const [form, setForm] = useState({ bio: '', phone_number: '', location: '', website: '', instagram_username: '' });
    const [passwords, setPasswords] = useState({ old: '', new1: '', new2: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const username = localStorage.getItem('username');
        if (username) {
            api.get(`/api/profiles/${username}/`).then(r => {
                setProfile(r.data);
                setForm({
                    bio: r.data.bio || '',
                    phone_number: r.data.phone_number || '',
                    location: r.data.location || '',
                    website: r.data.website || '',
                    instagram_username: r.data.instagram_username || '',
                });
            });
        }
    }, []);

    const handleProfileSave = async () => {
        setSaving(true);
        try {
            const username = localStorage.getItem('username');
            await api.patch(`/api/profiles/${username}/`, form);
            toast.success('Profile updated');
        } catch { toast.error('Failed to save'); }
        finally { setSaving(false); }
    };

    const handlePasswordChange = async () => {
        if (passwords.new1 !== passwords.new2) { toast.error('Passwords do not match'); return; }
        if (passwords.new1.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        try {
            await api.post('/api/auth/change-password/', { old_password: passwords.old, new_password: passwords.new1 });
            toast.success('Password changed');
            setPasswords({ old: '', new1: '', new2: '' });
        } catch { toast.error('Incorrect current password'); }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account Settings</h2>

            {/* Profile Info */}
            <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <User size={18} className="text-brand-600" />
                    <h3 className="font-bold text-gray-900 dark:text-white">Profile Information</h3>
                </div>
                {[
                    { key: 'bio', label: 'Bio', type: 'textarea' },
                    { key: 'phone_number', label: 'Phone Number', type: 'text' },
                    { key: 'location', label: 'Location', type: 'text' },
                    { key: 'website', label: 'Website URL', type: 'url' },
                    { key: 'instagram_username', label: 'Instagram Handle', type: 'text' },
                ].map(field => (
                    <div key={field.key}>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{field.label}</label>
                        {field.type === 'textarea' ? (
                            <textarea value={(form as any)[field.key]} onChange={e => setForm({...form, [field.key]: e.target.value})}
                                className="input resize-none" rows={3} />
                        ) : (
                            <input type={field.type} value={(form as any)[field.key]} onChange={e => setForm({...form, [field.key]: e.target.value})}
                                className="input" />
                        )}
                    </div>
                ))}
                <button onClick={handleProfileSave} disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </div>

            {/* Tier Status */}
            <div className="card p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Bell size={18} className="text-brand-600" /> Subscription Tier
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Current Plan</p>
                        <p className="font-black text-xl capitalize text-brand-600">{profile.tier || 'Free'}</p>
                        {profile.tier === 'free' && <p className="text-xs text-gray-400 mt-1">Upgrade to list more products and get promoted placement</p>}
                        {profile.tier === 'standard' && <p className="text-xs text-gray-400 mt-1">You have access to standard seller features</p>}
                        {profile.tier === 'premium' && <p className="text-xs text-green-600 mt-1">✓ Full access to all premium features</p>}
                    </div>
                    {profile.tier !== 'premium' && (
                        <button className="btn-primary text-sm">Upgrade Plan</button>
                    )}
                </div>
            </div>

            {/* Change Password */}
            <div className="card p-6 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <Lock size={18} className="text-brand-600" />
                    <h3 className="font-bold text-gray-900 dark:text-white">Change Password</h3>
                </div>
                <input type="password" placeholder="Current Password" value={passwords.old}
                    onChange={e => setPasswords({...passwords, old: e.target.value})} className="input" />
                <input type="password" placeholder="New Password (min 8 chars)" value={passwords.new1}
                    onChange={e => setPasswords({...passwords, new1: e.target.value})} className="input" />
                <input type="password" placeholder="Confirm New Password" value={passwords.new2}
                    onChange={e => setPasswords({...passwords, new2: e.target.value})} className="input" />
                <button onClick={handlePasswordChange} className="btn-primary">Update Password</button>
            </div>
        </div>
    );
};

export default SettingsPage;
```

**Backend** — add change-password endpoint to `marketplace/api_views.py`:
```python
class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        old = request.data.get('old_password')
        new = request.data.get('new_password')
        if not request.user.check_password(old):
            return Response({'error': 'Incorrect current password'}, status=400)
        if len(new) < 8:
            return Response({'error': 'Password must be at least 8 characters'}, status=400)
        request.user.set_password(new)
        request.user.save()
        return Response({'status': 'password changed'})
```

Register in `marketplace/urls.py`:
```python
path('auth/change-password/', ChangePasswordView.as_view()),
```

Add route in `App.tsx` and `DashboardLayout.tsx`:
```tsx
<Route path="settings" element={<SettingsPage />} />
```

---

### FIX X-08 — Help & Support Center

**Backend models** — add to `backend/marketplace/models.py` (full code in findings above)

**Backend API** — add to `backend/marketplace/api_views.py`:
```python
class FAQViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FAQSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        qs = FAQ.objects.filter(is_published=True)
        cat = self.request.query_params.get('category')
        if cat: qs = qs.filter(category=cat)
        q = self.request.query_params.get('q')
        if q: qs = qs.filter(Q(question__icontains=q) | Q(answer__icontains=q))
        return qs

class SupportTicketViewSet(viewsets.ModelViewSet):
    serializer_class = SupportTicketSerializer
    def get_permissions(self):
        if self.action == 'create': return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsStaffMember()]
    def get_queryset(self):
        if self.request.user.is_staff: return SupportTicket.objects.all().order_by('-created_at')
        return SupportTicket.objects.filter(user=self.request.user)
    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)
```

Register:
```python
router.register(r'faq', FAQViewSet, basename='faq')
router.register(r'support-tickets', SupportTicketViewSet, basename='support-ticket')
```

Staff URL:
```python
router.register(r'support-tickets', SupportTicketViewSet, basename='staff-support-ticket')
router.register(r'faq', StaffFAQViewSet, basename='staff-faq')
```

**Frontend** — create `frontend/src/pages/dashboard/HelpCenterPage.tsx` with:
- Company contact section (address, phone, email — hardcoded or from a site settings API)
- FAQ accordion by category with search
- Ticket submission form
- Confirmation on submit

**Staff Panel** — add ticket management table to staff panel with status updates.

Run migration: `python manage.py makemigrations marketplace`

---

### FIX X-09 — Follow System

**`backend/marketplace/api_views.py`** → add to `UserProfileViewSet`:
```python
@decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
def follow(self, request, **kwargs):
    profile = self.get_object()
    if profile.user == request.user:
        return Response({'error': 'Cannot follow yourself'}, status=400)
    _, created = Follow.objects.get_or_create(follower=request.user, following=profile)
    return Response({'following': True, 'followers_count': profile.get_followers_count(), 'created': created})

@decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
def unfollow(self, request, **kwargs):
    profile = self.get_object()
    Follow.objects.filter(follower=request.user, following=profile).delete()
    return Response({'following': False, 'followers_count': profile.get_followers_count()})

@decorators.action(detail=True, methods=['get'])
def follow_status(self, request, **kwargs):
    profile = self.get_object()
    if not request.user.is_authenticated:
        return Response({'following': False})
    return Response({
        'following': Follow.objects.filter(follower=request.user, following=profile).exists(),
        'followers_count': profile.get_followers_count(),
        'following_count': profile.get_following_count(),
    })
```

Also add `get_queryset` filter: `GET /api/products/?following=true` returns products from followed sellers:
```python
if self.request.query_params.get('following') and self.request.user.is_authenticated:
    followed = Follow.objects.filter(follower=self.request.user).values_list('following__user_id', flat=True)
    queryset = queryset.filter(seller_id__in=followed)
```

**`frontend/src/pages/ProfilePage.tsx`** — add follow button and counts:
```tsx
const [followStatus, setFollowStatus] = useState({ following: false, followers_count: 0, following_count: 0 });

useEffect(() => {
    if (username) {
        api.get(`/api/profiles/${username}/follow_status/`)
            .then(r => setFollowStatus(r.data)).catch(() => {});
    }
}, [username]);

const handleFollow = async () => {
    const action = followStatus.following ? 'unfollow' : 'follow';
    const res = await api.post(`/api/profiles/${username}/${action}/`);
    setFollowStatus(prev => ({ ...prev, following: res.data.following, followers_count: res.data.followers_count }));
};

// In JSX:
<div className="flex items-center gap-4 mt-4">
    <div className="text-center">
        <p className="font-black text-lg">{followStatus.followers_count}</p>
        <p className="text-xs text-gray-500">Followers</p>
    </div>
    <div className="text-center">
        <p className="font-black text-lg">{followStatus.following_count}</p>
        <p className="text-xs text-gray-500">Following</p>
    </div>
    {isOwnProfile ? null : (
        <button onClick={handleFollow} className={followStatus.following ? 'btn-ghost' : 'btn-primary'}>
            {followStatus.following ? 'Following' : 'Follow'}
        </button>
    )}
</div>
```

---

### FIX X-10 — Order Redirect Auto-Scroll & Expand

**`frontend/src/pages/OrdersPage.tsx`**:
```tsx
import { useSearchParams } from 'react-router-dom';

const [searchParams] = useSearchParams();
const highlightId = searchParams.get('highlight');

// After orders load:
useEffect(() => {
    if (highlightId && orders.length > 0) {
        const id = parseInt(highlightId);
        setExpandedOrderId(id);
        setTimeout(() => {
            document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
    }
}, [highlightId, orders.length]);

// Add id prop to each order card:
<div id={`order-${order.id}`} key={order.id} className="...">
```

Also call `fetchSellerLipa(order)` when the highlighted order is auto-expanded.

---

### REMAINING PREVIOUS BUGS (still unfixed — apply all)

**C-14**: `marketplace/forms.py` line 95 — change `Subscription.objects.filter` to `NewsletterSubscription.objects.filter`
**C-15**: `rm backend/marketplace/models_subscription.py`
**C-17**: `CategorySerializer.get_children()` — add `depth = self.context.get('_cat_depth', 0); if depth >= 2: return []`
**S-07**: `UserProfileSerializer.Meta.read_only_fields` — add `'is_verified', 'tier'`
**S-15**: `permissions.py IsStaffMember` — change `except:` to `except AttributeError:`
**S-17**: `ProductViewSet.get_queryset()` — sellers see own products with `?mine=true`
**S-18**: `frontend/src/api.ts` line 3 — `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'`
**L-14**: `OrdersPage.tsx` subtotal row — `parseInt(order.total_amount) - parseInt(order.shipping_fee || 0)`
**L-15**: `services.py VALID_TRANSITIONS` — remove `'AWAITING_PAYMENT'` from its own list
**L-18**: `staff/serializers.py TaskSerializer` — remove `'assigned_to'` from `read_only_fields`
**L-19**: `api_views.py seller_stats` — filter orders by `status__in=['PAID','PROCESSING','SHIPPED','DELIVERED','COMPLETED']`
**L-20**: `useOrderTracking.ts` — add `retryCount ref`, exponential backoff, `MAX_RETRIES = 8`

---

### ALL DEVOPS FIXES (apply in full — see previous prompt for complete code)

DEVOPS-01: `backend/Dockerfile CMD` → daphne not gunicorn
DEVOPS-02: `settings.py DATABASES` → `dj_database_url.config()` from `DATABASE_URL` env
DEVOPS-03: `settings.py CHANNEL_LAYERS` → `REDIS_URL` from env
DEVOPS-04+11: Add nginx service + `frontend/nginx.conf` with SPA routing
DEVOPS-05+18: Add celery-worker and celery-beat to `docker-compose.yml`
DEVOPS-06: `env_file: ./backend/.env`
DEVOPS-07: Redis healthcheck in compose
DEVOPS-08: Remove `./backend:/app` volume from backend service
DEVOPS-09+10: Move collectstatic+migrate to startup CMD
DEVOPS-12: `api.ts` use `VITE_API_BASE_URL` env var (covered by S-18)
DEVOPS-14: Add DB_NAME/DB_USER/DB_PASSWORD/REDIS_URL to `.env.example`
DEVOPS-15: Add SECURE_HSTS/SSL headers to `settings.py` when `not DEBUG`
DEVOPS-16: Remove default postgres password from compose
DEVOPS-17: Create `backend/.dockerignore` and `frontend/.dockerignore`
DEVOPS-19: `frontend/Dockerfile` use `npm ci` not `npm install`

---

### FINAL VERIFICATION

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
python manage.py check          # ZERO errors
python manage.py seed_inspections
cd ../frontend
npm ci && npm run build         # ZERO TS errors
cd ..
docker compose build            # all services build cleanly
docker compose up -d
# Verify:
# - GET /api/lipa-numbers/?seller=testuser → 200
# - GET /api/faq/ → 200
# - POST /api/support-tickets/ → 201
# - GET /api/inspections/categories/suggest/?product_id=1 → 200
# - POST /api/profiles/testuser/follow/ → 200
# - GET /orders?highlight=42 → auto-scrolls and expands order 42
```
