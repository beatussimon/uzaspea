import { useState, useEffect } from 'react';
import api from '../api';

export interface SiteSettingsData {
  company_name?: string;
  tagline?: string;
  support_email?: string;
  support_phone?: string;
  whatsapp_number?: string;
  address?: string;
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  tiktok_url?: string;
  linkedin_url?: string;
  youtube_url?: string;
  working_hours?: string;
  for_you_image?: string | null;
  home_light_bg_image?: string | null;
  home_dark_bg_image?: string | null;
}

const SETTINGS_STORAGE_KEY = 'uzaspea_sitesettings_cache';

/**
 * Normalizes media URLs so they work whether on localhost, 127.0.0.1, LAN IP, or production.
 */
export const normalizeMediaUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (typeof window !== 'undefined') {
    // If backend gave an absolute URL pointing to 127.0.0.1:8000 or localhost:8000 but the frontend is on a different host
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsed = new URL(url);
        if (
          (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
          window.location.hostname !== parsed.hostname
        ) {
          return `${parsed.pathname}${parsed.search}`;
        }
      }
    } catch {}
  }
  return url;
};

let memoryCache: SiteSettingsData | null = (() => {
  try {
    const saved = sessionStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
})();

const listeners = new Set<(settings: SiteSettingsData) => void>();

export const getSiteSettingsCached = (): SiteSettingsData | null => memoryCache;

export const fetchSiteSettings = async (): Promise<SiteSettingsData | null> => {
  try {
    const res = await api.get('/api/site-settings/');
    const rawData = res.data || {};
    const normalizedData: SiteSettingsData = {
      ...rawData,
      for_you_image: normalizeMediaUrl(rawData.for_you_image),
      home_light_bg_image: normalizeMediaUrl(rawData.home_light_bg_image),
      home_dark_bg_image: normalizeMediaUrl(rawData.home_dark_bg_image),
    };

    memoryCache = normalizedData;
    try {
      sessionStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizedData));
    } catch {}

    listeners.forEach(cb => {
      try { cb(normalizedData); } catch {}
    });

    return normalizedData;
  } catch {
    return memoryCache;
  }
};

export const subscribeSiteSettings = (callback: (settings: SiteSettingsData) => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Hook to access and automatically stay synchronized with SiteSettings.
 * Returns cached data immediately (0ms) and revalidates in the background.
 */
export const useSiteSettings = () => {
  const [settings, setSettings] = useState<SiteSettingsData | null>(memoryCache);

  useEffect(() => {
    const unsubscribe = subscribeSiteSettings((newSettings) => {
      setSettings(newSettings);
    });

    // Revalidate on mount
    fetchSiteSettings();

    return unsubscribe;
  }, []);

  return settings;
};
