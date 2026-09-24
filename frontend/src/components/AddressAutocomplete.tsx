import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Crosshair, Loader2, Navigation, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useUserLocation } from '../context/LocationContext';

export interface LocationResult {
  place_id: number | string;
  name?: string;
  display_name: string;
  lat: string | number;
  lon: string | number;
  address?: {
    state?: string;
    city?: string;
    county?: string;
    district?: string;
    suburb?: string;
    neighbourhood?: string;
    road?: string;
    ward?: string;
    region?: string;
    city_district?: string;
    country?: string;
    country_code?: string;
  };
  isLocal?: boolean;
}

// Official Tanzanian Regions for accurate region matching
export const TZ_REGIONS: string[] = [
  'Arusha',
  'Dar es Salaam',
  'Dodoma',
  'Geita',
  'Iringa',
  'Kagera',
  'Katavi',
  'Kigoma',
  'Kilimanjaro',
  'Lindi',
  'Manyara',
  'Mara',
  'Mbeya',
  'Morogoro',
  'Mtwara',
  'Mwanza',
  'Njombe',
  'Pemba North',
  'Pemba South',
  'Pwani',
  'Rukwa',
  'Ruvuma',
  'Shinyanga',
  'Simiyu',
  'Singida',
  'Songwe',
  'Tabora',
  'Tanga',
  'Zanzibar Central/South',
  'Zanzibar North',
  'Zanzibar Urban/West',
];

// Well-known Tanzanian areas and commercial hubs for instant 0ms suggestions
const LOCAL_TZ_PLACES: { name: string; area: string; city: string; lat: number; lng: number }[] = [
  { name: 'Kariakoo Market', area: 'Kariakoo, Ilala', city: 'Dar es Salaam', lat: -6.8204, lng: 39.2758 },
  { name: 'Aggrey Street', area: 'Kariakoo / Mnazi Mmoja, Ilala', city: 'Dar es Salaam', lat: -6.8206, lng: 39.2838 },
  { name: 'Congo Street', area: 'Kariakoo, Ilala', city: 'Dar es Salaam', lat: -6.8218, lng: 39.2745 },
  { name: 'Uhuru Street', area: 'Ilala', city: 'Dar es Salaam', lat: -6.8245, lng: 39.2710 },
  { name: 'Lumumba Street', area: 'Mnazi Mmoja, Ilala', city: 'Dar es Salaam', lat: -6.8180, lng: 39.2820 },
  { name: 'Posta / CBD', area: 'City Center, Ilala', city: 'Dar es Salaam', lat: -6.8160, lng: 39.2890 },
  { name: 'Samora Avenue', area: 'City Center, Ilala', city: 'Dar es Salaam', lat: -6.8152, lng: 39.2885 },
  { name: 'Sinza Kijiweni', area: 'Sinza, Ubungo', city: 'Dar es Salaam', lat: -6.7820, lng: 39.2240 },
  { name: 'Sinza Makaburini', area: 'Sinza, Ubungo', city: 'Dar es Salaam', lat: -6.7870, lng: 39.2280 },
  { name: 'Mwenge Bus Stand / Market', area: 'Mwenge, Kinondoni', city: 'Dar es Salaam', lat: -6.7710, lng: 39.2290 },
  { name: 'Mlimani City Mall', area: 'Mwenge / Survey, Ubungo', city: 'Dar es Salaam', lat: -6.7715, lng: 39.2185 },
  { name: 'Mikocheni A', area: 'Mikocheni, Kinondoni', city: 'Dar es Salaam', lat: -6.7620, lng: 39.2510 },
  { name: 'Mikocheni B', area: 'Mikocheni, Kinondoni', city: 'Dar es Salaam', lat: -6.7550, lng: 39.2450 },
  { name: 'Masaki Peninsula', area: 'Masaki, Kinondoni', city: 'Dar es Salaam', lat: -6.7450, lng: 39.2780 },
  { name: 'Oysterbay', area: 'Oysterbay, Kinondoni', city: 'Dar es Salaam', lat: -6.7680, lng: 39.2720 },
  { name: 'Kinondoni Manyanya', area: 'Kinondoni', city: 'Dar es Salaam', lat: -6.7910, lng: 39.2610 },
  { name: 'Kimara Mwisho', area: 'Kimara, Ubungo', city: 'Dar es Salaam', lat: -6.7890, lng: 39.1670 },
  { name: 'Mbezi Louis Bus Terminal', area: 'Mbezi, Ubungo', city: 'Dar es Salaam', lat: -6.7920, lng: 39.1240 },
  { name: 'Mbezi Beach', area: 'Mbezi Beach, Kinondoni', city: 'Dar es Salaam', lat: -6.7210, lng: 39.2280 },
  { name: 'Tegeta Kibaoni', area: 'Tegeta, Kinondoni', city: 'Dar es Salaam', lat: -6.6740, lng: 39.2080 },
  { name: 'Kunduchi Beach', area: 'Kunduchi, Kinondoni', city: 'Dar es Salaam', lat: -6.6620, lng: 39.2180 },
  { name: 'Tabata Bima', area: 'Tabata, Ilala', city: 'Dar es Salaam', lat: -6.8280, lng: 39.2250 },
  { name: 'Mbagala Rangi Tatu', area: 'Mbagala, Temeke', city: 'Dar es Salaam', lat: -6.9050, lng: 39.2620 },
  { name: 'Temeke Hospital', area: 'Temeke', city: 'Dar es Salaam', lat: -6.8520, lng: 39.2650 },
  { name: 'Kigamboni Ferry', area: 'Kigamboni', city: 'Dar es Salaam', lat: -6.8240, lng: 39.2970 },
  { name: 'Gerezani', area: 'Ilala', city: 'Dar es Salaam', lat: -6.8280, lng: 39.2820 },
  { name: 'Upanga East', area: 'Upanga, Ilala', city: 'Dar es Salaam', lat: -6.8080, lng: 39.2780 },
  { name: 'Magomeni Mapipa', area: 'Magomeni, Kinondoni', city: 'Dar es Salaam', lat: -6.8050, lng: 39.2550 },
  { name: 'Ubungo Maji', area: 'Ubungo', city: 'Dar es Salaam', lat: -6.7850, lng: 39.2090 },
  { name: 'Clock Tower Arusha', area: 'CBD', city: 'Arusha', lat: -3.3723, lng: 36.6944 },
  { name: 'Njiro Complex', area: 'Njiro', city: 'Arusha', lat: -3.3980, lng: 36.7120 },
  { name: 'Dodoma City Center', area: 'CBD', city: 'Dodoma', lat: -6.1730, lng: 35.7480 },
  { name: 'Mwanza Rock City Mall', area: 'Ilemela', city: 'Mwanza', lat: -2.5180, lng: 32.9030 },
  { name: 'Mbeya Kabwe', area: 'Kabwe', city: 'Mbeya', lat: -8.9040, lng: 33.4560 },
  { name: 'Morogoro Msamvu Bus Terminal', area: 'Msamvu', city: 'Morogoro', lat: -6.8020, lng: 37.6620 },
  { name: 'Stone Town', area: 'Urban West', city: 'Zanzibar', lat: -6.1620, lng: 39.1900 },
];

