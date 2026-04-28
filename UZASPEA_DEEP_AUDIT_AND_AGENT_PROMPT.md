# UZASPEA — Deep System Audit: Full Findings & Agent Prompt
**Audited by:** Full static analysis of every Python and TypeScript source file  
**Scope:** backend/marketplace, backend/inspections, backend/staff, backend/uzachuo, frontend/src  
**Total bugs found:** 47 (12 Critical · 14 Security · 13 Logic · 8 Missing Implementations)

---

## PART 1 — FULL FINDINGS

---

### CRITICAL BUGS (system-breaking, workflows don't complete)

---

**C-01 · Stock never decremented on order creation**  
File: `marketplace/serializers.py` → `OrderSerializer.create()`  
The loop creates `OrderItem` records and sums the total but never calls `Product.objects.update(stock=F('stock') - qty)`. Any buyer can order more than stock allows. There is zero protection against overselling. No `transaction.atomic()` wrapper either, so a crash mid-loop leaves partial orders with no items.

---

**C-02 · Order created via serializer auto-advances to AWAITING_PAYMENT, bypassing CART/CHECKOUT lifecycle**  
File: `marketplace/serializers.py` → `OrderSerializer.create()`  
The last line calls `OrderStateMachine.transition_order(order, 'AWAITING_PAYMENT', ...)`. The model default for `status` is `'CART'`. So an order is born as CART, then immediately jumped to AWAITING_PAYMENT in the same request. The CART and CHECKOUT states exist for progressive commitment (add to cart → review → submit payment). This jump means no user ever sees their order in CART state from the API — it arrives already demanding payment. This also fires a WebSocket broadcast on every order creation unnecessarily.

---

**C-03 · Payment approval on InspectionPayment uses wrong status guard — blocks all legitimate approvals**  
File: `inspections/api_views.py` → `InspectionPaymentViewSet.approve()`  
Line 408: `if payment.request.status != 'bill_sent'`. But the flow is: bill_sent → client acknowledges → `awaiting_payment`. The client calls `acknowledge-bill` which changes status to `awaiting_payment`. Then the client submits payment proof. Then staff approves. By the time staff tries to approve, the status is `awaiting_payment` or `deposit_paid`, NOT `bill_sent`. This guard rejects every real approval from non-superusers. The entire inspection payment flow is broken for regular staff.

---

**C-04 · No payment verification endpoint for marketplace orders — orders can never reach PAID**  
File: `marketplace/api_views.py` → `PaymentViewSet`  
`PaymentViewSet` is a plain `ModelViewSet` with no `verify`, `approve`, or `reject` custom actions. Staff can view payments but there is no endpoint to set `Payment.status = 'VERIFIED'` and transition the order to `PAID`. Without PAID, the order can never reach PROCESSING, SHIPPED, DELIVERED, or COMPLETED. Every marketplace order is permanently stuck in `PENDING_VERIFICATION`.

---

**C-05 · `Order.update_total()` recalculates using live product price, not locked order price**  
File: `marketplace/models.py` line 227  
```python
total = sum(item.quantity * item.product.price for item in self.orderitem_set.all())
```
`item.price` is the price at time of order (correct, stored in `OrderItem`). `item.product.price` is the current live price. If a seller changes the price after order placement, calling `update_total()` recalculates using the new price and corrupts the order total. The fix is `item.quantity * item.price`.  
Additionally, `update_total()` ignores `shipping_fee` entirely — it will always produce a total without shipping.

---

**C-06 · `Subscription.__str__()` crashes with AttributeError when tier is None**  
File: `marketplace/models.py` → `Subscription.__str__()`  
`tier` is `null=True, blank=True` but `__str__` does `self.tier.name` unconditionally. Any admin panel interaction with a tier-less subscription raises `AttributeError: 'NoneType' object has no attribute 'name'`. This surfaces as a 500 in Django admin.

---

**C-07 · `AuditLog.__str__()` crashes when user is None**  
File: `staff/models.py` line 218  
`self.user.username` — but `user` is `null=True`. System-generated audit logs (or logs where the user was deleted) will crash Django admin with `AttributeError`.

---

**C-08 · `Category.get_descendants()` is recursive with N+1 per level and returns a Python set, not a QuerySet**  
File: `marketplace/models.py` → `Category.get_descendants()`  
The method fires one DB query per category node as it recursively calls `cat.children.all()`. For a tree 3 levels deep with 10 categories per level, this is 100+ queries. It then returns `Category.objects.filter(id__in=[c.id for c in descendants])` — fine, but the set building wastes all those round trips. This is called on every product list request that filters by category.

---

**C-09 · Slug collision on Product and Category save causes IntegrityError**  
File: `marketplace/models.py` → `Product.save()` and `Category.save()`  
`if not self.slug: self.slug = slugify(self.name)` — if a second product is created with the same or similar name (e.g. "Blue Shirt" and "Blue-Shirt"), both slugify to `"blue-shirt"`. The second save raises `django.db.utils.IntegrityError: UNIQUE constraint failed`. No collision-handling loop exists. `InspectionCategory` has the correct loop; these two do not.

---

**C-10 · `InspectionCheckIn` queryset uses wrong related name `request__assignment` (singular)**  
File: `inspections/api_views.py` → `InspectionCheckInViewSet.get_queryset()`  
Line: `Q(request__assignment__inspector__user=user)`. The model uses `related_name='assignments'` (plural) on `InspectionAssignment`. The ORM lookup `request__assignment` doesn't exist — it would be `request__assignments`. This causes a `FieldError` on every checkin queryset call for non-staff inspectors, returning nothing instead of their checkins.

---

**C-11 · `ReInspection.perform_create()` creates new InspectionRequest with `status='pre_inspection'` and no bill, no payment, no checklist — skips entire booking workflow**  
File: `inspections/api_views.py` → `ReInspectionViewSet.perform_create()`  
A re-inspection creates a full `InspectionRequest` directly at `pre_inspection` status with no bill generated, no deposit required. The client gets a re-inspection but the financial and legal workflow (bill → acknowledge → pay deposit → assign) is entirely skipped. Even if re-inspection coverage was purchased, the rate is 10% of total — but no bill is created to reflect this.

---

**C-12 · Cart stored in `sessionStorage` — lost on every tab/browser close**  
File: `frontend/src/context/CartContext.tsx`  
`sessionStorage.getItem('uzaspea_cart')` / `sessionStorage.setItem(...)`. sessionStorage is cleared when the browser tab is closed. Users lose their entire cart if they close and reopen the tab, switch to another tab, or refresh after closing. Should be `localStorage`.

