// Address and Country Delivery Management Service

export interface CountryInfo {
  code: string;       // ISO 2-letter code e.g. 'TZ'
  name: string;       // e.g. 'Tanzania'
  dialCode: string;   // e.g. '+255'
  flag: string;       // emoji flag e.g. '🇹🇿'
  placeholder: string;// e.g. '7XX XXX XXX'
  digitCount: number; // expected local phone digits (e.g. 9 for Tanzania)
}

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿', placeholder: '7XX XXX XXX', digitCount: 9 },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', placeholder: '7XX XXX XXX', digitCount: 9 },
  { code: 'UG', name: 'Uganda', dialCode: '+256', flag: '🇺🇬', placeholder: '7XX XXX XXX', digitCount: 9 },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', flag: '🇷🇼', placeholder: '7XX XXX XXX', digitCount: 9 },
  { code: 'BI', name: 'Burundi', dialCode: '+257', flag: '🇧🇮', placeholder: '7X XXX XXX', digitCount: 8 },
  { code: 'CD', name: 'DR Congo', dialCode: '+243', flag: '🇨🇩', placeholder: '8XX XXX XXX', digitCount: 9 },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', placeholder: '7X XXX XXXX', digitCount: 9 },
  { code: 'ZM', name: 'Zambia', dialCode: '+260', flag: '🇿🇲', placeholder: '9XX XXX XXX', digitCount: 9 },
  { code: 'MW', name: 'Malawi', dialCode: '+265', flag: '🇲🇼', placeholder: '8XX XXX XXX', digitCount: 9 },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258', flag: '🇲🇿', placeholder: '8X XXX XXXX', digitCount: 9 },
  { code: 'SS', name: 'South Sudan', dialCode: '+211', flag: '🇸🇸', placeholder: '9XX XXX XXX', digitCount: 9 },
  { code: 'AE', name: 'UAE', dialCode: '+971', flag: '🇦🇪', placeholder: '5X XXX XXXX', digitCount: 9 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', placeholder: '7XXX XXXXXX', digitCount: 10 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', placeholder: 'XXX XXX XXXX', digitCount: 10 },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', placeholder: '1XX XXXX XXXX', digitCount: 11 },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', placeholder: '9XXX XXXXXX', digitCount: 10 },
];

export interface SavedAddress {
  id: string;
  label?: string; // e.g. "Home", "Office", or derived from city/street
  fullName: string;
  phone: string;
  countryCode: string; // e.g. "TZ", "KE"
  dialCode: string;    // e.g. "+255"
  deliveryAddress: string;
  city: string;
  district?: string;
  coords?: { lat: number; lng: number };
  notes?: string;
  isDefault?: boolean;
  createdAt: number;
}

const STORAGE_PREFIX = 'uzaspea_saved_addresses_';
const DEFAULT_COUNTRY_KEY = 'uzaspea_default_delivery_country';

export const detectCountryFromAddress = (addressStr: string, defaultCode = 'TZ'): CountryInfo => {
  if (!addressStr) return SUPPORTED_COUNTRIES.find(c => c.code === defaultCode) || SUPPORTED_COUNTRIES[0];
  const lower = addressStr.toLowerCase();

  if (lower.includes('kenya') || lower.includes('nairobi') || lower.includes('mombasa') || lower.includes('kisumu')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'KE')!;
  }
  if (lower.includes('uganda') || lower.includes('kampala') || lower.includes('entebbe') || lower.includes('jinja')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'UG')!;
  }
  if (lower.includes('rwanda') || lower.includes('kigali')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'RW')!;
  }
  if (lower.includes('burundi') || lower.includes('bujumbura') || lower.includes('gitega')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'BI')!;
  }
  if (lower.includes('congo') || lower.includes('drc') || lower.includes('kinshasa') || lower.includes('goma') || lower.includes('lubumbashi')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'CD')!;
  }
  if (lower.includes('zambia') || lower.includes('lusaka')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'ZM')!;
  }
  if (lower.includes('south africa') || lower.includes('johannesburg') || lower.includes('cape town') || lower.includes('durban')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'ZA')!;
  }
  if (lower.includes('united kingdom') || lower.includes('london')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'GB')!;
  }
  if (lower.includes('united states') || lower.includes('usa')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'US')!;
  }
  if (lower.includes('uae') || lower.includes('dubai') || lower.includes('abu dhabi')) {
    return SUPPORTED_COUNTRIES.find(c => c.code === 'AE')!;
  }

  // Default to Tanzania or user's default
  return SUPPORTED_COUNTRIES.find(c => c.code === defaultCode) || SUPPORTED_COUNTRIES[0];
};

export const getDefaultCountry = (username?: string): CountryInfo => {
  try {
    const saved = localStorage.getItem(`${DEFAULT_COUNTRY_KEY}_${username || 'guest'}`) || localStorage.getItem(DEFAULT_COUNTRY_KEY);
    if (saved) {
      const match = SUPPORTED_COUNTRIES.find(c => c.code === saved);
      if (match) return match;
    }
  } catch (err) {
    console.warn('Failed to read default country from localStorage', err);
  }
  return SUPPORTED_COUNTRIES[0]; // Tanzania (+255)
};

export const setDefaultCountry = (countryCode: string, username?: string): void => {
  try {
    localStorage.setItem(DEFAULT_COUNTRY_KEY, countryCode);
    if (username) {
      localStorage.setItem(`${DEFAULT_COUNTRY_KEY}_${username}`, countryCode);
    }
  } catch (err) {
    console.warn('Failed to set default country in localStorage', err);
  }
};

