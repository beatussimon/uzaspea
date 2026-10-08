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
  parts?: string[];
}

export interface BaseVariantInfo {
  name: string;
  secondary: string | null;
  stock: number;
  image?: string | null;
}

export interface VariantDimension {
  index: number;
  label: string;
  values: string[];
  isVisual?: boolean;
}

const KNOWN_COLORS = new Set([
  'black', 'blue', 'red', 'white', 'green', 'yellow', 'silver', 'gold', 'gray', 'grey',
  'purple', 'orange', 'brown', 'pink', 'navy', 'titanium', 'invisible', 'chrome', 'beige',
  'bronze', 'graphite', 'emerald', 'sapphire', 'rose', 'midnight', 'starlight', 'natural',
  'charcoal', 'copper', 'platinum', 'cyan', 'magenta', 'maroon', 'teal', 'violet', 'amber'
]);

/**
 * Checks whether an attribute value contains a known visual color name.
 */
export function isColorValue(val: string): boolean {
  if (!val) return false;
  const words = val.trim().toLowerCase().split(/[\s/-]+/);
  return words.some(w => KNOWN_COLORS.has(w));
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
  // If it's a known color name (e.g. "Black", "Blue", "Invisible"), it's visual, not a pure spec
  if (isColorValue(v)) return false;
  // 1. Clothing sizes: S, M, L, XL, 42, 44, etc. and pure numbers (e.g. 64, 128, 256, 512, 1024)
  if (/^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|small|medium|large|one\s*size|os|\d{1,4}(\.\d)?(cm|mm|in|us|uk|eu|")?)$/i.test(v)) return true;
  // 2. Storage & RAM: 64gb, 128gb, 256gb, 512gb, 1tb, 8gb, 8gb ram, 16gb
  if (/^\d{1,4}\s*(gb|tb|mb)(\s*ram)?$/i.test(v) || /^\d{1,4}\s*ram$/i.test(v)) return true;
  // 3. Weights & Volumes: 500g, 1kg, 2.5kg, 5kg, 25kg, 1l, 5l, 500ml, 12pk, 24pk
  if (/^\d+(\.\d+)?\s*(kg|g|gm|l|ml|oz|lb|pcs|pk|pack)$/i.test(v)) return true;
  // 4. Placement & Position: left, right, front, rear, pair, driver, passenger
  if (/^(left|right|front|rear|pair|driver|passenger|set)$/i.test(v)) return true;
  // 5. Voltage & Power & Ports: 220v, 230v, 110v, 240v, type-c, usb-c, etc.
  if (/^(\d{1,4}\s*(v|volts?|w|watts?|hz|mah)|type-c|usb-c|regular)$/i.test(v)) return true;
  return false;
}

/**
 * Determines the dynamic label for the secondary spec dimension
 * (e.g. "Storage", "Weight / Size", "Placement", "Size", "Screen Size").
 */
export function getSecondaryDimensionLabel(
  sampleValue: string,
  categorySlug?: string,
  t?: (key: string, defaultText: string) => string
): string {
  const translate = t || ((_k: string, d: string) => d);
  const cat = (categorySlug || '').toLowerCase();
  const val = (sampleValue || '').trim().toLowerCase();

  // Storage check
  if (/^\d{1,4}\s*(gb|tb|mb|ram)$/i.test(val) || (/^\d{2,4}$/.test(val) && (cat.includes('phone') || cat.includes('computer') || cat.includes('laptop')))) {
    return translate('storage', 'Storage');
  }
  // TV / Monitor Screen Size
  if (cat.includes('tv') || cat.includes('display') || cat.includes('monitor')) {
    if (val.includes('"') || val.includes("'") || /^\d{2,3}$/.test(val)) {
      return translate('screen_size', 'Screen Size');
    }
    if (/^\d{2,4}\s*v?|type-c|usb|regular/i.test(val)) {
      return translate('voltage_port', 'Voltage / Plug');
    }
  }
  // General electronics fallback for Storage (preserving existing behavior where not TV)
  if (!cat.includes('tv') && !cat.includes('audio') && (cat.includes('electronic') || cat.includes('phone') || cat.includes('computer'))) {
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
 * Infers human-readable label and visual status for a specific dimension index.
 */
export function inferDimensionLabel(
  sampleValues: string[],
  dimIndex: number,
  totalDims: number,
  categorySlug?: string,
  categoryName?: string,
  t?: (key: string, defaultText: string) => string
): { label: string; isVisual: boolean } {
  const translate = t || ((_k: string, d: string) => d);
  const cat = `${categorySlug || ''} ${categoryName || ''}`.toLowerCase();
  
  const nonEmpties = sampleValues.filter(Boolean);
  const hasColors = nonEmpties.some(v => isColorValue(v));
  const hasStorage = nonEmpties.some(v => /^\d{1,4}\s*(gb|tb|mb)(\s*ram)?$/i.test(v.trim()));
  const hasWeight = nonEmpties.some(v => /^\d+(\.\d+)?\s*(kg|g|gm|l|ml|oz|lb|pcs|pk|pack)$/i.test(v.trim()));
  const hasPlacement = nonEmpties.some(v => /^(left|right|front|rear|pair|driver|passenger|set)$/i.test(v.trim().toLowerCase()));
  const hasVoltage = nonEmpties.some(v => /^(\d{2,4}\s*v?|type-c|usb|regular|\d{1,4}\s*w)/i.test(v.trim().toLowerCase()));
  const hasScreenInches = nonEmpties.some(v => /^\d{1,3}(\.\d)?(\s*("|''|in|inch|inches))?$/i.test(v.trim()) && (v.includes('"') || v.includes("'") || v.toLowerCase().includes('in')));
  const isPureNumbers = nonEmpties.every(v => /^\d{1,3}(\.\d)?$/.test(v.trim()));

  if (hasColors) {
    if (cat.includes('watch')) return { label: translate('dial_color', 'Color / Strap'), isVisual: true };
    if (cat.includes('furniture')) return { label: translate('finish_color', 'Color / Finish'), isVisual: true };
    if (cat.includes('tv') || cat.includes('display') || cat.includes('audio')) {
      return { label: translate('color_bezel', 'Color / Bezel'), isVisual: true };
    }
    return { label: translate('color_style', 'Color / Style'), isVisual: true };
  }

  if (hasScreenInches || (isPureNumbers && (cat.includes('tv') || cat.includes('display') || cat.includes('monitor')))) {
    return { label: translate('screen_size', 'Screen Size'), isVisual: false };
  }

  if (hasStorage || (isPureNumbers && (cat.includes('phone') || cat.includes('computer') || cat.includes('laptop') || cat.includes('tablet')))) {
    return { label: translate('storage', 'Storage'), isVisual: false };
  }

  if (hasVoltage && (cat.includes('tv') || cat.includes('audio') || cat.includes('electronic') || cat.includes('appliance'))) {
    return { label: translate('voltage_port', 'Voltage / Plug'), isVisual: false };
  }

  if (hasWeight || cat.includes('food') || cat.includes('grocer')) {
    return { label: translate('weight', 'Weight / Size'), isVisual: false };
  }

  if (hasPlacement || cat.includes('part') || cat.includes('vehicle')) {
    return { label: translate('placement', 'Placement'), isVisual: false };
  }

  // Dimension fallback
  if (totalDims > 1) {
    if (dimIndex === 0) return { label: translate('size', 'Size'), isVisual: false };
    if (dimIndex === 1 && !hasColors) return { label: translate('model_spec', 'Specification'), isVisual: false };
    return { label: translate(`dimension_${dimIndex + 1}`, `Option ${dimIndex + 1}`), isVisual: false };
  }

  return { label: translate('size', 'Size'), isVisual: false };
}

/**
 * Extracts all distinct dimensions from a list of variants.
 */
export function getVariantDimensions<T extends ProductVariantLike>(
  variants: T[],
  categorySlug?: string,
  categoryName?: string,
  t?: (key: string, defaultText: string) => string
): VariantDimension[] {
  if (!variants || variants.length === 0) return [];

  const allParts = variants.map(v => (v.name ? v.name.split('/').map(p => p.trim()) : []));
  const maxDims = Math.max(...allParts.map(p => p.length), 0);
  if (maxDims === 0) return [];

  const dimensions: VariantDimension[] = [];

  for (let d = 0; d < maxDims; d++) {
    const seen = new Set<string>();
    const values: string[] = [];

    allParts.forEach(parts => {
      const val = parts[d];
      if (val && !seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        values.push(val);
      }
    });

    if (values.length > 0) {
      const { label, isVisual } = inferDimensionLabel(values, d, maxDims, categorySlug, categoryName, t);
      dimensions.push({
        index: d,
        label,
        values,
        isVisual: isVisual || (d === 0 && values.some(v => isColorValue(v))),
      });
    }
  }

  return dimensions;
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
 * Parses all variants into structured { variant, primary, secondary, parts }.
 */
export function parseVariants<T extends ProductVariantLike>(variants: T[]): ParsedVariant<T>[] {
  return variants.map(v => {
    const parts = v.name ? v.name.split('/').map(p => p.trim()) : [];
    let primary = parts[0] || v.name || '';
    let secondary: string | null = parts.length > 1 ? parts[parts.length - 1] : null;

    if (parts.length === 1 && isSpecValue(parts[0])) {
      primary = '';
      secondary = normalizeSizeLabel(parts[0]);
    } else if (parts.length === 2) {
      if (isColorValue(parts[1]) && !isColorValue(parts[0])) {
        // e.g. "Front Axle Pair / Brembo Racing Red" -> primary is Brembo Racing Red!
        primary = parts[1];
        secondary = normalizeSizeLabel(parts[0]);
      } else {
        primary = parts[0];
        secondary = normalizeSizeLabel(parts[1]);
      }
    } else if (parts.length >= 3) {
      // 3+ dimension case: e.g. "50 / Black / 220"
      // If a middle part has color, preserve primary as the color part so visual shelf works!
      const colorPart = parts.find(p => isColorValue(p));
      if (colorPart) {
        primary = colorPart;
      }
    }

    const result: ParsedVariant<T> = {
      variant: v,
      primary,
      secondary,
    };
    if (parts.length > 2) {
      result.parts = parts;
    }

    return result;
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
    const match = parsedVariants.find(pv => pv.secondary === specVal || (pv.parts && pv.parts.includes(specVal)));
    return match ? match.variant.stock : 0;
  }

  const key = activePrimaryName.toLowerCase();
  const isCurrentBase = baseVariantInfo && baseVariantInfo.name.toLowerCase() === key;
  if (isCurrentBase && baseVariantInfo.secondary === specVal) {
    return baseVariantInfo.stock;
  }

  const match = parsedVariants.find(
    pv => pv.primary.toLowerCase() === key && (pv.secondary === specVal || (pv.parts && pv.parts.includes(specVal)))
  );
  return match ? match.variant.stock : 0;
}
