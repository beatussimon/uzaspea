import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';

export interface UserCoords {
  lat: number;
  lng: number;
}

export interface UserLocationData {
  coords: UserCoords | null;
  address: string | null;
  city: string | null;
  region: string | null;
  district: string | null;
}

export type SearchLocationMode = 'proximity' | 'region' | 'nationwide';

export interface SearchLocationPrefs {
  mode: SearchLocationMode;
  radius: number | null;       // km, null = no radius limit
  region: string | null;       // e.g., "Arusha"
  locationName: string;        // e.g., "Dar es Salaam, Tanzania"
  coords: UserCoords | null;
}

interface LocationContextType {
  location: UserLocationData;
  permission: 'prompt' | 'granted' | 'denied' | 'dismissed';
  isLocating: boolean;
  requestLocation: () => Promise<boolean>;
  dismissPrompt: () => void;
  setManualLocation: (city: string, region: string, coords?: UserCoords) => void;
  calculateDistance: (targetLat: number | string | null, targetLng: number | string | null) => number | null;
  // Search location preferences (persistent)
  searchPrefs: SearchLocationPrefs;
  setSearchMode: (mode: SearchLocationMode) => void;
  setSearchRadius: (radius: number | null) => void;
  setSearchRegion: (region: string | null) => void;
  updateSearchLocation: (locationName: string, coords: UserCoords | null, radius: number | null, region?: string | null) => void;
  setNearMe: () => Promise<boolean>;
  setNationwide: () => void;
  ensureLocation: () => Promise<UserCoords | null>;
}

const STORAGE_KEY = 'uzaspea_user_location';
const DISMISSED_KEY = 'uzaspea_geo_dismissed';
const SEARCH_PREFS_KEY = 'uzaspea_search_location_prefs';

const DEFAULT_SEARCH_PREFS: SearchLocationPrefs = {
  mode: 'nationwide',
  radius: null,
  region: null,
  locationName: 'Nationwide',
  coords: null,
};

const LocationContext = createContext<LocationContextType | null>(null);