---

---

### SECURITY FLAWS

---

**S-01 · Secret key hardcoded in committed settings file**  
File: `uzachuo/settings.py` line 4  
`SECRET_KEY = 'put-a-real-secret-key-here-for-development'` is committed to the public GitHub repo. Every clone of this repo has the same SECRET_KEY. An attacker can forge session cookies, CSRF tokens, and signed URLs.

---

**S-02 · `DEBUG = True` and `ALLOWED_HOSTS = ['*']` hardcoded**  
File: `uzachuo/settings.py`  
Debug mode in production exposes full stack traces, local variables, and source code paths to any HTTP client. `ALLOWED_HOSTS = ['*']` accepts requests from any hostname including forged Host headers.

---

**S-03 · `AUTH_PASSWORD_VALIDATORS = []` — no password strength enforcement**  
File: `uzachuo/settings.py` line 117  
Django's `validate_password()` in `RegisterView` calls the validators list — which is empty. Passwords of length 1 are accepted. No minimum length, no common password check, no similarity check.

---

**S-04 · `CORS_ALLOW_ALL_ORIGINS = True` with `CORS_ALLOW_CREDENTIALS = True`**  
File: `uzachuo/settings.py`  
Any website on the internet can make credentialed cross-origin requests (with JWT tokens and cookies) to this API. Combined with `CORS_ALLOW_CREDENTIALS = True`, this is the most permissive CORS configuration possible. A malicious site can perform actions on behalf of a logged-in user.

---

**S-05 · `SESSION_COOKIE_SECURE = False` hardcoded**  
File: `uzachuo/settings.py`  
Session cookies are sent over plain HTTP. In production (if ever deployed without fixing this), session tokens are transmitted in cleartext.

---

**S-06 · `OrderViewSet.advance()` allows sellers to set ANY status including staff-only states**  
File: `marketplace/api_views.py` → `OrderViewSet.advance()`  
A seller who has a product in an order passes the `is_seller` check and can POST any `status` value — including `PAID`, `COMPLETED`, or `REFUNDED`. The state machine only validates the transition is valid from the current state; it does not check who is authorized to make that transition. A seller can mark their own order as PAID (bypassing payment verification), then COMPLETED (triggering reviews), without any money changing hands.

---

**S-07 · `UserProfileViewSet` has no object-level permission — any authenticated user can edit any profile**  
File: `marketplace/api_views.py` → `UserProfileViewSet`  
`permission_classes = [permissions.IsAuthenticatedOrReadOnly]`. There is no `IsOwnerOrStaff` guard on `update`, `partial_update`, or `destroy`. Any logged-in user can PATCH any other user's profile (bio, picture, phone number, tier, `is_verified`).  
Critical sub-bug: `is_verified` and `tier` are writable fields in `UserProfileSerializer` — an attacker can set their own `is_verified=True` and `tier='premium'` via a PATCH request.

---

**S-08 · `SponsoredListingViewSet` — anonymous users can retrieve any listing by ID regardless of status**  
File: `marketplace/api_views.py` → `SponsoredListingViewSet`  
`get_queryset()` scopes anonymous users to `status='approved'`, but `get_object()` (used by `retrieve`) bypasses the queryset scope on DRF's default `ModelViewSet`. An anonymous user calling `GET /api/sponsored/42/` retrieves listing 42 regardless of status — exposing rejected and pending listings, including `admin_notes` (rejection reasons, internal commentary).

---

**S-09 · `StaffPermission.expires_at` field exists but is never checked**  
File: `uzachuo/permissions.py` → `has_staff_permission()`  
The query is `StaffPermission.objects.filter(user=user, permission=permission_codename, is_active=True)`. The `expires_at` field is never included in the filter. A permission granted temporarily with an expiry date remains valid forever — the system has time-limited permissions by design but they are never enforced.

---

**S-10 · `CustomTokenObtainPairSerializer` uses bare `except:` swallowing all exceptions silently**  
File: `marketplace/api_views.py` line 363  
```python
try:
    data['is_verified'] = self.user.profile.is_verified
    data['tier'] = self.user.profile.tier
except:
    data['is_verified'] = False
    data['tier'] = 'free'
```
A bare `except:` catches `SystemExit`, `KeyboardInterrupt`, and any exception including database errors. If the profile table is down or corrupted, this silently returns wrong data instead of raising. Security context: it also masks failed profile lookups that could indicate data integrity issues.

---

**S-11 · Inspection `PaymentConfirmation` model exists but approving it has no side effect — subscriptions never actually activate**  
File: `marketplace/models.py` — `PaymentConfirmation` has `status` field with approved/rejected, but no signal, no view, and no code anywhere activates `Subscription.is_active = True` when a `PaymentConfirmation` is approved. The entire subscription system is dead-on-arrival — users can submit payment proofs, staff can approve them, but the user's subscription never activates.

---

**S-12 · `Follow` model creates accessor clashes with `UserProfile.following` M2M**  
File: `marketplace/models.py`  
`UserProfile.following = ManyToManyField(User, related_name='followers')` creates `User.followers` (reverse accessor).  
`Follow.following = ForeignKey(UserProfile, related_name='followers')` also creates `UserProfile.followers`.  
`Follow.follower = ForeignKey(User, related_name='following')` also creates `User.following`.  
Django system check will raise `ERRORS: marketplace.UserProfile.following: (fields.E304) Reverse accessor for 'UserProfile.following' clashes with reverse accessor for 'Follow.follower'`. The app **may not start** depending on Django version strictness.

---

**S-13 · `NewsletterSubscription.email` has `unique=True` AND `unique_together = ('email', 'category')` — contradictory constraints**  
File: `marketplace/models.py`  
`unique=True` on `email` means one email across all rows. `unique_together` on `(email, category)` implies one subscription per category per email. The `unique=True` constraint makes `unique_together` meaningless — a user can only ever have one subscription regardless of category. Intent vs. implementation mismatch. If the intent is per-category subscriptions, remove `unique=True`.

---

**S-14 · `EMAIL_BACKEND` is set to real SMTP (MailHog) in committed settings — production deploy would fail silently or send no emails**  
File: `uzachuo/settings.py`  
`EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'` pointing at localhost:1025 (MailHog). In production, MailHog won't be running. `send_order_confirmation_email()` will crash with `ConnectionRefusedError` on every order. Because `fail_silently=False`, this will 500 the order creation endpoint.

