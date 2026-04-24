# Uzaspea: Comprehensive Legacy-to-React Feature Parity Matrix

This document provides an exhaustive, granular breakdown of every single logic branch, Javascript interaction, and UI micro-feature defined in the original Django Monolith (`views.py`, `templates/*.html`) mapped to DRF + React. 

The goal is to ensure absolutely **zero feature degradation**, catching every checkmark, scroll event, and hover state.

---

## 1. Storefront & Discovery Layer

### Data & Sorting Logic
| Legacy Feature (Django Monolith) | Legacy Mechanism (`views.py` / Templates) | DRF / React Destination | Status |
| :--- | :--- | :--- | :--- |
| **Global Product Listing** | `product_list` QuerySets with annotations (`Avg('reviews__rating')`). | DRF `ProductViewSet` with `avg_rating` SerializerField. | 🟢 Done |
| **Deep Search** | `Q()` queries on name, description, category. | DRF Filter Backends on `?search=`. | 🟢 Done |
| **Range & Condition Filters** | Manual `request.GET.get('max_price')` intercepts. | DRF `DjangoFilterBackend` + Form Controls. | 🟢 Done |

### Fine-Grained UI & Javascript Features
| Legacy Micro-Feature | Legacy Mechanism (`product_list.html` & Scripts) | DRF / React Destination | Status |
| :--- | :--- | :--- | :--- |
| **Infinite Pagination Scroll** | JS `window.addEventListener('scroll')` triggering when pixel depth hits `document.body.offsetHeight - 50`. | React `IntersectionObserver` attached to empty layout div triggering `setPage(prev + 1)`. | 🟢 Done |
| **Navbar Auto-Hide (Debounced)** | `base.html` JS listening to `window.pageYOffset` pushing `navbar-hidden` vs `navbar-visible` on scroll directions. | React Framer Motion or sticky Hook tracking Y axis scroll variance. | 🔴 Unmapped |
| **Loading Spinners** | JS intercept triggering `.style.display = 'block'` on `#loading-indicator` Bootstrap spinner. | React conditional rendering `loading && <Spinner />` below grid. | 🟢 Done |
| **End of List Alerts** | Fetch catching `404` and displaying `#end-of-scroll-message` sticky banner. | React evaluating `hasMore === false` and showing boundary message. | 🟢 Done |
| **Global Image Fallback (`onerror`)**| Dashboard `<script>` injecting `img.onerror` setting `no_image.png` globally on 404s. | React `<img onError={e => e.target.src = '/no_image.png'}>` or generic wrapper. | 🔴 Unmapped |
| **Staggered Card Animations** | Dashboard looping `setTimeout` index multiplying `100ms` translate limits. | React `framer-motion` array mapping with `staggerChildren`. | 🔴 Unmapped |
| **Smart Image Zoom Hover** | Vanilla JS `enableImageZoom()` binding `transform: scale(1.1)` on `mouseover`. | TailwindCSS native class `group-hover:scale-105 duration-300`. | 🟢 Restored |
| **Lazy Loaded Images** | `<img loading="lazy">` tags attached to Product grids and Marketing banners. | Same `loading="lazy"` attribute applied seamlessly in TSX. | 🟢 Restored |
| **Premium Verification Badges** | Hardcoded conditional `{% if profile.tier == 'premium' %}` loading `gold_checkmark.png` vs `greeen_ckeckmark.png`. | Dedicated TSX Badge Component mapping Tier to locally imported PNGs. | 🟢 Restored |
| **Accordion Category Panels** | JS binding `category-chevron-btn` executing Bootstrap `.show()` and Auto-collapsing neighbors. | React State tracking `openCategory` passing `height-auto` via Framer Motion / Tailwind. | 🟢 Restored |
| **Tooltip Initialization** | `bootstrap.Tooltip(tooltipTriggerEl)` mapping overall. | React Tooltip wrapping standard Lucide UI elements. | 🟡 UI Hooking |

---

## 2. Product Details & Engagements

| Legacy Micro-Feature | Legacy Mechanism (`views.py` / Scripts) | DRF / React Destination | Status |
| :--- | :--- | :--- | :--- |
| **AJAX Product Likes** | Fetch hitting `like_product` returning `{liked: True, count: 5}` triggering instant DOM updates. | React `onClick` fetching DRF `@action` changing localized Array counts immediately. | 🟡 Connect |
| **Review Creation Blocks** | `ReviewForm` checking `has_reviewed` enforcing distinct boundaries. | DRF Endpoint caching duplicates securely. | 🟢 API Locked |
| **Tabbed Review / Comments**| Bootstrap Data-Target Nav Tabs showing/hiding layers. | React `useState('reviews')` conditionally mounting components. | 🟡 In Progress |

---

## 3. Cart & Order Lifecycle

| Legacy Micro-Feature | Legacy Mechanism (`views.py` / Scripts) | DRF / React Destination | Status |
| :--- | :--- | :--- | :--- |
| **AJAX Add to Cart** | Header `X-Requested-With: XMLHttpRequest` throwing JSON without redirection mapping `cart_items_count`. | React Cart Service bumping Navbar Badge live. | 🟡 UI Build |
| **Live Cart Manipulation** | `update_cart` intercept checking `quantity > product.stock` and capping array blocks silently. | React `onChange` triggering DB checks securely preventing over-draw. | 🟢 API Locked |
| **Realtime Tracking Flow** | WebSockets + Daphne pushing live dispatch updates straight to customer UI. (Missing in monolith). | Real-time WebSocket OrderTracking hook + Redis broadcasting on State Transitions. | 🟢 Done |

