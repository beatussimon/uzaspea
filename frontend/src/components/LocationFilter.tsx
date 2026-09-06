import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useUserLocation } from '../context/LocationContext';
import { useTranslation } from 'react-i18next';
import api from '../api';
import axios from 'axios';

interface PlaceResult {
  place_id: number | string;
  display_name: string;
  lat: number;
  lng: number;
  city?: string;
  region?: string;
}

interface LocationFilterProps {
  className?: string;
  country?: string;
}

const LocationFilter: React.FC<LocationFilterProps> = ({ className = '', country = 'Tanzania' }) => {
  const { t } = useTranslation();
  const {
    searchPrefs,
    updateSearchLocation,
    setNearMe,
    setNationwide,
    isLocating,
  } = useUserLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autocomplete debounced query
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/locations/search/', { params: { q: query.trim() } });
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSuggestions(res.data);
          setShowSuggestions(true);
          return;
        }

        const directRes = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: query.trim(),
            format: 'json',
            countrycodes: 'tz',
            addressdetails: 1,
            limit: 5,
          },
          headers: { 'Accept-Language': 'en' },
        });

        const items: PlaceResult[] = (directRes.data || []).map((item: any) => ({
          place_id: item.place_id,
          display_name: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          city: item.address?.city || item.address?.town || item.address?.suburb || '',
          region: item.address?.state || item.address?.region || '',
        }));

        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectPlace = (place: PlaceResult) => {
    const cleanCity = place.city || place.display_name.split(',')[0].trim();
    updateSearchLocation(
      place.display_name,
      { lat: place.lat, lng: place.lng },
      searchPrefs.radius || 25,
      place.region || place.city || null
    );
    setQuery(cleanCity);
    setShowSuggestions(false);
    setIsEditing(false);
  };

  const handleRadiusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'nationwide') {
      setNationwide();
      setQuery('');
      setIsEditing(false);
    } else {
      const rad = Number(val);
      updateSearchLocation(
        searchPrefs.locationName || 'Location',
        searchPrefs.coords,
        rad,
        searchPrefs.region
      );
    }
  };

  const isNationwide = searchPrefs.mode === 'nationwide' || searchPrefs.radius === null;

  // Format the collapsed location text
  const getDisplayLocationText = () => {
    if (isNationwide) {
      return t('all_in_country', `All in ${country}`);
    }
    const rawName = searchPrefs.locationName || 'Location';
    const cleanName = rawName.split(',')[0].trim();
    return `${cleanName} · Within ${searchPrefs.radius || 10} km`;
  };

  return (
    <div ref={wrapperRef} className={`space-y-2 ${className}`}>
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
          {t('location', 'Location')}
        </label>
      </div>

      {/* Collapsed Display: just show the name, clickable, no boundary, no Change text */}
      {!isEditing ? (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-left text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-brand-500 dark:hover:text-brand-400 transition-colors cursor-pointer py-0.5 block w-full truncate"
        >
          {getDisplayLocationText()}
        </button>
      ) : (
        <div className="space-y-2 animate-in fade-in-50 duration-150">
          {/* Location text input matching sidebar filter styles */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('type_city_area', 'Type city or area...')}
              autoFocus
              className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
            />
            {loading && (
              <div className="absolute right-3 top-3 text-neutral-400">
                <Loader2 size={14} className="animate-spin" />
              </div>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((p) => (
                  <button
                    key={p.place_id}
                    type="button"
                    onClick={() => handleSelectPlace(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-800/60 last:border-0 truncate block"
                  >
                    {p.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Radius select without '(Near me)' so 10km applies to whatever location is selected */}
          <select
            value={searchPrefs.radius === null ? 'nationwide' : String(searchPrefs.radius)}
            onChange={handleRadiusChange}
            className="w-full px-3 py-2.5 text-sm border-0 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-900/50 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-shadow"
          >
            <option value="nationwide">{t('nationwide', `All in ${country}`)}</option>
            <option value="10">Within 10 km</option>
            <option value="25">Within 25 km</option>
            <option value="50">Within 50 km</option>
            <option value="100">Within 100 km</option>
            <option value="250">Within 250 km</option>
            <option value="499">Within 499 km</option>
          </select>

          <div className="flex items-center justify-between pt-0.5 text-xs">
            <button
              type="button"
              onClick={async () => {
                await setNearMe();
                setIsEditing(false);
              }}
              disabled={isLocating}
              className="text-xs text-brand-500 hover:text-brand-600 font-medium cursor-pointer"
            >
              {isLocating ? t('locating', 'Locating...') : t('use_current_location', 'Use current location')}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 px-2 py-1 cursor-pointer no-underline"
            >
              {t('done', 'Done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationFilter;