export const calculateHaversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<UserLocationData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { coords: null, address: null, city: null, region: null, district: null };
  });

  const [permission, setPermission] = useState<'prompt' | 'granted' | 'denied' | 'dismissed'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return 'granted';
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed) {
        // Once dismissed, do not reprompt automatically
        return 'dismissed';
      }
    } catch {}
    return 'prompt';
  });

  const [isLocating, setIsLocating] = useState(false);

  // Persistent search location preferences
  const [searchPrefs, setSearchPrefs] = useState<SearchLocationPrefs>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_PREFS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SEARCH_PREFS;
  });


  const setSearchMode = useCallback((mode: SearchLocationMode) => {
    setSearchPrefs(prev => {
      const next = { ...prev, mode };
      try { localStorage.setItem(SEARCH_PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setSearchRadius = useCallback((radius: number | null) => {
    setSearchPrefs(prev => {
      const next = { ...prev, radius };
      try { localStorage.setItem(SEARCH_PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setSearchRegion = useCallback((region: string | null) => {
    setSearchPrefs(prev => {
      const next = { ...prev, region };
      try { localStorage.setItem(SEARCH_PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const updateSearchLocation = useCallback((locationName: string, coords: UserCoords | null, radius: number | null, region?: string | null) => {
    setSearchPrefs(prev => {
      const effectiveCoords = coords || prev.coords;
      const mode: SearchLocationMode = radius !== null && effectiveCoords !== null
        ? 'proximity'
        : (region ? 'region' : 'nationwide');
      const next: SearchLocationPrefs = {
        mode,
        radius,
        region: region || null,
        locationName: locationName || prev.locationName,
        coords: effectiveCoords,
      };
      try { localStorage.setItem(SEARCH_PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setNationwide = useCallback(() => {
    const next: SearchLocationPrefs = {
      mode: 'nationwide',
      radius: null,
      region: null,
      locationName: 'Nationwide',
      coords: null,
    };
    setSearchPrefs(next);
    try { localStorage.setItem(SEARCH_PREFS_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const reverseGeocode = async (lat: number, lng: number): Promise<Partial<UserLocationData>> => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/reverse-geocode/?lat=${lat}&lng=${lng}`, { timeout: 6000 });
      const data = res.data;
      return {
        address: data.display_name || data.address?.road || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        city: data.address?.city || data.address?.town || data.address?.municipality || data.address?.suburb || 'Dar es Salaam',
        region: data.address?.state || data.address?.region || 'Dar es Salaam',
        district: data.address?.county || data.address?.district || null,
      };
    } catch {
      return {
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        city: 'Dar es Salaam',
        region: 'Dar es Salaam',
        district: null,
      };
    }
  };

  const requestLocation = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setPermission('denied');
      return false;
    }

    setIsLocating(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const coords = { lat, lng };

          const geoDetails = await reverseGeocode(lat, lng);
          const newLocation: UserLocationData = {
            coords,
            address: geoDetails.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            city: geoDetails.city || 'Dar es Salaam',
            region: geoDetails.region || 'Dar es Salaam',
            district: geoDetails.district || null,
          };

          setLocation(newLocation);
          setPermission('granted');
          setIsLocating(false);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));
            localStorage.removeItem(DISMISSED_KEY);
          } catch {}
          resolve(true);
        },
        (error) => {
          console.warn('Geolocation prompt was dismissed or denied:', error.message);
          setIsLocating(false);
          setPermission('denied');
          try {
            localStorage.setItem(DISMISSED_KEY, Date.now().toString());
          } catch {}
          resolve(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    });
  }, []);

  // Synchronize with browser permissions API on mount (silently cache if already granted, never prompt if denied)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        if (status.state === 'granted') {
          setPermission('granted');
          if (!location.coords) {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const geoDetails = await reverseGeocode(lat, lng);
                const newLocation: UserLocationData = {
                  coords: { lat, lng },
                  address: geoDetails.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                  city: geoDetails.city || 'Dar es Salaam',
                  region: geoDetails.region || 'Dar es Salaam',
                  district: geoDetails.district || null,
                };
                setLocation(newLocation);
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));
                  localStorage.removeItem(DISMISSED_KEY);
                } catch {}
              },
              () => {},
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
            );
          }
        } else if (status.state === 'denied') {
          setPermission('denied');
        }

        status.onchange = () => {
          if (status.state === 'granted') setPermission('granted');
          else if (status.state === 'denied') setPermission('denied');
        };
      }).catch(() => {});
    }
  }, []);

  const dismissPrompt = useCallback(() => {
    setPermission('dismissed');
    try {
      localStorage.setItem(DISMISSED_KEY, 'permanently_dismissed');
    } catch {}
  }, []);

  const ensureLocation = useCallback(async (): Promise<UserCoords | null> => {
    if (location.coords) return location.coords;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.coords) {
          setLocation(parsed);
          setPermission('granted');
          return parsed.coords;
        }
      }
    } catch {}

    const ok = await requestLocation();
    if (ok) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.coords || null;
      }
    }
    return null;
  }, [location.coords, requestLocation]);

  const setNearMe = useCallback(async (): Promise<boolean> => {
    let currentCoords = location.coords;
    let currentCity = location.city;

    if (!currentCoords && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
        });
        currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch {}
    }

    if (!currentCoords) {
      const ok = await requestLocation();
      if (!ok) return false;
      currentCoords = location.coords;
      currentCity = location.city;
    }

    if (currentCoords) {
      const name = currentCity ? `${currentCity}, Tanzania` : 'Near Me';
      const next: SearchLocationPrefs = {
        mode: 'proximity',
        radius: 10,
        region: null,
        locationName: name,
        coords: currentCoords,
      };
      setSearchPrefs(next);
      try { localStorage.setItem(SEARCH_PREFS_KEY, JSON.stringify(next)); } catch {}
      return true;
    }
    return false;
  }, [requestLocation, location.coords, location.city]);

  const setManualLocation = useCallback((city: string, region: string, coords?: UserCoords) => {
    const newLoc: UserLocationData = {
      coords: coords || null,
      address: `${city}, ${region}`,
      city,
      region,
      district: null,
    };
    setLocation(newLoc);
    setPermission('granted');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLoc));
    } catch {}
  }, []);

  const calculateDistance = useCallback(
    (targetLat: number | string | null, targetLng: number | string | null): number | null => {
      if (!location.coords || targetLat === null || targetLng === null) return null;
      const lat1 = location.coords.lat;
      const lon1 = location.coords.lng;
      const lat2 = typeof targetLat === 'string' ? parseFloat(targetLat) : targetLat;
      const lon2 = typeof targetLng === 'string' ? parseFloat(targetLng) : targetLng;

      if (isNaN(lat2) || isNaN(lon2)) return null;
      return calculateHaversine(lat1, lon1, lat2, lon2);
    },
    [location.coords]
  );

  return (
    <LocationContext.Provider
      value={{
        location,
        permission,
        isLocating,
        requestLocation,
        dismissPrompt,
        ensureLocation,
        setManualLocation,
        calculateDistance,
        searchPrefs,
        setSearchMode,
        setSearchRadius,
        setSearchRegion,
        updateSearchLocation,
        setNearMe,
        setNationwide,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useUserLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useUserLocation must be used within a LocationProvider');
  }
  return context;
};