---

---

### LOGIC & WORKFLOW BUGS

---

**L-01 · `OrderSerializer.create()` not wrapped in `transaction.atomic()` — partial orders possible**  
A crash after creating the `Order` but before all `OrderItem` rows are created (e.g. DB constraint, stock check failure) leaves an empty order in the database. No rollback occurs.

---

**L-02 · `OrderSerializer` fields list is missing `shipping_method`, `shipping_fee`, and `delivery_info`**  
File: `marketplace/serializers.py` → `OrderSerializer.Meta.fields`  
The frontend POSTs `shipping_method`, `shipping_fee`, and `delivery_info`. Only `shipping_fee` is on the model (and writable if added to fields). `shipping_method` IS on the model but NOT in `Meta.fields` — it is silently ignored. `delivery_info` has no model field at all — there is nowhere to persist the buyer's name, phone, and address. The seller never knows where to deliver.

---

**L-03 · `OrderSerializer.get_seller_subtotal()` crashes with `AttributeError` when request context is missing**  
File: `marketplace/serializers.py` line 124  
`user = self.context.get('request').user` — if `context['request']` is `None` (management commands, tests, bulk serialization), this raises `AttributeError: 'NoneType' object has no attribute 'user'`.

---

**L-04 · `OrderViewSet.incoming()` has N+1 on product images**  
File: `marketplace/api_views.py` → `format_order()`  
```python
item.product.images.first().image.url if item.product.images.exists() else None
```
Two DB queries per item (`.exists()` then `.first()`). The `seller_items_prefetch` fetches `product__images` but `format_order` doesn't use the prefetched cache — it calls `.exists()` and `.first()` as fresh queries. For an order with 10 items this is 20 extra queries.

---

**L-05 · `ReviewViewSet.get_queryset()` returns ALL reviews including unapproved to all users**  
File: `marketplace/api_views.py` → `ReviewViewSet`  
`Review.approved` defaults to `False`. The queryset does not filter by `approved=True` for non-staff. Every product shows unapproved reviews (which may be spam, fake, or unvetted). There is also no staff endpoint to approve reviews — they are created approved=False and stay that way forever. The review system is functionally dead.

---

**L-06 · `ReviewViewSet` has no owner check — anyone can DELETE any review**  
`ReviewViewSet` inherits `ModelViewSet` with no object-level permission. Any authenticated user can call `DELETE /api/reviews/42/` and delete another user's review.

---

**L-07 · `CommentViewSet` has no owner check — anyone can edit or delete any comment**  
Same as L-06 for `ProductComment`. No `IsOwnerOrStaff` permission on `update`, `partial_update`, `destroy`.

---

**L-08 · `OrderViewSet.cancel()` allows a seller to cancel an order that is already SHIPPED or DELIVERED**  
File: `marketplace/api_views.py` → `OrderViewSet.cancel()`  
The state machine has this guard: `if new_state == 'CANCELLED' and order.status not in ['COMPLETED', 'DELIVERED']: pass`. But SHIPPED is not in that exclusion list — a seller can cancel a SHIPPED order (already on its way). This should exclude `['COMPLETED', 'DELIVERED', 'SHIPPED']` at minimum.

---

**L-09 · `InspectionPaymentViewSet.approve()` sets status `pre_inspection` when it should set `deposit_paid`**  
File: `inspections/api_views.py`  
On deposit approval: `req.status = 'pre_inspection'`. But there is a defined status `'deposit_paid'` in `STATUS_CHOICES`. The flow should be `deposit_paid → pre_inspection` (after pre-inspection check passes), not skipping directly. The `deposit_paid` status is unreachable in normal workflow.

---

**L-10 · `InspectionReport.perform_create()` checks `req.status != 'in_progress'` but `create()` is called when a report shell is created during check-in**  
File: `inspections/api_views.py` → `InspectionCheckInViewSet.create()`  
During check-in, a report shell is auto-created: `InspectionReport.objects.create(request=request_obj, submitted_by=request.user, ...)`. But `InspectionReport`'s `perform_create` also validates `req.status != 'in_progress'`. The shell creation bypasses `perform_create` (it uses `objects.create` directly), so the check is inconsistently applied. The `finalize` action then re-saves — potentially double-saving a report.

---

**L-11 · `InspectorProfile.total_flags` field is never updated**  
File: `inspections/api_views.py` → `InspectionReportViewSet.approve()`  
On approval, `profile.total_inspections += 1; profile.save()`. But `profile.total_flags` is never incremented when fraud flags are created for that inspector. The performance score calculation is therefore always based on stale flag count.

---

**L-12 · `SponsoredListing.expires_at` is never set on approval, listings never expire**  
File: `staff/api_views.py` → `SponsoredListingReviewViewSet.approve()`  
`listing.approved_at = timezone.now()` is set, but `listing.expires_at` remains `None`. The `check_expirations` management command does not include sponsored listings. Approved sponsored listings are promoted forever with no expiry enforcement. The `expired` status in `STATUS_CHOICES` is unreachable.

---

**L-13 · `check_expirations` management command expires orders but is never scheduled**  
File: `marketplace/management/commands/check_expirations.py`  
The command is well-written but there is no `cron`, Celery beat, or any scheduling mechanism configured anywhere in the project. Orders in `AWAITING_PAYMENT` will never auto-expire unless the command is run manually. Similarly for subscriptions.

---

---

### MISSING IMPLEMENTATIONS (referenced but absent or broken)

---

**M-01 · No marketplace payment verify/approve/reject endpoint for staff**  
Staff see pending payments but cannot act on them through any API endpoint. No `verify` action on `PaymentViewSet`. Orders are permanently stuck at `PENDING_VERIFICATION`.

---

**M-02 · No stock restoration on order cancellation**  
When an order is cancelled (after stock was decremented at order creation), stock is not returned to products. Items become permanently "sold" in terms of inventory even if the order is cancelled.

---

**M-03 · No `is_available=False` auto-set when stock reaches 0**  
A product with `stock=0` and `is_available=True` is still returned in the product list (the default queryset filters `is_available=True`). This is contradictory — a product with zero stock is listed as available.

---

