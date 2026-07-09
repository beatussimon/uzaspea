# Uzaspea Platform Audit & AI Agent Implementation Guide (work.md)

This document contains the complete audit and step-by-step instructions to resolve the 11 core issues currently affecting the Uzaspea marketplace. Follow these instructions exactly.

---

## Part 1 — Security & Integrity Rules (CRITICAL)

> [!CAUTION]
> **Safety First:** Never run `docker compose down -v` or `rm -rf persistent_data/postgres` under any circumstances. Wiping the database will result in immediate termination.
> Ensure all changes are verified locally and pre-commit checks are run before pushing to deployment.

---

## Part 2 — Issue-by-Issue Implementation Guide

### 1. Complete Inspection Checklist Template Alignment
- **Problem:** When an inspection is checked in (`backend/inspections/api_views.py`), the system retrieves a `ChecklistTemplate` hierarchically. If the category or its ancestors do not have a template defined, it falls back to version `1` but associates no checklist items. The inspector is shown: *"No checklist template found for this category. Contact admin."* and is blocked. Furthermore, `seed_inspections.py` only defines checklists for 5 of the 11 categories, and there are naming/slug mismatches between `seed.py` and `seed_inspections.py`.
- **Target Files:**
  - `backend/inspections/api_views.py`
  - `backend/marketplace/management/commands/seed.py`
- **Steps to Fix:**
  1. In `backend/inspections/api_views.py`, locate the hierarchical template lookup in the `checkin` action (around line 771). Modify it to automatically create a default template (with items like *"Physical Condition"*, *"Basic Functionality Check"*, and *"Packaging/Manuals Presence"*) if no template is found, ensuring inspectors are never blocked:
     ```python
     # Hierarchical lookup for a template
     current = request_obj.category
     latest_template = None
     while current:
         latest_template = ChecklistTemplate.objects.filter(category=current, is_active=True).order_by('-version').first()
         if latest_template:
             break
         current = current.parent

     if not latest_template:
         # Dynamically create fallback default template
         latest_template, _ = ChecklistTemplate.objects.get_or_create(
             category=request_obj.category,
             version=1,
             defaults={'is_active': True}
         )
         # Add default checklist items
         fallback_items = [
             ('General Physical Condition & Form', 'scale', True, True, '', 'Inspect physical shape, finish, and structural condition'),
             ('Basic Functionality Check', 'pass_fail', True, True, '', 'Verify if item performs its primary function successfully'),
             ('Packaging & Manuals Presence', 'scale', False, False, '', 'Check if original boxes, manuals, and accessories are present'),
         ]
         for idx, (label, ctype, mandatory, fail_flag, unit, help_text) in enumerate(fallback_items):
             ChecklistItem.objects.get_or_create(
                 template=latest_template, label=label,
                 defaults={
                     'item_type': ctype,
                     'is_mandatory': mandatory,
                     'order': idx,
                     'fail_triggers_flag': fail_flag,
                     'unit': unit,
                     'help_text': help_text,
                 }
             )
     version = latest_template.version
     ```
  2. Ensure the primary `seed.py` command is always run during deployment to seed all 11 subcategories cleanly.

---

### 2. Streamlining Inter-Warehouse Logistics UI
- **Problem:** Warehouse staff have no visual interface in the `WarehouseStaffLayout` dashboard to monitor, ship, or receive packages transferred between hubs.
- **Target Files:**
  - `frontend/src/pages/staff/warehouse/WarehouseStaffLayout.tsx`
- **Steps to Fix:**
  1. Add two new sections or swimlane columns to the operations dashboard representing **Inter-Warehouse Transfers**:
     - **Incoming Transfers**: Fetch data from `/api/warehouses/transfers/?warehouse={selectedWarehouseId}&status=in_transit`. Display the origin hub and order details. Add a button *"Confirm Receipt"* that triggers a POST request to `/api/warehouses/transfers/{id}/receive/`.
     - **Outgoing Transfers**: Fetch data from `/api/warehouses/transfers/?warehouse={selectedWarehouseId}&status=pending`. Display the destination hub and order details. Add a button *"Ship Package"* that triggers a POST request to `/api/warehouses/transfers/{id}/ship/`.

---

