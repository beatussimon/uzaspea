export interface ProductVariantLike {
  id: number;
  name: string;
  price_adjustment?: string;
  stock: number;
  is_available?: boolean;
  image?: string | null;
}

export interface ParsedVariant<T extends ProductVariantLike = ProductVariantLike> {
  variant: T;
  primary: string;
  secondary: string | null;
}

export interface BaseVariantInfo {
  name: string;
  secondary: string | null;
  stock: number;
  image?: string | null;
}

/**
 * Normalizes size representations (e.g., 'Medium' -> 'M', 'Extra Large' -> 'XL').
 */
export function normalizeSizeLabel(raw: string): string {
  if (!raw) return '';
  const lower = raw.trim().toLowerCase();
  if (lower === 'small' || lower === 's') return 'S';
  if (lower === 'medium' || lower === 'm') return 'M';
  if (lower === 'large' || lower === 'l') return 'L';
  if (lower === 'extra large' || lower === 'xl') return 'XL';
  if (lower === 'xxl' || lower === '2xl') return 'XXL';
  if (lower === '3xl' || lower === 'xxxl') return '3XL';
  return raw.trim();
}

/**
 * Recognizes whether an attribute value is a non-visual specification
 * (Clothing sizes, Storage / RAM, Weights / Volumes, Placement / Position).
 */
export function isSpecValue(val: string): boolean {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  // 1. Clothing sizes: S, M, L, XL, 42, 44, etc. and pure numbers (e.g. 64, 128, 256, 512, 1024)
  if (/^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|small|medium|large|one\s*size|os|\d{1,4}(\.\d)?(cm|mm|in|us|uk|eu)?)$/i.test(v)) return true;
  // 2. Storage & RAM: 64gb, 128gb, 256gb, 512gb, 1tb, 8gb, 8gb ram, 16gb
  if (/^\d{1,4}\s*(gb|tb|mb)(\s*ram)?$/i.test(v) || /^\d{1,4}\s*ram$/i.test(v)) return true;
  // 3. Weights & Volumes: 500g, 1kg, 2.5kg, 5kg, 25kg, 1l, 5l, 500ml, 12pk, 24pk
  if (/^\d+(\.\d+)?\s*(kg|g|gm|l|ml|oz|lb|pcs|pk|pack)$/i.test(v)) return true;
  // 4. Placement & Position: left, right, front, rear, pair, driver, passenger
  if (/^(left|right|front|rear|pair|driver|passenger|set)$/i.test(v)) return true;
  return false;
}

/**
 * Determines the dynamic label for the secondary spec dimension
 * (e.g. "Storage", "Weight / Size", "Placement", "Size").
 */
export function getSecondaryDimensionLabel(
  sampleValue: string,
  categorySlug?: string,
  t?: (key: string, defaultText: string) => string
): string {
  const translate = t || ((_k: string, d: string) => d);
  const cat = (categorySlug || '').toLowerCase();
  const val = (sampleValue || '').trim().toLowerCase();

  if (/^\d{1,4}\s*(gb|tb|mb|ram)$/i.test(val) || (/^\d{2,4}$/.test(val) && (cat.includes('electronic') || cat.includes('phone') || cat.includes('computer'))) || cat.includes('electronic') || cat.includes('phone') || cat.includes('computer')) {
    return translate('storage', 'Storage');
  }
  if (/^\d+(\.\d+)?\s*(kg|g|gm|l|ml|oz|lb|pcs|pk|pack)$/i.test(val) || cat.includes('food') || cat.includes('grocer')) {
    return translate('weight', 'Weight / Size');
  }
  if (/^(left|right|front|rear|pair|driver|passenger|set)$/i.test(val) || cat.includes('part') || cat.includes('vehicle')) {
    return translate('placement', 'Placement');
  }
  return translate('size', 'Size');
}

/**
 * Determines the dynamic label for the primary dimension
 * (e.g. "Color / Style", "Color / Finish", "Color / Strap").
 */