**M-04 · `PaymentConfirmation` approval never activates the user's `Subscription`**  
The entire subscription upgrade flow (user pays → staff approves `PaymentConfirmation` → subscription activates) is implemented for steps 1 and 2, but step 3 is missing. No signal, no view, no code activates `Subscription.is_active = True` or sets `start_date`/`end_date`.

---

**M-05 · Review approval workflow is broken end-to-end**  
Reviews are created with `approved=False`. There is no staff endpoint to approve them. Unapproved reviews are returned to all users in the queryset (L-05). The approved/unapproved distinction is non-functional.

---

**M-06 · `StaffPermission.expires_at` is modeled but never enforced**  
Time-limited permissions are stored but `has_staff_permission()` ignores the expiry. See S-09.

---

**M-07 · WebSocket consumer has no authentication guard for buyer-side connections**  
File: `marketplace/consumers.py`  
In seller mode, the consumer tries to authenticate via token from query string. In buyer mode (non-"seller" order_id), there is no authentication check at all — `self.room_group_name = f'order_tracking_{self.order_id}'` is set and `accept()` is called without verifying the user is the order's buyer. Any user who knows an order ID can subscribe to its tracking updates.

---

**M-08 · `ReInspection` creates new request without generating a bill or linking it to reinspection coverage**  
Already covered as C-11. The re-inspection flow is architecturally incomplete — the financial and assignment workflow is entirely skipped.

---

---

## PART 2 — AGENT FIX PROMPT

---

```
You are a senior Django/React engineer performing a complete bug-fix pass on the UZASPEA marketplace project (https://github.com/beatussimon/uzaspea). You have been given a full audit of 47 bugs. Your job is to fix ALL of them precisely, in order of severity. You must modify only the files listed. Do not add new features beyond what is needed to fix each bug. After each fix, add a comment `# FIX: [BUG_ID]` on the changed line(s).

Work through the bugs in this exact order: Critical (C-01 to C-12) → Security (S-01 to S-14) → Logic (L-01 to L-13) → Missing (M-01 to M-08).

For each bug, produce the complete corrected file section (not a diff — write the actual corrected code block with enough surrounding context to locate it unambiguously). Then state: "Fixed: [BUG_ID] — [one sentence]."

---

## CRITICAL FIXES

### C-01 — Stock decrement on order creation
File: `backend/marketplace/serializers.py`

In `OrderSerializer.create()`:

1. Import at top of file:
```python
from django.db import transaction
from django.db.models import F
```

2. Wrap the entire `create()` body in `with transaction.atomic():`.

3. Before creating each `OrderItem`, add stock validation:
```python
product.refresh_from_db(fields=['stock'])
if product.stock < qty:
    raise serializers.ValidationError(
        f'"{product.name}" only has {product.stock} unit(s) in stock.'
    )
```

4. After creating each `OrderItem`, decrement stock atomically:
```python
Product.objects.filter(pk=product.pk).update(stock=F('stock') - qty)
# Auto-mark unavailable if now at zero
Product.objects.filter(pk=product.pk, stock=0).update(is_available=False)
```

---

### C-02 — Remove auto-advance to AWAITING_PAYMENT from OrderSerializer.create()
File: `backend/marketplace/serializers.py`

Delete these two lines from `OrderSerializer.create()`:
```python
from .services import OrderStateMachine
OrderStateMachine.transition_order(order, 'AWAITING_PAYMENT', notes="Order placed by customer.")
```

The order is created with `status='CART'` (model default). The frontend must call `POST /api/orders/{id}/advance/` with `{"status": "AWAITING_PAYMENT"}` after the user completes the checkout form. This restores the intended state machine flow.

---

### C-03 — Fix InspectionPayment approval status guard
File: `backend/inspections/api_views.py` → `InspectionPaymentViewSet.approve()`

Replace:
```python
if payment.request.status != 'bill_sent' and not request.user.is_superuser:
    return Response({'detail': 'Request must be in bill_sent status to approve payment.'}, status=400)
```
With:
```python
APPROVABLE_STATUSES = ['bill_sent', 'awaiting_payment', 'deposit_paid']
if payment.request.status not in APPROVABLE_STATUSES and not request.user.is_superuser:
    return Response(
        {'detail': f'Cannot approve payment for request in {payment.request.status} status.'},
        status=400
    )
```

Also fix the deposit payment status transition. Replace:
```python
if payment.stage == 'deposit':
    req.status = 'pre_inspection'
elif payment.stage == 'balance':
    req.status = 'assigned'
```
With:
```python
if payment.stage == 'deposit':
    req.status = 'deposit_paid'  # FIX: C-03 + L-09 — deposit_paid is the correct next state
elif payment.stage == 'balance':
    req.status = 'pre_inspection'
```

---

### C-04 — Add payment verify/approve/reject actions to PaymentViewSet
File: `backend/marketplace/api_views.py`

Add these two actions inside `PaymentViewSet`:

```python
@decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
def verify(self, request, pk=None):
    """Staff: approve a pending marketplace payment and advance order to PAID."""
    from .services import OrderStateMachine
    payment = self.get_object()
    if payment.status != 'PENDING_VERIFICATION':
        return Response({'error': 'Payment is not pending verification.'}, status=400)
    payment.status = 'VERIFIED'
    payment.save(update_fields=['status'])
    if payment.order:
        try:
            OrderStateMachine.transition_order(
                payment.order, 'PAID',
                notes=f'Payment #{payment.id} verified by {request.user.username}.'
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
    return Response({
        'payment_status': payment.status,
        'order_status': payment.order.status if payment.order else None
    })

@decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
def reject(self, request, pk=None):
    """Staff: reject a pending payment and return order to AWAITING_PAYMENT."""
    from .services import OrderStateMachine
    payment = self.get_object()
    if payment.status != 'PENDING_VERIFICATION':
        return Response({'error': 'Payment is not pending verification.'}, status=400)
    payment.status = 'REJECTED'
    payment.save(update_fields=['status'])
    if payment.order and payment.order.status == 'PENDING_VERIFICATION':
        try:
            OrderStateMachine.transition_order(
                payment.order, 'AWAITING_PAYMENT',
                notes=f'Payment #{payment.id} rejected by {request.user.username}. Reason: {request.data.get("reason", "Not specified")}.'
            )
        except ValueError:
            pass
    return Response({'payment_status': payment.status})
```

Also add the payment viewset to staff URLs in `backend/staff/api_urls.py`:
```python
from marketplace.api_views import PaymentViewSet
router.register(r'payments', PaymentViewSet, basename='staff-payment')
```

---