---

## 4. Multi-Tier Verifications & User Matrix

| Legacy Micro-Feature | Legacy Mechanism (`views.py` & UI) | DRF / React Destination | Status |
| :--- | :--- | :--- | :--- |
| **Follow / Unfollow Engine**| `follow_user` AJAX POST checking counts preventing "follow self" natively. | React hooking UserViewSet `@action` safely rendering. | 🟢 API Locked |
| **Tier Upgrade Cards** | Template detecting `tier` vs `is_verified` wrapping specific colored `border-success / border-warning` promo boxes on Sidebars. | React Right Sidebar rendering Conditional Upgrade Ads strictly. | 🟢 Restored |

---

## 5. Payments & Lipa Namba
| Legacy Feature | Legacy Mechanism | DRF / React Destination | Status |
| :--- | :--- | :--- | :--- |
| **Mobile Networks Display** | `subscription_payment_view` fetching `MobileNetwork` prefetching `lipa_numbers`. | Separate DRF API endpoint for Network/Number retrieval. | 🟢 API Locked |

---

## 6. Seller Tools (Dashboard)
| Legacy Feature (Django Monolith) | Legacy Mechanism (`views.py` / Templates) | DRF / React Destination | Status |
| :--- | :--- | :--- | :--- |
| **Auth Guard** | `@login_required` overriding non-staff or non-seller users. | React Route Guards reading JWT Claims (`is_staff`). | 🟢 Done |
| **Stat Generation** | `Order.objects.filter(orderitem_set__product__seller=request.user)`. | Dedicated aggregate DRF endpoints returning metric JSON mapping. | 🟢 API Locked |
| **Product CRUD** | `product_create`, `product_update`, `product_delete`. | React Dashboard hooks hitting `PUT/POST/DELETE /api/products/`. | 🟢 Done |
| **Multi-Image Uploads** | `ProductImageFormSet` handling bulk file binaries. | React multi-file selector mapping to `FormData` over DRF generic parser. | 🟢 Done |

---

## 7. HIDDEN FEATURE: Native Staff CRM & Task Delegation
*Discovered during scorched-earth repository scan inside `backend/staff/`.*

| Legacy Feature (Hidden CMS) | Legacy Mechanism (`staff/views.py` & `models.py`) | DRF / React Destination | Status |
| :--- | :--- | :--- | :--- |
| **Internal Audit Logging** | `AuditLog` tracking IP Addresses, `UserAgents`, and Actions (`login`, `staff_promoted`). | Required DRF Interceptor / ViewSet mapping logs synchronously. | 🔴 Unmapped |
| **Bespoke Permissions** | `StaffPermission` extending Django permissions natively (`can_approve_content`, `can_verify_requests`). | DRF Route Guards mapping specific Django Groups/Permissions payload. | 🔴 Unmapped |
| **Task Delegation UI** | Models `Task` / `TaskCategory` assigning moderate tasks to specific staff limits. | React Admin Dashboard with `Task` columns and kanban logic. | 🔴 Unmapped |
| **Double Verification Workflow**| `TaskAction` -> `Approval` models enforcing Two-Factor human approvals for User Upgrades or Content Deletions. | State machine expansion on Backend tracking Approvals per Action. | 🔴 Unmapped |
| **Staff APIs** | `api/user/<id>/permissions/update/` handling live permission patching. | Integration into main `/api/` router utilizing DRF Custom Permission endpoints. | 🔴 Unmapped |

---

## 8. HIDDEN FEATURE: Global System & Static Javascript Injectors
*Discovered inside `settings.py` and `static/js/*.js` files.*

| Legacy Feature | Legacy Mechanism (`settings.py` / `marketplace.js`) | DRF / React Destination | Status |
| :--- | :--- | :--- | :--- |
| **Volatile Sessions** | `SESSION_EXPIRE_AT_BROWSER_CLOSE = True` forcing cart destruction. | React `sessionStorage` preferred over `localStorage` for cart holding. | 🔴 Unmapped |
| **WhiteNoise Static Engine** | `WhiteNoiseMiddleware` capturing `/static/` payloads efficiently. | Nginx or Vite built-assets bypassing Django entirely in Prod. | 🟢 Architected |
| **Dynamic Form Override** | `marketplace.js` extracting `form.action` & `form.method` dynamically instead of using hardcoded API URLs. | React dynamic `onSubmit` wrappers extracting native HTML properties. | 🔴 Unmapped |
| **Global CSRF Injection** | Custom JS `getCookie('csrftoken')` parsed and pushed into all Axios/Fetch Headers securely. | Global Axios Interceptor passing X-CSRFToken. | 🔴 Unmapped |
| **Auto-Destructing Alerts** | `setTimeout(() => alert.remove(), 3000)` catching Bootstrap objects. | React `react-hot-toast` or similar notification library auto-clearing logic. | 🔴 Unmapped |

---

> [!IMPORTANT]
> **Checkmark & Lazy Load Assurance**: Every fine-grained template asset—including the literal `gold_checkmark.png`, the `X-Requested-With` JSON overrides, the literal infinite scroll JS `window` height catchers, and all `loading="lazy"` tags—has been explicitly defined here to guarantee absolute 1:1 reconstruction in the React shadow DOM.
