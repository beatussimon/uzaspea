/**
 * Global API Cache (Stale-While-Revalidate)
 * This lives outside the React component lifecycle to persist data across route changes.
 */

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<unknown>> = {};
const STALE_MS = 60 * 1000; // 60 seconds

export const apiCache = {
  /**
   * Retrieves data from the cache.
   * @param key The unique cache key (e.g., stringified params)
   * @returns An object containing the data and a boolean indicating if it's stale, or null if not found.
   */
  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = cache[key];
    if (!entry) return null;
    return {
      data: entry.data as T,
      isStale: Date.now() - entry.timestamp > STALE_MS,
    };
  },

  /**
   * Stores data in the cache.
   * @param key The unique cache key.
   * @param data The data to store.
   */
  set<T>(key: string, data: T) {
    cache[key] = {
      data,
      timestamp: Date.now(),
    };
  },

  /**
   * Invalidates a specific cache entry.
   * @param key The unique cache key.
   */
  invalidate(key: string) {
    delete cache[key];
  },

  /**
   * Clears the entire cache.
   */
  clear() {
    Object.keys(cache).forEach((k) => delete cache[k]);
  },
};
