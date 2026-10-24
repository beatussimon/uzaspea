import { describe, it, expect, beforeEach } from 'vitest';
import { setCachedProduct, getCachedProduct, seedProductsCache, invalidateProductCache } from './productCache';

describe('productCache with Slug + UUID', () => {
  beforeEach(() => {
    invalidateProductCache();
  });

  it('indexes product by id, slug, url_slug, and public_id', () => {
    const mockProduct = {
      id: 439,
      name: 'Handcrafted Driving Loafers',
      slug: 'handcrafted-driving-loafers',
      public_id: 'd3798cffae72',
      url_slug: 'handcrafted-driving-loafers-d3798cffae72',
      price: '420000.00'
    };

    setCachedProduct(mockProduct.url_slug, mockProduct);

    // Retrieve by canonical url_slug
    expect(getCachedProduct('handcrafted-driving-loafers-d3798cffae72')).toEqual(mockProduct);
    // Retrieve by standalone public_id
    expect(getCachedProduct('d3798cffae72')).toEqual(mockProduct);
    // Retrieve by legacy slug
    expect(getCachedProduct('handcrafted-driving-loafers')).toEqual(mockProduct);
    // Retrieve by id
    expect(getCachedProduct(439)).toEqual(mockProduct);
  });

  it('pre-seeds product cards with url_slug and public_id', () => {
    const cards = [
      {
        id: 101,
        name: 'Oil Filter',
        slug: 'oil-filter',
        public_id: 'a1b2c3d4e5f6',
        url_slug: 'oil-filter-a1b2c3d4e5f6'
      }
    ];

    seedProductsCache(cards);

    // Should resolve by url_slug immediately
    const cached = getCachedProduct('oil-filter-a1b2c3d4e5f6');
    expect(cached).toBeTruthy();
    expect(cached?.name).toBe('Oil Filter');
    expect(cached?._partial).toBe(true);

    // Also resolves by public_id
    const cachedByPid = getCachedProduct('a1b2c3d4e5f6');
    expect(cachedByPid).toBeTruthy();
    expect(cachedByPid?.id).toBe(101);
  });
});
