/**
 * Batched, privacy-light recommendation tracking (recs v3 & v3.1).
 * Sends at most one small POST per 30s (or when 10 events are queued, or when the tab is hidden).
 * Payload = product ids viewed, rec impressions per surface, rec clicks, A/B variant, cart adds.
 */
import { getSavedVehicleId, getRecRegion } from './recentViews';
import { getAccessToken } from '../api';

export type RecSurface = 'similar' | 'ymal' | 'foryou' | 'cat_shelf' | 'cart' | 'empty_search' | 'order';
export type RecVariant = 'control' | 'variant_b';

const API_BASE: string = import.meta.env.DEV ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') : '';
const FLUSH_AT = 10;
const FLUSH_AFTER_MS = 30000;
const AB_STORAGE_KEY = 'sokonimax_ab_rec';
const CLICKS_MAP_KEY = 'sokonimax_rec_clicks_map';
const SEEN_COUNTS_KEY = 'rec_seen_counts';

let views: number[] = [];
let impressions: Record<string, number> = {};
let clicks: { s: string; p: number }[] = [];
let cartAdds: { s: string; p: number }[] = [];
let timer: number | null = null;
let lastView: { id: number; at: number } | null = null;

/**
 * Returns deterministic A/B test variant ('control' or 'variant_b').
 * Persisted in localStorage so a user/device stays in the same bucket.
 */
export function getRecVariant(): RecVariant {
  try {
    const existing = localStorage.getItem(AB_STORAGE_KEY);
    if (existing === 'control' || existing === 'variant_b') {
      return existing;
    }
    const assigned: RecVariant = Math.random() < 0.5 ? 'control' : 'variant_b';
    localStorage.setItem(AB_STORAGE_KEY, assigned);
    return assigned;
  } catch {
    return 'control';
  }
}

/**
 * Saves click attribution for a recommended product.
 * Stored with a 7-day TTL so downstream Add-to-Cart and Checkout actions
 * attribute back to the surface and A/B variant.
 */
