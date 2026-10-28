/**
 * Zero-Overhead Client-Side View Tracking
 *
 * Maintains a compact ring-buffer of recently viewed product IDs in localStorage.
 * Avoids any server database writes while giving the recommendation engine
 * instant context on user affinity and interest.
 */

const STORAGE_KEY = 'sokonimax_recent_views_v1';
const MAX_RECENT_ITEMS = 20;

/**
 * Records a product view by appending the ID to the front of the list.
 */
export function recordProductView(productId: number): void {
  if (!productId || typeof productId !== 'number' || isNaN(productId)) {
    return;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let ids: number[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) {
      ids = [];
    }

    // Filter out existing instance of this ID to move it to the front
    ids = ids.filter((id) => id !== productId);
    ids.unshift(productId);

    // Enforce ring-buffer capacity
    if (ids.length > MAX_RECENT_ITEMS) {
      ids = ids.slice(0, MAX_RECENT_ITEMS);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage might be unavailable (e.g. private browsing storage quota)
  }
}

/**
 * Returns the list of recently viewed product IDs (most recent first).
 */
export function getRecentProductIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'number' && !isNaN(id)) : [];
  } catch {
    return [];
  }
}

/**
 * Returns comma-separated recent product IDs formatted for query parameters.
 */
export function getRecentProductIdsParam(): string {
  const ids = getRecentProductIds();
  return ids.length > 0 ? ids.join(',') : '';
}

/* ─── Recommendation context (recs v3 & v3.1) ─────────────────── */
const VEHICLE_KEY = 'sokonimax_rec_vehicle_v1';
const HIDDEN_KEY = 'rec_hidden_ids';
const SEARCHES_KEY = 'sokonimax_recent_searches_v1';
const MAX_RECENT_SEARCHES = 10;

/** Remembers the last vehicle the user picked in search ("my garage"). Empty values are ignored. */
export function saveRecVehicle(vehicleId: string | number | null | undefined): void {
  try {
    const n = Number(vehicleId);
    if (vehicleId && Number.isInteger(n) && n > 0) {
      localStorage.setItem(VEHICLE_KEY, String(n));
    }
  } catch {
    // storage unavailable
  }
}

export function getSavedVehicleId(): number | null {
  try {
    const raw = localStorage.getItem(VEHICLE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Region chosen in the location picker (if any). */
export function getRecRegion(): string {
  try {
    const saved = localStorage.getItem('uzaspea_search_location_prefs');
    if (saved) {
      const prefs = JSON.parse(saved);
      if (prefs && typeof prefs.region === 'string') return prefs.region;
    }
  } catch {
    // ignore
  }
  return '';
}

/** Products dismissed via "Not interested" */
export function getHiddenProductIds(): number[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'number' && !isNaN(id)) : [];
  } catch {
    return [];
  }
}

export function hideProduct(productId: number): void {
  if (!productId || typeof productId !== 'number') return;
  try {
    const ids = getHiddenProductIds();
    if (!ids.includes(productId)) {
      ids.push(productId);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids.slice(-100)));
    }
  } catch {
    // ignore
  }
}

export function unhideProduct(productId: number): void {
  try {
    const ids = getHiddenProductIds().filter((id) => id !== productId);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

/** Search query history */
export function saveRecentSearchQuery(query: string): void {
  const q = (query || '').trim();
  if (!q || q.length < 2) return;
  try {
    const raw = localStorage.getItem(SEARCHES_KEY);
    let list: string[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list = list.filter((item) => item.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    if (list.length > MAX_RECENT_SEARCHES) list = list.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function getRecentSearchQueries(): string[] {
  try {
    const raw = localStorage.getItem(SEARCHES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Query params every recommendation request should send. */
export function getRecContextParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const recent = getRecentProductIdsParam();
  if (recent) params.recent_ids = recent;
  const vehicle = getSavedVehicleId();
  if (vehicle) params.vehicle_id = String(vehicle);
  const region = getRecRegion();
  if (region) params.region = region;
  const hidden = getHiddenProductIds();
  if (hidden.length > 0) params.exclude = hidden.slice(-50).join(',');
  return params;
}