### C-05 — Fix Order.update_total() to use locked item price and include shipping
File: `backend/marketplace/models.py`

Replace:
```python
def update_total(self):
    total = sum(item.quantity * item.product.price for item in self.orderitem_set.all())
    self.total_amount = total
    self.save()
```
With:
```python
def update_total(self):
    # FIX: C-05 — use item.price (locked at order time), not item.product.price (live)
    total = sum(item.quantity * item.price for item in self.orderitem_set.all())
    self.total_amount = total + self.shipping_fee
    self.save(update_fields=['total_amount'])
```

---

### C-06 — Fix Subscription.__str__() NoneType crash
File: `backend/marketplace/models.py`

Replace:
```python
def __str__(self):
    return f"{self.user.username} - {self.tier.name} ({'Active' if self.is_active else 'Inactive'})"
```
With:
```python
def __str__(self):
    tier_name = self.tier.name if self.tier_id else 'No Tier'  # FIX: C-06
    return f"{self.user.username} - {tier_name} ({'Active' if self.is_active else 'Inactive'})"
```

---

### C-07 — Fix AuditLog.__str__() NoneType crash
File: `backend/staff/models.py`

Replace:
```python
def __str__(self):
    return f"{self.user.username} - {self.action} - {self.timestamp}"
```
With:
```python
def __str__(self):
    actor = self.user.username if self.user_id else 'System'  # FIX: C-07
    return f"{actor} - {self.action} - {self.timestamp}"
```

---

### C-08 — Fix Category.get_descendants() N+1 recursive queries
File: `backend/marketplace/models.py`

Replace the entire `get_descendants` method:
```python
def get_descendants(self, include_self=False):
    """Efficient BFS using only O(depth) queries instead of O(nodes) queries."""  # FIX: C-08
    ids = [self.id] if include_self else []
    queue = list(
        Category.objects.filter(parent=self).values_list('id', flat=True)
    )
    while queue:
        ids.extend(queue)
        queue = list(
            Category.objects.filter(parent_id__in=queue).values_list('id', flat=True)
        )
    return Category.objects.filter(id__in=ids)
```

---

### C-09 — Fix slug collision on Product.save() and Category.save()
File: `backend/marketplace/models.py`

Replace `Product.save()`:
```python
def save(self, *args, **kwargs):
    if not self.slug:  # FIX: C-09 — collision-safe slug generation
        from django.utils.text import slugify
        base = slugify(self.name)
        slug, n = base, 1
        while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f'{base}-{n}'
            n += 1
        self.slug = slug
    super().save(*args, **kwargs)
```

Replace `Category.save()`:
```python
def save(self, *args, **kwargs):
    if not self.slug:  # FIX: C-09
        from django.utils.text import slugify
        base = slugify(self.name)
        slug, n = base, 1
        while Category.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f'{base}-{n}'
            n += 1
        self.slug = slug
    super().save(*args, **kwargs)
```

---

### C-10 — Fix InspectionCheckIn queryset wrong related name
File: `backend/inspections/api_views.py` → `InspectionCheckInViewSet.get_queryset()`

Replace:
```python
Q(request__assignment__inspector__user=user)
```
With:
```python
Q(request__assignments__inspector__user=user, request__assignments__is_active=True)  # FIX: C-10
```

---

### C-11 — Fix ReInspection to generate bill and follow proper workflow
File: `backend/inspections/api_views.py` → `ReInspectionViewSet.perform_create()`

Replace the `new_req = InspectionRequest.objects.create(...)` block and everything after it:
```python
new_req = InspectionRequest.objects.create(
    client=original.client,
    category=original.category,
    item_name=original.item_name,
    item_description=original.item_description,
    item_address=original.item_address,
    scope=original.scope,
    turnaround=original.turnaround,
    status='requested',  # FIX: C-11 — must start at requested, go through full billing workflow
)
reinsp.new_request = new_req
reinsp.status = 'assigned'
reinsp.save()

if original_inspector:
    new_req.pre_inspection_notes = (
        f'RE-INSPECTION: Exclude inspector {original_inspector.user.username}. '
        f'Original: {original.inspection_id}'
    )
    new_req.save()

# Auto-generate bill using reinspection coverage rate if coverage was purchased
from .pricing import calculate_bill
from decimal import Decimal
if original.reinspection_coverage and hasattr(original, 'bill'):
    orig_bill = original.bill
    reinsp_fee = (orig_bill.total_amount * Decimal('0.10')).quantize(Decimal('0.01'))
    from .models import InspectionBill
    InspectionBill.objects.create(
        request=new_req,
        base_rate=reinsp_fee,
        total_amount=reinsp_fee,
        deposit_amount=reinsp_fee,
        remaining_balance=Decimal('0.00'),
        currency=orig_bill.currency,
    )
    new_req.status = 'bill_sent'
    new_req.save()
    notify(new_req.client, 'bill_ready',
           f'Re-inspection bill for {new_req.item_name} is ready (covered by your policy).',
           new_req)
```

---

### C-12 — Fix cart persistence: sessionStorage → localStorage
File: `frontend/src/context/CartContext.tsx`

Replace both occurrences:
```typescript
// FIX: C-12 — sessionStorage is cleared on tab close; use localStorage for cart persistence
function loadCart(): CartItem[] {
  try {
    const data = localStorage.getItem('uzaspea_cart');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem('uzaspea_cart', JSON.stringify(items));
}
```

Also update `clearCart`:
```typescript
const clearCart = useCallback(() => {
  setItems([]);
  localStorage.removeItem('uzaspea_cart');  // FIX: C-12
}, []);
```

---

## SECURITY FIXES

### S-01, S-02, S-03, S-04, S-05 — Settings hardening
File: `backend/uzachuo/settings.py`

Replace the top of the file (before INSTALLED_APPS):
```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# FIX: S-01 — Never commit the real secret key
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'unsafe-dev-only-key-change-before-deploy')

# FIX: S-02 — Read from environment; default to True for dev safety
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'

# FIX: S-02 — Explicit allowed hosts
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
```

Replace `AUTH_PASSWORD_VALIDATORS`:
```python
# FIX: S-03 — Enforce password strength
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
```

Replace CORS settings:
```python
# FIX: S-04 — Never allow all origins with credentials in production
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000'
).split(',')
CORS_ALLOW_CREDENTIALS = True
```

Replace session cookie setting:
```python
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG  # FIX: S-05 — secure in production
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
```