export function saveRecClickAttribution(surface: string, productId: number, variant?: string): void {
  if (!Number.isInteger(productId) || productId <= 0) return;
  const activeVariant = variant || getRecVariant();
  try {
    const raw = localStorage.getItem(CLICKS_MAP_KEY);
    let map: Record<string, { surface: string; variant: string; ts: number }> = raw ? JSON.parse(raw) : {};
    if (typeof map !== 'object' || map === null) map = {};
    map[String(productId)] = { surface, variant: activeVariant, ts: Date.now() };

    // Prune entries older than 7 days or limit to 50 items
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const entries = Object.entries(map).filter(([, v]) => v && v.ts > cutoff);
    if (entries.length > 50) entries.splice(0, entries.length - 50);
    localStorage.setItem(CLICKS_MAP_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignore
  }
}

/**
 * Returns attribution info for a product if it was clicked from a recommendation surface.
 */
export function getRecAttributionForProduct(productId: number): { rec_surface: string; rec_variant: string } {
  try {
    const raw = localStorage.getItem(CLICKS_MAP_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      const entry = map?.[String(productId)];
      if (entry && entry.surface) {
        return {
          rec_surface: String(entry.surface).slice(0, 32),
          rec_variant: String(entry.variant || getRecVariant()).slice(0, 16),
        };
      }
    }
  } catch {
    // ignore
  }
  return { rec_surface: '', rec_variant: getRecVariant() };
}

/* ─── Impression Fatigue Tracking ──────────────────────────────── */
let cachedSeenCounts: Record<string, number> | null = null;
let saveSeenTimeout: ReturnType<typeof setTimeout> | null = null;

function loadSeenCounts(): Record<string, number> {
  if (cachedSeenCounts) return cachedSeenCounts;
  try {
    const raw = localStorage.getItem(SEEN_COUNTS_KEY);
    cachedSeenCounts = raw ? JSON.parse(raw) : {};
    if (typeof cachedSeenCounts !== 'object' || cachedSeenCounts === null) cachedSeenCounts = {};
  } catch {
    cachedSeenCounts = {};
  }
  return cachedSeenCounts!;
}

function flushSeenCounts(): void {
  if (!cachedSeenCounts) return;
  try {
    const keys = Object.keys(cachedSeenCounts);
    if (keys.length > 200) {
      const trimmed: Record<string, number> = {};
      for (const k of keys.slice(-150)) trimmed[k] = cachedSeenCounts[k];
      cachedSeenCounts = trimmed;
    }
    localStorage.setItem(SEEN_COUNTS_KEY, JSON.stringify(cachedSeenCounts));
  } catch {
    // quota
  }
}

export function incrementProductSeenCount(productId: number): number {
  if (!Number.isInteger(productId) || productId <= 0) return 0;
  const counts = loadSeenCounts();
  const key = String(productId);
  const next = (counts[key] || 0) + 1;
  counts[key] = next;

  // Batch writes with a debounce so mounting dozens of cards does ZERO synchronous disk IO
  if (saveSeenTimeout) clearTimeout(saveSeenTimeout);
  saveSeenTimeout = setTimeout(flushSeenCounts, 300);

  return next;
}

export function getProductSeenCount(productId: number): number {
  const counts = loadSeenCounts();
  return counts[String(productId)] || 0;
}

export function getFatiguedProductIds(threshold = 3): number[] {
  try {
    const counts = loadSeenCounts();
    if (!counts || typeof counts !== 'object') return [];
    return Object.entries(counts)
      .filter(([, c]) => typeof c === 'number' && c >= threshold)
      .map(([id]) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

/* ─── Event Dispatch & Flush ───────────────────────────────────── */
function readCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function pending(): number {
  return views.length + clicks.length + cartAdds.length + Object.keys(impressions).length;
}

export function flushRecEvents(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (pending() === 0) return;
  const body = JSON.stringify({
    views,
    impressions,
    clicks,
    cart_adds: cartAdds,
    variant: getRecVariant(),
    vehicle_id: getSavedVehicleId(),
    region: getRecRegion() || null,
  });
  views = [];
  impressions = {};
  clicks = [];
  cartAdds = [];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  try {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // ignore
  }
  const csrf = readCookie('csrftoken');
  if (csrf) headers['X-CSRFToken'] = csrf;
  try {
    void fetch(`${API_BASE}/api/recs/events/`, {
      method: 'POST',
      body,
      headers,
      keepalive: true,
      credentials: 'include',
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}

export function clearRecQueues(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  views = [];
  impressions = {};
  clicks = [];
  cartAdds = [];
  lastView = null;
}

function schedule(): void {
  if (pending() >= FLUSH_AT) {
    flushRecEvents();
    return;
  }
  if (timer === null) timer = window.setTimeout(flushRecEvents, FLUSH_AFTER_MS);
}

export function trackView(productId: number): void {
  if (!Number.isInteger(productId) || productId <= 0) return;
  const now = Date.now();
  if (lastView && lastView.id === productId && now - lastView.at < 60000) return;
  lastView = { id: productId, at: now };
  views.push(productId);
  if (views.length > 30) views = views.slice(-30);
  schedule();
}

export function trackRecImpression(surface: RecSurface, count: number): void {
  if (!count || count < 0) return;
  impressions[surface] = (impressions[surface] || 0) + Math.min(count, 50);
  schedule();
}

export function trackRecClick(surface: string, productId: number): void {
  if (!Number.isInteger(productId) || productId <= 0) return;
  clicks.push({ s: surface, p: productId });
  saveRecClickAttribution(surface, productId);
  schedule();
}

export function trackRecCartAdd(surface: string, productId: number): void {
  if (!Number.isInteger(productId) || productId <= 0) return;
  cartAdds.push({ s: surface, p: productId });
  schedule();
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushRecEvents();
  });
  window.addEventListener('pagehide', flushRecEvents);
}