### 3. Fixing Subscription Tier Commission Calculation
- **Problem:** `backend/marketplace/services.py` calculates commission fees on order completion using a flat `SiteSettings.commission_rate` for all accounts, completely ignoring the seller's active subscription tier (which may offer lower commission rates, e.g. Customer=0%, Seller Pro=10%).
- **Target Files:**
  - `backend/marketplace/services.py`
- **Steps to Fix:**
  1. Locate the platform economics phase in the state transitions (around line 164). Replace the flat commission rate lookup with logic that resolves the seller's active subscription tier:
     ```python
     # Create a ledger entry for each seller using their tier rate
     from marketplace.models import Subscription, SiteSettings
     for seller, amount in seller_totals.items():
         active_sub = Subscription.objects.filter(user=seller, is_active=True).select_related('tier').first()
         if active_sub and active_sub.tier:
             rate_percent = active_sub.tier.commission_rate
         else:
             settings_obj = SiteSettings.get()
             rate_percent = settings_obj.commission_rate if settings_obj else Decimal('10.00')
         
         rate = rate_percent / Decimal('100')
         commission_amount = amount * rate
         CommissionLedgerEntry.objects.create(
             order=locked_order,
             seller=seller,
             order_amount=amount,
             commission_rate=rate_percent,
             commission_amount=commission_amount,
             entry_type=CommissionLedgerEntry.EntryType.COMMISSION
         )
     ```

---

### 4. Robust Language Toggle Fix
- **Problem:** The language toggle button in `Navbar.tsx` and `MobileBottomNav.tsx` toggles between English and Swahili but checks `i18n.language?.startsWith('sw')`. This fails when locales return full region tags (like `en-US` or `sw-TZ`), and the button text confuses users by showing the *next* language state rather than displaying the active status.
- **Target Files:**
  - `frontend/src/components/layout/Navbar.tsx`
  - `frontend/src/components/MobileBottomNav.tsx`
- **Steps to Fix:**
  1. Implement a clean language toggle helper in both files:
     ```typescript
     const toggleLanguage = () => {
       const currentLang = (i18n.language || 'en').split('-')[0];
       const newLang = currentLang === 'sw' ? 'en' : 'sw';
       i18n.changeLanguage(newLang);
       localStorage.setItem('i18nextLng', newLang);
     };
     ```
  2. Update the UI to render two side-by-side buttons `EN` and `SW` or a clear select dropdown showing both options, highlighting the active one (e.g. Amber text for active, muted gray for inactive).

---

### 5. Native/Browser Push Notifications Panel
- **Problem:** The browser notification permission request `Notification.requestPermission()` is executed directly inside a mounting `useEffect`. Modern browser safety policies block permission dialogs unless triggered by a direct user gesture (like a button click).
- **Target Files:**
  - `frontend/src/pages/dashboard/SettingsPage.tsx`
  - `frontend/src/main.tsx`
  - `frontend/public/sw.js` (Create New)
- **Steps to Fix:**
  1. Add a toggle button under Settings labeled *"Enable Desktop/Mobile Push Notifications"*. Set its click handler to invoke `Notification.requestPermission()`.
  2. Create a basic service worker `frontend/public/sw.js` that listens to push/display events:
     ```javascript
     self.addEventListener('push', function(event) {
       const data = event.data ? event.data.json() : {};
       const title = data.title || 'SokoniMax Notification';
       const options = {
         body: data.message || '',
         icon: '/logo.png',
         badge: '/logo.png'
       };
       event.waitUntil(self.registration.showNotification(title, options));
     });
     ```
  3. Register the service worker inside `frontend/src/main.tsx`:
     ```typescript
     if ('serviceWorker' in navigator) {
       window.addEventListener('load', () => {
         navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW registration failed:', err));
       });
     }
     ```

---

### 6. Fix regional hub intake blocking
- **Problem:** When packages arrive at the destination hub (`status = ARRIVED_AT_REGIONAL_WAREHOUSE`), checking them in triggers the `'destination_intake'` modal which requires signature inputs. Since the seller is not present at the regional hub, this blocks staff from completing the sorting.
- **Target Files:**
  - `frontend/src/pages/staff/warehouse/WarehouseStaffLayout.tsx`