Replace EMAIL_BACKEND:
```python
# FIX: S-14 — Use console backend as safe default; override via env in production
EMAIL_BACKEND = os.environ.get(
    'DJANGO_EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '1025'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'False') == 'True'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@uzaspea.com')
```

Create `backend/.env.example`:
```
DJANGO_SECRET_KEY=generate-with-python-secrets-token-hex-50
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_HOST_USER=postmaster@yourdomain.com
EMAIL_HOST_PASSWORD=your-smtp-password
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=UZASPEA <noreply@yourdomain.com>
```

---

### S-06 — Role-based transition guards in OrderViewSet.advance()
File: `backend/marketplace/api_views.py` → `OrderViewSet.advance()`

Add after `new_state = request.data.get('status')`:
```python
# FIX: S-06 — Enforce who can trigger which transitions
STAFF_ONLY_STATES = {'PAID', 'COMPLETED', 'REFUNDED', 'EXPIRED'}
SELLER_ALLOWED_STATES = {'PROCESSING', 'SHIPPED'}
BUYER_ALLOWED_STATES = {'AWAITING_PAYMENT', 'PENDING_VERIFICATION'}

is_buyer = order.user == request.user

if new_state in STAFF_ONLY_STATES and not request.user.is_staff:
    return Response(
        {'error': f'Only staff can set order status to {new_state}.'},
        status=403
    )
if new_state in SELLER_ALLOWED_STATES and not (request.user.is_staff or is_seller):
    return Response(
        {'error': f'Only the seller or staff can advance order to {new_state}.'},
        status=403
    )
if new_state in BUYER_ALLOWED_STATES and not (request.user.is_staff or is_buyer):
    return Response(
        {'error': f'Only the buyer or staff can move order to {new_state}.'},
        status=403
    )
```

---

### S-07 — Fix UserProfileViewSet: object-level permissions + make is_verified and tier read-only
File: `backend/marketplace/api_views.py` → `UserProfileViewSet`

```python
class UserProfileViewSet(viewsets.ModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'user__username'

    def get_queryset(self):
        return UserProfile.objects.all()

    def get_permissions(self):  # FIX: S-07
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()
```

File: `backend/marketplace/serializers.py` → `UserProfileSerializer.Meta`

```python
class Meta:
    model = UserProfile
    fields = ['id', 'user', 'username', 'is_verified', 'phone_number',
              'instagram_username', 'website', 'bio', 'tier', 'location',
              'profile_picture', 'banner_image']
    read_only_fields = ['user', 'is_verified', 'tier']  # FIX: S-07 — only staff should set these
```

---

### S-08 — Fix SponsoredListingViewSet anonymous detail access
File: `backend/marketplace/api_views.py` → `SponsoredListingViewSet`

Add `get_object()` override:
```python
def get_object(self):  # FIX: S-08 — enforce queryset scope on detail views
    obj = super().get_object()
    user = self.request.user
    if not user.is_authenticated and obj.status != 'approved':
        from rest_framework.exceptions import NotFound
        raise NotFound()
    if user.is_authenticated and not user.is_staff and obj.user != user and obj.status != 'approved':
        from rest_framework.exceptions import NotFound
        raise NotFound()
    return obj
```

---

### S-09 — Enforce StaffPermission.expires_at in has_staff_permission()
File: `backend/uzachuo/permissions.py`

Replace:
```python
def has_staff_permission(user, permission_codename):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return StaffPermission.objects.filter(user=user, permission=permission_codename, is_active=True).exists()
```
With:
```python
def has_staff_permission(user, permission_codename):
    from django.utils import timezone
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    # FIX: S-09 — enforce expiry date on time-limited permissions
    return StaffPermission.objects.filter(
        user=user,
        permission=permission_codename,
        is_active=True,
    ).filter(
        models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
    ).exists()
```
Add `from django.db import models` import at the top of `permissions.py`.

---

### S-10 — Replace bare except in CustomTokenObtainPairSerializer
File: `backend/marketplace/api_views.py`

Replace:
```python
try:
    data['is_verified'] = self.user.profile.is_verified
    data['tier'] = self.user.profile.tier
except:
    data['is_verified'] = False
    data['tier'] = 'free'
```
With:
```python
try:
    data['is_verified'] = self.user.profile.is_verified  # FIX: S-10
    data['tier'] = self.user.profile.tier
except (UserProfile.DoesNotExist, AttributeError):
    data['is_verified'] = False
    data['tier'] = 'standard'
```

---

### S-11 — Wire PaymentConfirmation approval to activate Subscription
File: `backend/marketplace/models.py` — add a signal after `create_or_update_user_profile`:

```python
from django.utils import timezone as tz

@receiver(post_save, sender=PaymentConfirmation)
def activate_subscription_on_payment_approval(sender, instance, **kwargs):
    """FIX: S-11 — Activate subscription when payment confirmation is approved."""
    if instance.status == 'approved':
        from datetime import timedelta
        sub, _ = Subscription.objects.get_or_create(
            user=instance.user,
            defaults={'tier': instance.tier}
        )
        sub.tier = instance.tier
        sub.is_active = True
        sub.start_date = tz.now()
        sub.end_date = tz.now() + timedelta(days=instance.tier.duration)
        sub.save()
        # Sync UserProfile tier
        try:
            profile = instance.user.profile
            profile.tier = 'premium' if instance.tier else 'standard'
            profile.save(update_fields=['tier'])
        except UserProfile.DoesNotExist:
            pass
```

---

### S-12 — Remove conflicting UserProfile.following M2M field
File: `backend/marketplace/models.py`

Remove line 287:
```python
# DELETE THIS LINE — FIX: S-12 — clashes with Follow.follower related_name='following' and Follow.following related_name='followers'
following = models.ManyToManyField(User, related_name='followers', blank=True, symmetrical=False)
```

Update the two count methods:
```python
def get_followers_count(self):
    return self.followers.count()  # FIX: S-12 — Follow.following reverse accessor

def get_following_count(self):
    return Follow.objects.filter(follower=self.user).count()  # FIX: S-12
```

Run: `python manage.py makemigrations marketplace` then `python manage.py migrate`

---

### S-13 — Fix NewsletterSubscription conflicting unique constraints
File: `backend/marketplace/models.py`

Change:
```python
email = models.EmailField(unique=True)  # FIX: S-13 — remove unique=True, unique_together handles per-category uniqueness
```
To:
```python
email = models.EmailField()  # FIX: S-13
```

