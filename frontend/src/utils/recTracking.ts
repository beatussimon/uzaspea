/**
 * Batched, privacy-light recommendation tracking (recs v3).
 * Sends at most one small POST per 30s (or when 10 events are queued, or when the tab is hidden).
 * Payload = product ids viewed, rec impressions per surface, rec clicks. No personal data.
 */
import { getSavedVehicleId, getRecRegion } from './recentViews';

export type RecSurface = 'similar' | 'ymal' | 'foryou' | 'cat_shelf' | 'cart' | 'empty_search';

const API_BASE: string = import.meta.env.DEV ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') : '';
const FLUSH_AT = 10;
const FLUSH_AFTER_MS = 30000;

let views: number[] = [];
let impressions: Record<string, number> = {};
let clicks: { s: string; p: number }[] = [];
let timer: number | null = null;
let lastView: { id: number; at: number } | null = null;

function readCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function pending(): number {
  return views.length + clicks.length + Object.keys(impressions).length;
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
    vehicle_id: getSavedVehicleId(),
    region: getRecRegion() || null,
  });
  views = [];
  impressions = {};
  clicks = [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('access_token');
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
      credentials: 'same-origin',
    }).catch(() => undefined);
  } catch {
    // ignore
  }
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
  schedule();
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushRecEvents();
  });
  window.addEventListener('pagehide', flushRecEvents);
}
