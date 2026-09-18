/**
 * Zero-Overhead Client-Side View Tracking
 *
 * Maintains a compact ring-buffer of recently viewed product IDs in localStorage.
 * Avoids any server database writes while giving the recommendation engine
 * instant context on user affinity and interest.
 */

const STORAGE_KEY = 'sokonimax_recent_views_v1';
const MAX_RECENT_ITEMS = 10;

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