Run `python manage.py makemigrations marketplace` then `python manage.py migrate`.

---

## LOGIC FIXES

### L-01 — Wrap OrderSerializer.create() in transaction.atomic()
Already covered as part of C-01 fix. Confirm the `with transaction.atomic():` wrapper covers the full create body.

---

### L-02 — Add missing Order fields to serializer
File: `backend/marketplace/serializers.py` → `OrderSerializer.Meta`

Replace:
```python
fields = ['id', 'user', 'buyer_username', 'order_date', 'total_amount', 'status', 'items', 'timeline_events', 'payments', 'seller_subtotal']
read_only_fields = ['user', 'total_amount']
```
With:
```python
fields = [
    'id', 'user', 'buyer_username', 'order_date', 'total_amount', 'status',
    'shipping_method', 'shipping_fee',  # FIX: L-02 — include shipping fields
    'items', 'timeline_events', 'payments', 'seller_subtotal'
]
read_only_fields = ['user', 'total_amount']
```

Add `delivery_info` JSONField to the `Order` model:
```python
delivery_info = models.JSONField(null=True, blank=True, default=dict)  # FIX: L-02 — store buyer's name/phone/address
```
Add `'delivery_info'` to the serializer fields list.

In `OrderSerializer.create()`, ensure `delivery_info` from `validated_data` is passed to `Order.objects.create()`. Since it's in `validated_data` (not popped), it will be included automatically after adding it to fields.

Run `python manage.py makemigrations marketplace` then `python manage.py migrate`.

Also fix `CheckoutPage.tsx` — the order summary panel shows `totalPrice` without shipping:
```tsx
{/* FIX: L-02 — show finalTotal (includes shipping), not totalPrice */}
<span className="text-xl font-bold text-blue-600 dark:text-blue-400">
  TSh {finalTotal.toLocaleString()}
</span>
```

---

### L-03 — Fix OrderSerializer.get_seller_subtotal() null context crash
File: `backend/marketplace/serializers.py`

Replace:
```python
def get_seller_subtotal(self, obj):
    user = self.context.get('request').user
    if not user or user.is_anonymous:
        return obj.total_amount
    return sum(item.subtotal() for item in obj.orderitem_set.filter(product__seller=user))
```
With:
```python
def get_seller_subtotal(self, obj):
    request = self.context.get('request')  # FIX: L-03 — guard against missing context
    if not request or not hasattr(request, 'user') or request.user.is_anonymous:
        return float(obj.total_amount)
    return float(sum(item.subtotal() for item in obj.orderitem_set.filter(product__seller=request.user)))
```

---

### L-04 — Fix N+1 on product images in incoming() endpoint
File: `backend/marketplace/api_views.py` → `OrderViewSet.incoming()`

In `format_order()`, replace:
```python
'product_image': item.product.images.first().image.url if item.product.images.exists() else None,
```
With:
```python
# FIX: L-04 — use prefetched images, avoid 2 queries per item
_imgs = list(item.product.images.all())
'product_image': _imgs[0].image.url if _imgs else None,
```
The `seller_items_prefetch` already calls `.prefetch_related('product__images')` so `item.product.images.all()` hits the cache.

---

### L-05 & M-05 — Fix ReviewViewSet: filter unapproved for non-staff, add approve action
File: `backend/marketplace/api_views.py` → `ReviewViewSet`

Replace `get_queryset()`:
```python
def get_queryset(self):
    # FIX: L-05 — non-staff only see approved reviews
    product_id = self.request.query_params.get('product', None)
    qs = Review.objects.all()
    if not self.request.user.is_staff:
        qs = qs.filter(approved=True)
    if product_id:
        qs = qs.filter(product_id=product_id)
    return qs
```

Add approve action:
```python
@decorators.action(detail=True, methods=['post'], permission_classes=[IsStaffMember])
def approve(self, request, pk=None):
    """FIX: M-05 — Staff can approve reviews."""
    review = self.get_object()
    review.approved = True
    review.save(update_fields=['approved'])
    return Response({'approved': True, 'id': review.id})

@decorators.action(detail=True, methods=['post'], permission_classes=[IsStaffMember])
def reject(self, request, pk=None):
    review = self.get_object()
    review.delete()
    return Response(status=204)
```

---

### L-06 & L-07 — Add owner checks to Review and Comment ViewSets
File: `backend/marketplace/api_views.py`

Add to `ReviewViewSet`:
```python
def get_permissions(self):  # FIX: L-06
    if self.action in ['update', 'partial_update', 'destroy']:
        return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
    return super().get_permissions()
```

Add to `CommentViewSet`:
```python
def get_permissions(self):  # FIX: L-07
    if self.action in ['update', 'partial_update', 'destroy']:
        return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
    return super().get_permissions()
```

---

### L-08 — Prevent cancellation of SHIPPED orders
File: `backend/marketplace/services.py` → `OrderStateMachine.transition_order()`

Replace:
```python
if new_state == 'CANCELLED' and order.status not in ['COMPLETED', 'DELIVERED']:
    pass
```
With:
```python
# FIX: L-08 — cannot cancel once shipped, delivered, or completed
if new_state == 'CANCELLED' and order.status not in ['COMPLETED', 'DELIVERED', 'SHIPPED']:
    pass
```

---

### L-09 — Covered in C-03 fix above (deposit_paid status).

---

### L-10 — Prevent double-report creation during check-in
File: `backend/inspections/api_views.py` → `InspectionCheckInViewSet.create()`

Replace:
```python
if not hasattr(request_obj, 'report'):
    InspectionReport.objects.create(
        request=request_obj,
        submitted_by=request.user,
        submitted_at=timezone.now()
    )
```
With:
```python
# FIX: L-10 — use get_or_create to prevent duplicate report shells
InspectionReport.objects.get_or_create(
    request=request_obj,
    defaults={
        'submitted_by': request.user,
        'verdict': 'conditional',  # placeholder until finalized
    }
)
```

---

### L-11 — Increment inspector.total_flags when fraud flags are created
File: `backend/inspections/api_views.py` → `auto_fraud_check()`

After `FraudFlag.objects.bulk_create(flags)`:
```python
FraudFlag.objects.bulk_create(flags)
# FIX: L-11 — update inspector's flag count
if flags:
    active = inspection_request.assignments.filter(is_active=True).first()
    if active:
        InspectorProfile.objects.filter(pk=active.inspector_id).update(
            total_flags=models.F('total_flags') + len(flags)
        )
return len(flags) > 0
```
Add `from django.db import models` at top if not present, and add `from .models import InspectorProfile` if not already imported.

