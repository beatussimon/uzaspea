/**
 * Centralized High-Performance Product Cache (LRU + SWR + SessionStorage)
 *
 * Designed for resource-constrained environments to achieve instant (0ms)
 * navigation transitions and zero-overhead repeat views.
 */

import api from '../api';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const MAX_MEMORY_ITEMS = 60;
const FRESHNESS_TTL_MS = 30 * 1000; // 30s fresh before background revalidation
const SESSION_STORAGE_KEY = 'uzaspea_prod_cache_v1';
const MAX_SESSION_ITEMS = 25;

// In-memory LRU map
export const productCache: Record<string, CacheEntry> = {};
export const productPromises: Record<string, Promise<any>> = {};

// Track access order for LRU eviction
const accessOrder: string[] = [];

function touchKey(key: string) {
  const idx = accessOrder.indexOf(key);
  if (idx !== -1) {
    accessOrder.splice(idx, 1);
  }
  accessOrder.push(key);

  // Evict oldest if exceeding capacity
  if (accessOrder.length > MAX_MEMORY_ITEMS) {
    const oldest = accessOrder.shift();
    if (oldest) {
      delete productCache[oldest];
      delete productPromises[oldest];
    }
  }
}

/**
 * Reads from sessionStorage fallback if not in memory
 */
function readSessionCache(key: string): any | null {
  try {
    const raw = sessionStorage.getItem(`${SESSION_STORAGE_KEY}_${key}`);
    if (raw) {
      const parsed: CacheEntry = JSON.parse(raw);
      // Valid for up to 10 minutes in sessionStorage
      if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
        return parsed.data;
      }
    }
  } catch {}
  return null;
}

/**
 * Saves to sessionStorage with LRU index tracking
 */
function writeSessionCache(key: string, data: any) {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    sessionStorage.setItem(`${SESSION_STORAGE_KEY}_${key}`, JSON.stringify(entry));

    // Keep session storage bounded
    const indexRaw = sessionStorage.getItem(`${SESSION_STORAGE_KEY}_index`);
    let keys: string[] = indexRaw ? JSON.parse(indexRaw) : [];
    keys = keys.filter(k => k !== key);
    keys.push(key);

    if (keys.length > MAX_SESSION_ITEMS) {
      const removed = keys.shift();
      if (removed) {
        sessionStorage.removeItem(`${SESSION_STORAGE_KEY}_${removed}`);
      }
    }
    sessionStorage.setItem(`${SESSION_STORAGE_KEY}_index`, JSON.stringify(keys));
  } catch {}
}

/**
 * Synchronously retrieves a cached product (or preview) by slug or ID
 */
export function getCachedProduct(slugOrId: string | number): any | null {
  if (!slugOrId) return null;
  const key = String(slugOrId);

  // 1. Check in-memory LRU
  if (productCache[key]) {
    touchKey(key);
    return productCache[key].data;
  }

  // 2. Check sessionStorage
  const sessionData = readSessionCache(key);
  if (sessionData) {
    productCache[key] = { data: sessionData, timestamp: Date.now() };
    touchKey(key);
    return sessionData;
  }

  return null;
}

/**
 * Explicitly caches a product into memory and sessionStorage
 */
export function setCachedProduct(slugOrId: string | number, data: any) {
  if (!slugOrId || !data) return;
  const key = String(slugOrId);
  const entry: CacheEntry = { data, timestamp: Date.now() };

  productCache[key] = entry;
  touchKey(key);

  // Also cache by ID if given a slug with an ID or vice-versa
  if (data.id && String(data.id) !== key) {
    productCache[String(data.id)] = entry;
    touchKey(String(data.id));
  }
  if (data.slug && data.slug !== key) {
    productCache[data.slug] = entry;
    touchKey(data.slug);
  }

  writeSessionCache(key, data);
}

/**
 * Mass pre-seeds multiple products (e.g. from similar products list or search results).
 * Ensures subsequent clicks on these items are INSTANT (0ms) cache hits.
 */
export function seedProductsCache(products: any[]) {
  if (!Array.isArray(products) || products.length === 0) return;
  const now = Date.now();

  products.forEach(p => {
    if (!p) return;
    const entry: CacheEntry = { data: p, timestamp: now };
    if (p.slug) {
      productCache[p.slug] = entry;
      touchKey(p.slug);
    }
    if (p.id) {
      productCache[String(p.id)] = entry;
      touchKey(String(p.id));
    }
  });
}

/**
 * Invalidates a specific product or the entire cache
 */
export function invalidateProductCache(slugOrId?: string | number) {
  if (slugOrId) {
    const key = String(slugOrId);
    delete productCache[key];
    delete productPromises[key];
    try { sessionStorage.removeItem(`${SESSION_STORAGE_KEY}_${key}`); } catch {}
  } else {
    Object.keys(productCache).forEach(k => delete productCache[k]);
    Object.keys(productPromises).forEach(k => delete productPromises[k]);
  }
}

/**
 * High-performance Stale-While-Revalidate fetcher for product detail
 */
export function fetchProductCached(slug: string, forceFresh = false): Promise<{ data: any; isFromCache?: boolean }> {
  const now = Date.now();
  const key = String(slug);

  // 1. Fresh cache hit (< 30s)
  if (!forceFresh && productCache[key] && (now - productCache[key].timestamp < FRESHNESS_TTL_MS)) {
    touchKey(key);
    return Promise.resolve({ data: productCache[key].data, isFromCache: true });
  }

  // 2. Ongoing request deduplication
  if (!forceFresh && productPromises[key] !== undefined) {
    return productPromises[key];
  }

  // 3. Network fetch with background caching & pre-seeding
  const promise = api.get(`/api/products/${slug}/`)
    .then(res => {
      const prodData = res.data;
      setCachedProduct(slug, prodData);

      // Pre-seed any preloaded similar products into the cache immediately
      if (Array.isArray(prodData?.similar_products) && prodData.similar_products.length > 0) {
        seedProductsCache(prodData.similar_products);
      }

      delete productPromises[key];
      return { data: prodData, isFromCache: false };
    })
    .catch(err => {
      delete productPromises[key];
      // If network fails but we have stale cached data, fall back to it
      if (productCache[key]?.data) {
        return { data: productCache[key].data, isFromCache: true };
      }
      throw err;
    });

  productPromises[key] = promise;
  return promise;
}