export function getPrimaryDimensionLabel(
  categorySlug?: string,
  categoryName?: string,
  t?: (key: string, defaultText: string) => string
): string {
  const translate = t || ((_k: string, d: string) => d);
  const cat = `${categorySlug || ''} ${categoryName || ''}`.toLowerCase();
  if (cat.includes('watch')) return translate('dial_color', 'Color / Strap');
  if (cat.includes('furniture')) return translate('finish_color', 'Color / Finish');
  return translate('color_style', 'Color / Style');
}

/**
 * Resolves a meaningful name for the base product (never generic "Standard" if attributes or title indicate a color/style).
 */
export function resolveBaseVariantName(
  product: any,
  t?: (key: string, defaultText: string) => string
): string {
  const translate = t || ((_k: string, d: string) => d);
  if (!product) return translate('standard_variant', 'Standard');
  const specs = product.structured_specs || product.specifications || {};
  if (specs.Color || specs.color) return String(specs.Color || specs.color);
  if (specs.Placement || specs.placement) return String(specs.Placement || specs.placement);
  if (specs.Storage || specs.storage) return String(specs.Storage || specs.storage);
  if (specs.Weight || specs.weight) return String(specs.Weight || specs.weight);
  if (specs['Material / Finish']) return String(specs['Material / Finish']);

  const title = (product.name || '').toLowerCase();
  const knownColors = ['black', 'blue', 'gray', 'grey', 'red', 'white', 'green', 'yellow', 'silver', 'gold', 'purple', 'navy', 'brown', 'pink', 'orange'];
  for (const c of knownColors) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(title)) {
      return c.charAt(0).toUpperCase() + c.slice(1);
    }
  }
  return translate('standard_variant', 'Standard');
}

/**
 * Resolves secondary specification for the base product from structured specs or model fields.
 * Excludes delivery package shipping tier (`product.size` which is 'small'/'medium'/'large').
 */
export function resolveBaseVariantSpec(product: any): string | null {
  if (!product) return null;
  const specs = product.structured_specs || product.specifications || {};
  const rawSpec = specs.Size || specs.size || specs['Clothing Size'] || specs['Shoe Size'] || specs['Storage Capacity'] || specs.Storage || specs.storage || specs.storage_internal || specs['Weight / Pack Size'] || specs.Weight || specs.weight || specs.Placement || specs.placement;
  return rawSpec ? normalizeSizeLabel(String(rawSpec)) : null;
}

/**
 * Parses all variants into structured { variant, primary, secondary }.
 */
export function parseVariants<T extends ProductVariantLike>(variants: T[]): ParsedVariant<T>[] {
  return variants.map(v => {
    const parts = v.name ? v.name.split('/').map(p => p.trim()) : [];
    let primary = parts[0] || v.name || '';
    let secondary: string | null = parts.length > 1 ? parts[parts.length - 1] : null;

    // If single part but is a spec (e.g. "5kg", "256GB", "M"), treat as secondary spec directly
    if (parts.length === 1 && isSpecValue(parts[0])) {
      primary = '';
      secondary = normalizeSizeLabel(parts[0]);
    } else if (secondary) {
      secondary = normalizeSizeLabel(secondary);
    }

    return {
      variant: v,
      primary,
      secondary,
    };
  });
}

/**
 * Calculates stock for a given secondary option under the currently active primary visual choice,
 * or across the pure spec list. Ensures cross-color integrity (no color jumping).
 */
export function computeVariantStock(
  parsedVariants: ParsedVariant[],
  activePrimaryName: string,
  specVal: string,
  baseVariantInfo?: BaseVariantInfo | null,
  isPureSpecVariantList = false
): number {
  if (isPureSpecVariantList) {
    if (baseVariantInfo && baseVariantInfo.secondary === specVal) {
      return baseVariantInfo.stock;
    }
    const match = parsedVariants.find(pv => pv.secondary === specVal);
    return match ? match.variant.stock : 0;
  }

  const key = activePrimaryName.toLowerCase();
  const isCurrentBase = baseVariantInfo && baseVariantInfo.name.toLowerCase() === key;
  if (isCurrentBase && baseVariantInfo.secondary === specVal) {
    return baseVariantInfo.stock;
  }

  const match = parsedVariants.find(
    pv => pv.primary.toLowerCase() === key && pv.secondary === specVal
  );
  return match ? match.variant.stock : 0;
}