---

### L-12 — Set expires_at on SponsoredListing approval
File: `backend/staff/api_views.py` → `SponsoredListingReviewViewSet.approve()`

Add after `listing.approved_at = timezone.now()`:
```python
from datetime import timedelta
listing.expires_at = timezone.now() + timedelta(days=30)  # FIX: L-12 — auto-expire after 30 days
```

Add expiry filter to `SponsoredListingViewSet.get_queryset()` for non-staff:
```python
from django.utils import timezone as tz
if user.is_authenticated:
    return SponsoredListing.objects.filter(
        models.Q(user=user) | models.Q(
            status='approved'
        ).filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=tz.now())  # FIX: L-12
        )
    ).order_by('-created_at')
return SponsoredListing.objects.filter(
    status='approved'
).filter(
    models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=tz.now())  # FIX: L-12
).order_by('?')
```

---

### L-13 — Schedule check_expirations command
File: create `backend/uzachuo/cron.py` (or document in README):

The `check_expirations` management command must be run periodically. Since no Celery is configured, add a cron entry:
```
# /etc/cron.d/uzaspea
*/30 * * * * www-data cd /path/to/backend && .venv/bin/python manage.py check_expirations >> /var/log/uzaspea_cron.log 2>&1
```

If Celery is added in future, the task body is already written — just wrap it as a Celery task.

---

## MISSING IMPLEMENTATION FIXES

### M-01 — Covered by C-04 (payment verify endpoint).

### M-02 — Stock restoration on cancellation
File: `backend/marketplace/services.py` → `OrderStateMachine.transition_order()`

After `order.save(update_fields=['status'])`:
```python
# FIX: M-02 — restore stock on cancellation (only if stock was already decremented)
if new_state == 'CANCELLED' and old_state not in ('CART', 'CHECKOUT'):
    from django.db.models import F as _F
    from .models import Product as _Product
    items = order.orderitem_set.all()
    for item in items:
        _Product.objects.filter(pk=item.product_id).update(
            stock=_F('stock') + item.quantity,
            is_available=True
        )
```

### M-03 — Covered in C-01 fix (auto-set is_available=False when stock=0).

### M-04 — Covered in S-11 fix (PaymentConfirmation signal activates Subscription).

### M-05 — Covered in L-05 fix (review approve/reject endpoints).

### M-06 — Covered in S-09 fix (expires_at enforcement in has_staff_permission).

### M-07 — Add authentication guard to WebSocket buyer connections
File: `backend/marketplace/consumers.py` → `OrderTrackingConsumer.connect()`

After `else: self.room_group_name = f'order_tracking_{self.order_id}'`:
```python
else:
    self.room_group_name = f'order_tracking_{self.order_id}'
    # FIX: M-07 — verify the connecting user owns this order
    user = self.scope.get('user')
    if not user or not user.is_authenticated:
        # Try token from query string for JWT clients
        qs = parse_qs(self.scope.get('query_string', b'').decode())
        token = qs.get('token', [None])[0]
        if token:
            user = await self._get_user_from_token(token)
        if not user:
            await self.close()
            return
    # Verify this user owns the order
    order_belongs = await self._user_owns_order(user, self.order_id)
    if not order_belongs:
        await self.close()
        return
```

Add the helper:
```python
@database_sync_to_async
def _user_owns_order(self, user, order_id):
    """FIX: M-07 — check order ownership before allowing WS connection."""
    from marketplace.models import Order
    try:
        return Order.objects.filter(id=order_id, user=user).exists() or user.is_staff
    except Exception:
        return False
```

### M-08 — Covered in C-11 fix (ReInspection generates proper bill).

---

## POST-FIX CHECKLIST

Run these in order after applying all fixes:

```bash
cd backend

# Check for system errors (follow model clash, etc.)
python manage.py check --deploy

# Generate all new migrations
python manage.py makemigrations marketplace inspections staff

# Apply migrations
python manage.py migrate

# Verify no remaining check errors
python manage.py check

# Run any existing tests
python manage.py test
```

Frontend:
```bash
cd frontend
npm run build  # should compile with zero TypeScript errors
```

## END-TO-END WORKFLOW VERIFICATION CHECKLIST

After all fixes, verify each workflow manually:

| Workflow | Steps | Expected |
|---|---|---|
| Registration | POST /api/auth/register/ with strong password | 201, tokens returned |
| Registration | POST with weak password (< 8 chars) | 400, validation error |
| Login | POST /api/auth/token/ | 200, tokens + user data |
| Cart | Add product to cart, close tab, reopen | Cart persists (localStorage) |
| Checkout | POST /api/orders/ with items + shipping_method + shipping_fee + delivery_info | Order created as CART, stock decremented |
| Checkout | POST with quantity > stock | 400, validation error |
| Order flow | buyer: advance to AWAITING_PAYMENT | 200 |
| Order flow | buyer: advance to PENDING_VERIFICATION with proof | Payment record created |
| Order flow | staff: verify payment via /api/payments/{id}/verify/ | Order → PAID |
| Order flow | seller: advance to PROCESSING | 200 |
| Order flow | seller: advance to SHIPPED | 200 |
| Order flow | buyer: receives delivery, seller marks DELIVERED | 200 |
| Order flow | buyer: marks COMPLETED | 200 |
| Order flow | buyer: leave review (only after COMPLETED) | 201, approved=False |
| Review | staff: approve review | Review visible to public |
| Cancel | seller tries to cancel SHIPPED order | 400 error |
| Seller | tries to set order PAID directly | 403 error |
| Profile | user PATCHes another user's profile | 403 error |
| Profile | user tries to set is_verified=True on own profile | Field ignored (read_only) |
| Inspection | request → bill_sent → acknowledge → awaiting_payment → deposit payment submitted → staff approves → deposit_paid → pre_inspection → assigned → in_progress → submitted → qa_review → published | Full flow succeeds |
| Sponsored | staff approves listing | expires_at set to +30 days |
| Stock | order cancelled after payment | stock restored |
| Stock | product reaches 0 stock | is_available=False auto-set |
| Subscription | PaymentConfirmation approved | Subscription.is_active=True, UserProfile.tier updated |
| WebSocket | unknown user connects to order tracking | Connection refused |
```
