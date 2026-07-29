import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Crosshair, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

interface LocationResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    state?: string;
    city?: string;
    county?: string;
    district?: string;
    suburb?: string;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }, region?: string, district?: string) => void;
  placeholder?: string;
  className?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ value, onChange, placeholder, className = '' }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }
    
    // Prevent fetching if query exactly matches selected value
    if (query === value) return;

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
          params: {
            q: query,
            format: 'json',
            countrycodes: 'tz',
            addressdetails: 1,
            limit: 5
          }
        });
        setResults(res.data);
        setShowDropdown(true);
      } catch (err) {
        console.error('Failed to fetch locations', err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query, value]);

  const handleSelect = (result: LocationResult) => {
    setQuery(result.display_name);
    setShowDropdown(false);
    
    const region = result.address?.state || result.address?.city || '';
    const district = result.address?.county || result.address?.district || result.address?.suburb || '';
    
    onChange(result.display_name, { lat: parseFloat(result.lat), lng: parseFloat(result.lon) }, region, district);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(t('geolocation_not_supported', 'Geolocation is not supported by your browser'));
      return;
    }
    
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
            params: {
              lat: latitude,
              lon: longitude,
              format: 'json',
              addressdetails: 1
            }
          });
          const data = res.data as LocationResult;
          if (data && data.display_name) {
            handleSelect(data);
          }
        } catch (err) {
          console.error('Failed to reverse geocode', err);
          alert(t('failed_to_get_address', 'Failed to get address from location'));
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        console.error('Geolocation error', error);
        alert(t('geolocation_error', 'Failed to get current location'));
        setLocating(false);
      }
    );
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        <MapPin size={16} className="absolute left-3 text-gray-400" />
        <input
          type="text"
          className={`flex h-10 w-full rounded-btn border border-surface-border bg-white pl-10 pr-4 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 dark:border-surface-dark-border dark:bg-[#111] dark:text-white ${className}`}
          placeholder={placeholder || t('search_address', 'Search address in Tanzania...')}
          value={query}
          onChange={(e) => {
             setQuery(e.target.value);
             onChange(e.target.value);
          }}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
        />
        {loading && <div className="absolute right-10 w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="absolute right-2 p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-md transition-colors"
          title={t('use_current_location', 'Use current location')}
          disabled={locating}
        >
          {locating ? <Loader2 size={16} className="animate-spin text-brand-500" /> : <Crosshair size={16} />}
        </button>
      </div>
      
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-btn shadow-lg max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-surface-border dark:border-surface-dark-border last:border-0 flex items-start gap-3 transition-colors"
              onClick={() => handleSelect(r)}
            >
              <Search size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