export const extractRegionFromAddress = (address?: string | null): string | null => {
  if (!address) return null;
  const lower = address.toLowerCase();

  // Tanzanian Regions
  const regions = [
    'Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga',
    'Kilimanjaro', 'Geita', 'Iringa', 'Kagera', 'Katavi', 'Kigoma', 'Lindi',
    'Manyara', 'Mara', 'Mtwara', 'Njombe', 'Pwani', 'Rukwa', 'Ruvuma',
    'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora', 'Zanzibar'
  ];

  // Key districts/cities that uniquely identify a region
  const districtMap: Record<string, string> = {
    'ilemela': 'Mwanza',
    'nyamagana': 'Mwanza',
    'kinondoni': 'Dar es Salaam',
    'ilala': 'Dar es Salaam',
    'temeke': 'Dar es Salaam',
    'ubungo': 'Dar es Salaam',
    'kigamboni': 'Dar es Salaam',
    'moshi': 'Kilimanjaro',
    'kahama': 'Shinyanga',
    'musoma': 'Mara',
    'bukoba': 'Kagera',
    'songea': 'Ruvuma',
    'sumbawanga': 'Rukwa',
    'bahi': 'Dodoma',
    'chamwino': 'Dodoma',
    'meru': 'Arusha',
    'karatu': 'Arusha',
    'monduli': 'Arusha',
    'longido': 'Arusha',
    'hai': 'Kilimanjaro',
    'siha': 'Kilimanjaro',
    'mwanga': 'Kilimanjaro',
    'same': 'Kilimanjaro',
    'rombo': 'Kilimanjaro',
  };

  // Check explicit regions first (excluding Dar es Salaam initially to avoid false positives if address has multiple)
  for (const r of regions) {
    if (r === 'Dar es Salaam') continue;
    const regex = new RegExp(`(^|[,\\s])${r.toLowerCase()}([,\\s]|$)`, 'i');
    if (regex.test(lower)) {
      return r;
    }
  }

  // Check district map
  for (const [dist, reg] of Object.entries(districtMap)) {
    const regex = new RegExp(`(^|[,\\s])${dist}([,\\s]|$)`, 'i');
    if (regex.test(lower)) {
      return reg;
    }
  }

  // Finally check Dar es Salaam
  if (/(^|[,\s])dar\s*es\s*salaam([,\s]|$)/i.test(lower)) {
    return 'Dar es Salaam';
  }

  return null;
};

export const cleanContradictoryAddress = (addr?: string | null): string => {
  if (!addr) return '';
  let clean = addr.trim();
  const detected = extractRegionFromAddress(clean);
  // If the address contains Mwanza, Arusha, etc., but ends with an errant ", Dar es Salaam"
  if (detected && detected !== 'Dar es Salaam') {
    clean = clean.replace(/,?\s*dar\s*es\s*salaam$/i, '').trim();
  }
  return clean;
};

export const getSavedAddresses = (username?: string): SavedAddress[] => {
  try {
    const key = `${STORAGE_PREFIX}${username || 'guest'}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        let changed = false;
        const sanitized = parsed.map((a: SavedAddress) => {
          if (a.deliveryAddress) {
            const detected = extractRegionFromAddress(a.deliveryAddress);
            const cleanedAddr = cleanContradictoryAddress(a.deliveryAddress);
            if (cleanedAddr !== a.deliveryAddress || (detected && a.city !== detected)) {
              changed = true;
              return {
                ...a,
                deliveryAddress: cleanedAddr,
                city: detected || a.city || 'Dar es Salaam',
              };
            }
          }
          return a;
        });
        if (changed) {
          try {
            localStorage.setItem(key, JSON.stringify(sanitized));
          } catch (e) {}
        }
        return sanitized;
      }
    }
  } catch (err) {
    console.warn('Failed to read saved addresses from localStorage', err);
  }
  return [];
};

export const saveAddress = (
  addressData: Omit<SavedAddress, 'id' | 'createdAt'> & { id?: string },
  username?: string
): SavedAddress => {
  const current = getSavedAddresses(username);
  const key = `${STORAGE_PREFIX}${username || 'guest'}`;

  let targetId = addressData.id;
  if (!targetId) {
    // Generate simple readable unique ID
    targetId = `addr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  }

  const cleanedAddr = cleanContradictoryAddress(addressData.deliveryAddress);
  const detectedCity = extractRegionFromAddress(cleanedAddr) || addressData.city || 'Dar es Salaam';

  const newEntry: SavedAddress = {
    ...addressData,
    deliveryAddress: cleanedAddr,
    city: detectedCity,
    id: targetId,
    createdAt: Date.now(),
  };

  const existingIdx = current.findIndex(a => a.id === targetId);
  let updatedList: SavedAddress[];
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = newEntry;
  } else {
    updatedList = [newEntry, ...current];
  }

  try {
    localStorage.setItem(key, JSON.stringify(updatedList));
  } catch (err) {
    console.warn('Failed to persist saved addresses to localStorage', err);
  }

  return newEntry;
};

export const deleteAddress = (addressId: string, username?: string): SavedAddress[] => {
  const current = getSavedAddresses(username);
  const key = `${STORAGE_PREFIX}${username || 'guest'}`;
  const filtered = current.filter(a => a.id !== addressId);
  try {
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to delete address from localStorage', err);
  }
  return filtered;
};
