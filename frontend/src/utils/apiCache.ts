/**
 * Global API Cache (Stale-While-Revalidate with sessionStorage persistence)
 * Persists high-frequency catalog data across route changes and browser refreshes.
 */

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<unknown>> = {};
const STALE_MS = 60 * 1000; // 60s stale-while-revalidate
const MAX_SESSION_ENTRIES = 15; // Max 15 LRU entries in sessionStorage (~150KB)
const STORAGE_PREFIX = 'uzaspea_cache_';
const INDEX_KEY = 'uzaspea_cache_index';

// Helper to safely get the stored index of keys
const getSessionIndex = (): string[] => {
  try {
    const raw = sessionStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveSessionIndex = (keys: string[]) => {
  try {
    sessionStorage.setItem(INDEX_KEY, JSON.stringify(keys));
  } catch {}
};

// Hydrate from sessionStorage once on module load
try {
  const index = getSessionIndex();
  index.forEach((key) => {
    const item = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (item) {
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          cache[key] = parsed;
        } else {
          sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        }
      } catch {}
    }
  });
} catch {}

/**
 * Checks if device/network conditions allow background prefetching.
 * Returns false if the user has Data Saver enabled or is on a 2G/slow connection.
 */
export const canPrefetch = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = (navigator as any).connection;
  if (conn) {
    if (conn.saveData) return false;
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return false;
  }
  return true;
};

export const apiCache = {
  /**
   * Retrieves data from the cache (memory first, then sessionStorage fallback).
   */
  get<T>(key: string): { data: T; isStale: boolean } | null {
    let entry = cache[key];
    if (!entry) {
      try {
        const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            entry = parsed;
            cache[key] = parsed;
          }
        }
      } catch {}
    }

    if (!entry) return null;
    return {
      data: entry.data as T,
      isStale: Date.now() - entry.timestamp > STALE_MS,
    };
  },

  /**
   * Stores data in the cache (memory + LRU sessionStorage for catalog keys).
   */
  set<T>(key: string, data: T) {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    cache[key] = entry as CacheEntry<unknown>;

    // Persist catalog listing keys to sessionStorage safely
    if (key.startsWith('products:') || key.startsWith('recommendations:') || key.startsWith('sponsored:')) {
      try {
        const keys = getSessionIndex().filter((k) => k !== key);
        keys.unshift(key);

        // Prune old entries beyond limit
        while (keys.length > MAX_SESSION_ENTRIES) {
          const evicted = keys.pop();
          if (evicted) sessionStorage.removeItem(`${STORAGE_PREFIX}${evicted}`);
        }

        saveSessionIndex(keys);
        sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
      } catch {
        // Quota exceeded or private browsing: gracefully fail without error
      }
    }
  },

  /**
   * Invalidates a specific cache entry.
   */
  invalidate(key: string) {
    delete cache[key];
    try {
      sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      const keys = getSessionIndex().filter((k) => k !== key);
      saveSessionIndex(keys);
    } catch {}
  },

  /**
   * Clears the entire cache.
   */
  clear() {
    Object.keys(cache).forEach((k) => delete cache[k]);
    try {
      const keys = getSessionIndex();
      keys.forEach((k) => sessionStorage.removeItem(`${STORAGE_PREFIX}${k}`));
      sessionStorage.removeItem(INDEX_KEY);
    } catch {}
  },
};