function getSearchTerms(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const terms = [trimmed];

  // Swahili prefix normalization: "Mtaa wa aggrey" -> "aggrey", "aggrey street"
  const swahiliRegex = /^(mtaa\s+wa|mtaa\s+ya|barabara\s+ya|barabara\s+wa|mtaa|barabara|eneo\s+la|karibu\s+na)\s+/i;
  if (swahiliRegex.test(trimmed)) {
    const stripped = trimmed.replace(swahiliRegex, '').trim();
    if (stripped.length >= 2) {
      terms.push(stripped);
      terms.push(`${stripped} Street`);
      terms.push(`${stripped} Road`);
    }
  }
  return Array.from(new Set(terms));
}

export interface AddressAutocompleteProps {
  value: string;
  onChange?: (address: string) => void;
  onSelect?: (
    address: string,
    coords?: { lat: number; lng: number },
    region?: string,
    district?: string,
    countryCode?: string
  ) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder,
  className = '',
  autoFocus = false,
}) => {
  const { t } = useTranslation();
  const { location: userLoc, ensureLocation } = useUserLocation();
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelectedRef = useRef(false);

  // Sync external value when changed outside
  useEffect(() => {
    const isInputFocused = inputRef.current && document.activeElement === inputRef.current;
    if (!isInputFocused && value !== query && !justSelectedRef.current) {
      setQuery(value || '');
    }
    justSelectedRef.current = false;
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search logic: Local matches immediately + Nominatim debounced
  useEffect(() => {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    // If user just selected this item, don't re-trigger search dropdown
    if (justSelectedRef.current) {
      return;
    }

    const searchTerms = getSearchTerms(cleanQuery);
    const primaryTerm = searchTerms[1] || searchTerms[0]; // stripped term preferred for matching

    // 1. Instant local search (0ms)
    const localMatches: LocationResult[] = LOCAL_TZ_PLACES.filter(p => {
      const qLower = primaryTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(qLower) ||
        p.area.toLowerCase().includes(qLower) ||
        p.city.toLowerCase().includes(qLower)
      );
    }).map((p, idx) => ({
      place_id: `local-${idx}-${p.name}`,
      name: p.name,
      display_name: `${p.name}, ${p.area}, ${p.city}, Tanzania`,
      lat: p.lat,
      lon: p.lng,
      address: {
        city: p.city,
        state: p.city,
        county: p.area.split(',')[1]?.trim() || '',
        suburb: p.area.split(',')[0]?.trim() || '',
      },
      isLocal: true,
    }));

    if (localMatches.length > 0) {
      setResults(localMatches);
      setShowDropdown(true);
    }

    // 2. Debounced OSM Nominatim search
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        let osmResults: LocationResult[] = [];
        
        // Search each term until results found
        for (const term of searchTerms) {
          try {
            const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
              params: {
                q: term,
                format: 'json',
                countrycodes: 'tz',
                addressdetails: 1,
                limit: 5,
              },
              headers: {
                'Accept-Language': 'sw,en',
              },
            });
            if (Array.isArray(res.data) && res.data.length > 0) {
              osmResults = res.data;
              break;
            }
          } catch (termErr) {
            console.warn('Nominatim term lookup failed:', termErr);
          }
        }

        // Merge: keep local matches first if highly relevant, then OSM results
        const combined: LocationResult[] = [...localMatches];
        for (const osm of osmResults) {
          const exists = combined.some(c => 
            c.display_name.toLowerCase() === osm.display_name.toLowerCase() ||
            (Math.abs(Number(c.lat) - Number(osm.lat)) < 0.001 && Math.abs(Number(c.lon) - Number(osm.lon)) < 0.001)
          );
          if (!exists) {
            combined.push(osm);
          }
        }

        setResults(combined);
        setShowDropdown(true);
      } catch (err) {
        console.error('Failed to fetch remote locations', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const notifySelect = (
    address: string,
    coords?: { lat: number; lng: number },
    region?: string,
    district?: string,
    countryCode?: string
  ) => {
    if (onSelect) {
      onSelect(address, coords, region, district, countryCode);
    } else if (onChange) {
      onChange(address);
    }
  };

  const handleSelect = (result: LocationResult) => {
    justSelectedRef.current = true;
    const cleanAddress = result.display_name;
    setQuery(cleanAddress);
    setShowDropdown(false);

    // Robust Tanzanian region detection:
    let region = '';
    const candidates = [
      result.address?.state,
      result.address?.city,
      result.address?.county,
      (result.address as any)?.region,
      ...(result.display_name ? result.display_name.split(',').map(s => s.trim()) : [])
    ].filter(Boolean) as string[];

    for (const cand of candidates) {
      const clean = cand.replace(/\s+(Region|Zone|Mkoa)$/i, '').trim();
      const matched = TZ_REGIONS.find(r => r.toLowerCase() === clean.toLowerCase());
      if (matched) {
        region = matched;
        break;
      }
    }

    if (!region) {
      const raw = result.address?.state || result.address?.city || (result.address as any)?.region || '';
      region = raw.replace(/\s+(Region|Zone|Mkoa)$/i, '').trim();
    }

    let district =
      result.address?.county ||
      result.address?.district ||
      (result.address as any)?.city_district ||
      result.address?.suburb ||
      '';
    district = district.replace(/\s+(District|Wilaya|MC|Municipal|City)$/i, '').trim();

    let detectedCountry = (result.address as any)?.country_code?.toUpperCase();
    if (!detectedCountry) {
      const fullText = (result.display_name || '').toLowerCase();
      if (fullText.includes('kenya')) detectedCountry = 'KE';
      else if (fullText.includes('uganda')) detectedCountry = 'UG';
      else if (fullText.includes('rwanda')) detectedCountry = 'RW';
      else if (fullText.includes('burundi')) detectedCountry = 'BI';
      else if (fullText.includes('congo') || fullText.includes('drc')) detectedCountry = 'CD';
      else if (fullText.includes('zambia')) detectedCountry = 'ZM';
      else if (fullText.includes('south africa')) detectedCountry = 'ZA';
      else detectedCountry = 'TZ';
    }

    notifySelect(
      cleanAddress,
      {
        lat: Number(parseFloat(String(result.lat)).toFixed(6)),
        lng: Number(parseFloat(String(result.lon)).toFixed(6)),
      },
      region,
      district,
      detectedCountry
    );
  };

  const handleSelectManual = () => {
    justSelectedRef.current = true;
    setShowDropdown(false);
    let detectedRegion = '';
    const qLower = query.toLowerCase();
    for (const r of TZ_REGIONS) {
      if (qLower.includes(r.toLowerCase())) {
        detectedRegion = r;
        break;
      }
    }
    notifySelect(query.trim(), undefined, detectedRegion || undefined, undefined, 'TZ');
  };

  const handleGetCurrentLocation = async () => {
    setLocating(true);
    try {
      let coords = userLoc.coords;
      if (!coords) {
        coords = await ensureLocation();
      }

      if (!coords) {
        alert(t('geolocation_error', 'Failed to get current location'));
        setLocating(false);
        return;
      }

      if (userLoc.address && userLoc.coords?.lat === coords.lat && userLoc.coords?.lng === coords.lng) {
        justSelectedRef.current = true;
        setQuery(userLoc.address);
        setShowDropdown(false);
        notifySelect(userLoc.address, coords, userLoc.region || userLoc.city || '', userLoc.district || '');
        setLocating(false);
        return;
      }

      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          lat: coords.lat,
          lon: coords.lng,
          format: 'json',
          addressdetails: 1,
        },
      });
      const data = res.data as LocationResult;
      if (data && data.display_name) {
        handleSelect(data);
      } else {
        const fallback = t('current_location', 'Current Location');
        justSelectedRef.current = true;
        setQuery(fallback);
        setShowDropdown(false);
        notifySelect(fallback, coords);
      }
    } catch (err) {
      console.error('Failed to get location', err);
      alert(t('failed_to_get_address', 'Failed to get address from location'));
    } finally {
      setLocating(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        <MapPin size={16} className="absolute left-3 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          className={`flex h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-20 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-600 dark:focus:border-neutral-300 ${className}`}
          placeholder={placeholder || t('search_address', 'Type street, neighborhood, or landmark in Tanzania...')}
          value={query}
          onChange={(e) => {
            justSelectedRef.current = false;
            setQuery(e.target.value);
            // Send typed text to parent as user types, WITHOUT forcing collapse
            onChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (results.length > 0 && showDropdown) {
                handleSelect(results[0]);
              } else if (query.trim().length > 0) {
                handleSelectManual();
              }
            }
          }}
          onFocus={(e) => {
            e.target.select();
            if (query.trim().length >= 2) {
              setShowDropdown(true);
            }
          }}
          autoComplete="off"
        />
        
        {loading && (
          <div className={`absolute ${query.length > 0 ? 'right-16' : 'right-10'} w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin pointer-events-none`} />
        )}

        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setShowDropdown(false);
              onChange?.('');
              inputRef.current?.focus();
            }}
            className="absolute right-9 p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded transition-colors"
            title={t('clear', 'Clear')}
          >
            <X size={15} />
          </button>
        )}
        
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="absolute right-2.5 p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded transition-colors"
          title={t('use_current_location', 'Use current GPS location')}
          disabled={locating}
        >
          {locating ? <Loader2 size={16} className="animate-spin text-neutral-400" /> : <Crosshair size={16} />}
        </button>
      </div>

      {/* Suggestion Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-1 divide-y divide-neutral-100 dark:divide-neutral-900">
              {results.map((r) => {
                const parts = r.display_name.split(',');
                const title = r.name || parts[0]?.trim();
                const subtitle = parts.slice(1).join(',').trim();

                return (
                  <button
                    key={r.place_id}
                    type="button"
                    className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 flex items-start gap-3 transition-colors group"
                    onClick={() => handleSelect(r)}
                  >
                    <MapPin size={15} className="text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white mt-1 shrink-0 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate text-xs sm:text-sm">
                        {title}
                      </p>
                      {subtitle && (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !loading && query.trim().length >= 2 ? (
            <div className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
              No matching address found in map database.
            </div>
          ) : null}

          {/* Manual Fallback Option */}
          {query.trim().length >= 2 && (
            <button
              type="button"
              className="w-full text-left px-3.5 py-2.5 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900/60 dark:hover:bg-neutral-900 text-xs flex items-center gap-2.5 border-t border-neutral-100 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium transition-colors"
              onClick={handleSelectManual}
            >
              <Navigation size={13} className="text-neutral-400 shrink-0" />
              <span className="truncate">
                Use <span className="font-semibold text-neutral-900 dark:text-white">"{query.trim()}"</span> as manual address
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
