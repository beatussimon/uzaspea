import { describe, it, expect } from 'vitest';
import {
  normalizeSizeLabel,
  isSpecValue,
  getSecondaryDimensionLabel,
  getPrimaryDimensionLabel,
  resolveBaseVariantName,
  resolveBaseVariantSpec,
  parseVariants,
  computeVariantStock,
  getVariantDimensions,
  ProductVariantLike,
} from './variantUtils';

describe('variantUtils', () => {
  describe('normalizeSizeLabel', () => {
    it('normalizes common size aliases to standard abbreviations', () => {
      expect(normalizeSizeLabel('small')).toBe('S');
      expect(normalizeSizeLabel('s')).toBe('S');
      expect(normalizeSizeLabel('medium')).toBe('M');
      expect(normalizeSizeLabel('m')).toBe('M');
      expect(normalizeSizeLabel('large')).toBe('L');
      expect(normalizeSizeLabel('l')).toBe('L');
      expect(normalizeSizeLabel('extra large')).toBe('XL');
      expect(normalizeSizeLabel('xl')).toBe('XL');
      expect(normalizeSizeLabel('xxl')).toBe('XXL');
      expect(normalizeSizeLabel('2xl')).toBe('XXL');
      expect(normalizeSizeLabel('3xl')).toBe('3XL');
    });

    it('preserves non-alias values and trims whitespace', () => {
      expect(normalizeSizeLabel(' 256GB ')).toBe('256GB');
      expect(normalizeSizeLabel(' 5kg ')).toBe('5kg');
      expect(normalizeSizeLabel(' Left ')).toBe('Left');
      expect(normalizeSizeLabel('')).toBe('');
    });
  });

  describe('isSpecValue', () => {
    it('identifies clothing sizes as specifications', () => {
      expect(isSpecValue('S')).toBe(true);
      expect(isSpecValue('M')).toBe(true);
      expect(isSpecValue('XL')).toBe(true);
      expect(isSpecValue('XXL')).toBe(true);
      expect(isSpecValue('42')).toBe(true);
      expect(isSpecValue('One Size')).toBe(true);
      expect(isSpecValue('OS')).toBe(true);
    });

    it('identifies storage and RAM as specifications', () => {
      expect(isSpecValue('64GB')).toBe(true);
      expect(isSpecValue('128GB')).toBe(true);
      expect(isSpecValue('256GB')).toBe(true);
      expect(isSpecValue('512GB')).toBe(true);
      expect(isSpecValue('1TB')).toBe(true);
      expect(isSpecValue('8GB RAM')).toBe(true);
    });

    it('identifies weights and volumes as specifications', () => {
      expect(isSpecValue('500g')).toBe(true);
      expect(isSpecValue('1kg')).toBe(true);
      expect(isSpecValue('2.5kg')).toBe(true);
      expect(isSpecValue('5kg')).toBe(true);
      expect(isSpecValue('25kg')).toBe(true);
      expect(isSpecValue('1L')).toBe(true);
      expect(isSpecValue('500ml')).toBe(true);
      expect(isSpecValue('12pk')).toBe(true);
    });

    it('identifies vehicle/part placements as specifications', () => {
      expect(isSpecValue('Left')).toBe(true);
      expect(isSpecValue('Right')).toBe(true);
      expect(isSpecValue('Front')).toBe(true);
      expect(isSpecValue('Rear')).toBe(true);
      expect(isSpecValue('Pair')).toBe(true);
    });

    it('returns false for visual attributes like colors and styles', () => {
      expect(isSpecValue('Black')).toBe(false);
      expect(isSpecValue('Blue Titanium')).toBe(false);
      expect(isSpecValue('Red')).toBe(false);
      expect(isSpecValue('Solid Oak')).toBe(false);
      expect(isSpecValue('Matte Black')).toBe(false);
    });
  });

  describe('getSecondaryDimensionLabel', () => {
    it('labels electronics specifications as Storage', () => {
      expect(getSecondaryDimensionLabel('128GB', 'electronics-mobile-phones')).toBe('Storage');
      expect(getSecondaryDimensionLabel('256GB', 'electronics-computers-laptops')).toBe('Storage');
    });

    it('labels food and grocery specifications as Weight / Size', () => {
      expect(getSecondaryDimensionLabel('1kg', 'food-groceries')).toBe('Weight / Size');
      expect(getSecondaryDimensionLabel('500g', 'supermarket')).toBe('Weight / Size');
    });

    it('labels vehicle parts as Placement', () => {
      expect(getSecondaryDimensionLabel('Left', 'vehicles-vehicle-parts-accessories')).toBe('Placement');
      expect(getSecondaryDimensionLabel('Pair', 'auto-parts')).toBe('Placement');
    });

    it('defaults fashion and other categories to Size', () => {
      expect(getSecondaryDimensionLabel('M', 'mens-fashion-clothing')).toBe('Size');
      expect(getSecondaryDimensionLabel('42', 'womens-fashion-shoes')).toBe('Size');
    });
  });

  describe('getPrimaryDimensionLabel', () => {
    it('labels watches as Color / Strap', () => {
      expect(getPrimaryDimensionLabel('mens-fashion-watches')).toBe('Color / Strap');
    });

    it('labels furniture as Color / Finish', () => {
      expect(getPrimaryDimensionLabel('home-furniture')).toBe('Color / Finish');
    });

    it('labels general items as Color / Style', () => {
      expect(getPrimaryDimensionLabel('mens-fashion')).toBe('Color / Style');
      expect(getPrimaryDimensionLabel('electronics-mobile-phones')).toBe('Color / Style');
    });
  });

  describe('resolveBaseVariantName and resolveBaseVariantSpec', () => {
    it('extracts color from structured_specs', () => {
      const product = {
        name: 'Cotton T-Shirt',
        structured_specs: { Color: 'Navy' },
      };
      expect(resolveBaseVariantName(product)).toBe('Navy');
    });

    it('extracts color from product title if not in specs', () => {
      const product = {
        name: 'iPhone 15 Pro Max Titanium Blue',
        structured_specs: {},
      };
      expect(resolveBaseVariantName(product)).toBe('Blue');
    });

    it('extracts placement for auto parts', () => {
      const product = {
        name: 'Brake Caliper Front',
        structured_specs: { Placement: 'Front' },
      };
      expect(resolveBaseVariantName(product)).toBe('Front');
    });

    it('falls back to Standard if no attributes or title colors exist', () => {
      const product = {
        name: 'Universal USB Cable',
        structured_specs: {},
      };
      expect(resolveBaseVariantName(product)).toBe('Standard');
    });

    it('resolves base secondary spec from structured_specs', () => {
      expect(resolveBaseVariantSpec({ structured_specs: { 'Clothing Size': 'Large' } })).toBe('L');
      expect(resolveBaseVariantSpec({ structured_specs: { Size: 'Medium' } })).toBe('M');
      expect(resolveBaseVariantSpec({ structured_specs: { Storage: '128GB' } })).toBe('128GB');
      expect(resolveBaseVariantSpec({ structured_specs: { storage_internal: '256GB' } })).toBe('256GB');
      expect(resolveBaseVariantSpec({ structured_specs: { 'Weight / Pack Size': '5kg' } })).toBe('5kg');
      expect(resolveBaseVariantSpec({})).toBe(null);
    });
  });

  describe('parseVariants', () => {
    it('correctly separates 2-tier attributes (e.g. Color / Size)', () => {
      const input: ProductVariantLike[] = [
        { id: 1, name: 'Black / M', stock: 10 },
        { id: 2, name: 'Black / L', stock: 5 },
        { id: 3, name: 'Navy / M', stock: 8 },
      ];
      const parsed = parseVariants(input);
      expect(parsed).toEqual([
        { variant: input[0], primary: 'Black', secondary: 'M' },
        { variant: input[1], primary: 'Black', secondary: 'L' },
        { variant: input[2], primary: 'Navy', secondary: 'M' },
      ]);
    });

    it('correctly handles pure 1-dimensional specs (e.g. food weights, sizes)', () => {
      const input: ProductVariantLike[] = [
        { id: 10, name: '500g', stock: 20 },
        { id: 11, name: '1kg', stock: 15 },
        { id: 12, name: '5kg', stock: 0 },
      ];
      const parsed = parseVariants(input);
      expect(parsed).toEqual([
        { variant: input[0], primary: '', secondary: '500g' },
        { variant: input[1], primary: '', secondary: '1kg' },
        { variant: input[2], primary: '', secondary: '5kg' },
      ]);
    });
  });

  describe('computeVariantStock & Cross-Color Integrity (No Jumping Bug)', () => {
    const variants: ProductVariantLike[] = [
      { id: 1, name: 'Black / S', stock: 10 },
      { id: 2, name: 'Black / M', stock: 0 }, // Out of stock
      // Black does not have L!
      { id: 3, name: 'Blue / M', stock: 12 },
      { id: 4, name: 'Blue / L', stock: 4 },
    ];
    const parsed = parseVariants(variants);

    it('returns exact stock for available combination', () => {
      expect(computeVariantStock(parsed, 'Black', 'S')).toBe(10);
      expect(computeVariantStock(parsed, 'Blue', 'M')).toBe(12);
      expect(computeVariantStock(parsed, 'Blue', 'L')).toBe(4);
    });

    it('returns 0 for out-of-stock combination', () => {
      expect(computeVariantStock(parsed, 'Black', 'M')).toBe(0);
    });

    it('prevents jumping bug: returns 0 when active color does not have that size', () => {
      // Blue has L, but Black DOES NOT have L.
      // In the old system, clicking L would find Blue / L and jump colors!
      // Here, looking up L for Black returns 0 stock, preserving Black selection.
      expect(computeVariantStock(parsed, 'Black', 'L')).toBe(0);
    });

    it('integrates base product stock seamlessly', () => {
      const baseProductInfo = {
        name: 'Black',
        secondary: 'XL',
        stock: 7,
      };
      // Base product has Black / XL with stock 7
      expect(computeVariantStock(parsed, 'Black', 'XL', baseProductInfo)).toBe(7);
      // But Blue does not have XL
      expect(computeVariantStock(parsed, 'Blue', 'XL', baseProductInfo)).toBe(0);
    });

    it('calculates stock in pure spec mode', () => {
      const pureVariants: ProductVariantLike[] = [
        { id: 21, name: '1kg', stock: 50 },
        { id: 22, name: '5kg', stock: 20 },
      ];
      const parsedPure = parseVariants(pureVariants);
      const baseFood = {
        name: 'Standard',
        secondary: '500g',
        stock: 100,
      };

      expect(computeVariantStock(parsedPure, '', '500g', baseFood, true)).toBe(100);
      expect(computeVariantStock(parsedPure, '', '1kg', baseFood, true)).toBe(50);
      expect(computeVariantStock(parsedPure, '', '5kg', baseFood, true)).toBe(20);
      expect(computeVariantStock(parsedPure, '', '25kg', baseFood, true)).toBe(0);
    });
  });

  describe('multi-dimensional variants', () => {
    const tvVariants: ProductVariantLike[] = [
      { id: 1, name: '50 / Black / 220', stock: 4 },
      { id: 2, name: '50 / Invisible / 230', stock: 4 },
      { id: 3, name: '55 / Blue / Type-c', stock: 0 },
      { id: 4, name: '65 / Red / 230 Regular', stock: 2 },
    ];

    it('extracts all dimensions accurately', () => {
      const dims = getVariantDimensions(tvVariants, 'electronics-tvs-audio');
      expect(dims.length).toBe(3);
      expect(dims[0].label).toBe('Screen Size');
      expect(dims[0].values).toEqual(['50', '55', '65']);
      expect(dims[1].label).toBe('Color / Bezel');
      expect(dims[1].values).toEqual(['Black', 'Invisible', 'Blue', 'Red']);
      expect(dims[1].isVisual).toBe(true);
      expect(dims[2].label).toBe('Voltage / Plug');
      expect(dims[2].values).toEqual(['220', '230', 'Type-c', '230 Regular']);
    });

    it('preserves parts on ParsedVariant for 3-part variants', () => {
      const parsed = parseVariants(tvVariants);
      expect(parsed[0].parts).toEqual(['50', 'Black', '220']);
      expect(parsed[0].primary).toBe('Black');
    });
  });
});