- **Steps to Fix:**
  1. Locate `processScan` (around line 159) and `handleActionClick` (around line 213).
  2. For `ARRIVED_AT_REGIONAL_WAREHOUSE` status, open the `'last_mile_sorting'` modal (which bypasses signatures) instead of `'destination_intake'`:
     ```typescript
     case 'ARRIVED_AT_REGIONAL_WAREHOUSE':
       setActiveModal('last_mile_sorting');
       break;
     ```

---

### 7. Make Fleet Driver Assignment Optional
- **Problem:** The logistics system enforces that vehicle-category shipments must have a driver assigned before being dispatched. This is currently blocking operations.
- **Target Files:**
  - `backend/logistics/views.py`
- **Steps to Fix:**
  1. In both `perform_create` and `perform_update` methods of `ShipmentViewSet`, remove or comment out the `ValidationError` lines that raise errors when no driver is assigned:
     ```python
     # Remove or comment out this block:
     # if carrier_type == 'driver' and not driver:
     #     raise ValidationError("A driver must be assigned to vehicle-category shipments...")
     ```

---

### 8. Enforce Live Photo Capture
- **Problem:** Inspectors can bypass the live camera by clicking the fallback upload button to select pre-existing gallery images during inspection.
- **Target Files:**
  - `frontend/src/pages/inspections/InspectorLayout.tsx`
- **Steps to Fix:**
  1. Add `capture="environment"` to the hidden fallback file input inside the `CameraCapture` component (around line 348) to force mobile browsers to trigger the live camera application directly:
     ```tsx
     <input
       ref={inputRef}
       type="file"
       accept="image/*"
       capture="environment"
       className="hidden"
       onChange={handleFallbackUpload}
     />
     ```

---

### 9. Fix JSONField Mutation in Warehouse Views
- **Problem:** In `backend/warehouses/views.py`, the `delivery_info` JSONField is updated via in-place mutation: `order.delivery_info['current_warehouse_code'] = warehouse.code`. Because Django does not track in-place mutations on JSONField dictionaries, calling `order.save()` fails to persist these changes, losing the warehouse context.
- **Target Files:**
  - `backend/warehouses/views.py`
- **Steps to Fix:**
  1. In both `WarehouseIntakeViewSet.perform_create` and `WarehouseViewSet.set_delivery_fee`, assign a fresh copy of the dictionary to trigger Django's field tracker:
     ```python
     # Correct pattern:
     info_copy = dict(order.delivery_info or {})
     info_copy['current_warehouse_code'] = warehouse.code
     order.delivery_info = info_copy
     order.save(update_fields=['delivery_info'])
     ```

---

### 10. Remove Explicit Profile Tier Labels
- **Problem:** The biography tab in `ProfilePage.tsx` explicitly shows the user's tier (e.g. "Store Category: Business"). The user wants to display only the checkmark next to the username to indicate tier status.
- **Target Files:**
  - `frontend/src/pages/ProfilePage.tsx`
- **Steps to Fix:**
  1. Remove the "Store Category" grid block in `ProfilePage.tsx` (Lines 366-369).
  2. Replace references to the string `"partner"` in line 361 with `"seller"`.

---

### 11. Streamline Warehouse and Logistics UI Operations
- **Problem:** Warehouse staff have to switch between the warehouse dashboard (`WarehouseStaffLayout.tsx`) and the logistics manager screen (`LogisticsManager.tsx`) to handle driver assignments and dispatching, creating operational friction.
- **Target Files:**
  - `frontend/src/pages/staff/warehouse/WarehouseStaffLayout.tsx`
- **Steps to Fix:**
  1. Integrate the carrier details selection (Fleet/External choice, Fleet Driver dropdown, Tracking number input, and Delivery time) directly into the dispatch modal (`activeModal === 'dispatch'`) inside `WarehouseStaffLayout.tsx` so staff can manage dispatching and driver assignments in a single action window.

---

## Part 3 — Verification Commands

After applying these fixes, verify that the project builds and all tests pass:
```bash
# 1. Check Django setup
cd backend
python3 manage.py check

# 2. Run Django unit tests
python3 manage.py test logistics warehouses

# 3. Test build frontend
cd ../frontend
npm run build
```
