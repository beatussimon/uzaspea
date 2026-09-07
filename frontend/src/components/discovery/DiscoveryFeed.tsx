import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { apiCache } from '../../utils/apiCache';
import { useUserLocation } from '../../context/LocationContext';
import DiscoveryShelf from './DiscoveryShelf';
import { ProductCardSkeleton } from '../Skeleton';

interface SectionData {
  id: string;
  type: 'horizontal_shelf' | 'grid_shelf';
  title: string;
  subtitle?: string;
  badge?: string;
  category_slug?: string;
  gender_active?: 'female' | 'male';
  has_gender_toggle?: boolean;
  see_more_url?: string;
  products: any[];
}

const FEED_STORAGE_KEY = 'uzaspea_discovery_feed';

export const DiscoveryFeed: React.FC = () => {
  const { t } = useTranslation();
  const { location, searchPrefs, setNearMe, setNationwide, isLocating } = useUserLocation();

  const [gender] = useState<'female' | 'male'>(() => {
    const saved = localStorage.getItem('preferred_gender');
    if (saved === 'female' || saved === 'male') return saved;
    return 'female';
  });

  const cacheKey = `discovery:feed:${gender}`;
  const [sections, setSections] = useState<SectionData[]>(() => {
    const memCached = apiCache.get<any>(cacheKey);
    if (memCached && Array.isArray(memCached.data?.sections)) return memCached.data.sections;
    try {
      const saved = sessionStorage.getItem(`${FEED_STORAGE_KEY}_${gender}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.sections)) {
          apiCache.set(cacheKey, parsed);
          return parsed.sections;
        }
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => sections.length === 0);

  const fetchDiscoveryFeed = useCallback((activeGender: 'female' | 'male') => {
    const key = `discovery:feed:${activeGender}`;
    const cached = apiCache.get<any>(key);
    if (cached && Array.isArray(cached.data?.sections)) {
      setSections(cached.data.sections);
      setLoading(false);
      return;
    }

    if (sections.length === 0) {
      setLoading(true);
    }
    const params: Record<string, string> = { gender: activeGender };

    if (searchPrefs.mode === 'proximity' && location.coords && searchPrefs.radius) {
      params.lat = String(location.coords.lat);
      params.lng = String(location.coords.lng);
      params.radius = String(searchPrefs.radius);
    } else if (searchPrefs.mode === 'region' && searchPrefs.region) {
      params.region = searchPrefs.region;
    }

    api.get('/api/products/discovery/', { params })
      .then((res) => {
        apiCache.set(key, res.data);
        try {
          sessionStorage.setItem(`${FEED_STORAGE_KEY}_${activeGender}`, JSON.stringify(res.data));
        } catch {}
        if (Array.isArray(res.data?.sections)) {
          setSections(res.data.sections);
        }
      })
      .catch(() => {
        // Keep existing sections or empty
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchPrefs, location.coords, sections.length]);

  useEffect(() => {
    fetchDiscoveryFeed(gender);
  }, [fetchDiscoveryFeed, gender]);

  return (
    <div className="w-full space-y-2 sm:space-y-3 md:space-y-4 animate-in fade-in duration-300">
      {/* Location Bar / Context Banner */}
      <div className="flex items-center justify-center gap-1.5 py-0 px-2 text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 -mb-1 md:mb-0">
        <span className="text-neutral-800 dark:text-neutral-200 font-semibold">
          {searchPrefs.mode === 'proximity' && searchPrefs.locationName !== 'Nationwide'
            ? `${searchPrefs.locationName.split(',')[0]} (${t('within', 'within')} ${searchPrefs.radius || 10}km)`
            : (searchPrefs.region ? `${t('all_in', 'All in')} ${searchPrefs.region}` : t('all_in_country', 'All in Tanzania'))}
        </span>
        <span className="text-neutral-300 dark:text-neutral-700">•</span>
        {searchPrefs.mode === 'proximity' ? (
          <button
            type="button"
            onClick={setNationwide}
            className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors cursor-pointer no-underline"
          >
            {t('view_all_in_country', 'View all in Tanzania')}
          </button>
        ) : (
          <button
            type="button"
            onClick={setNearMe}
            disabled={isLocating}
            className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors cursor-pointer no-underline"
          >
            {isLocating ? t('locating', 'Locating...') : t('view_near_me', 'View near me')}
          </button>
        )}
      </div>

      {/* Discovery Sections */}
      {loading && sections.length === 0 ? (
        <div className="space-y-4 md:space-y-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="py-1.5 md:py-2.5 space-y-2">
              <div className="h-5 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-md animate-pulse" />
              <div className="grid grid-rows-[repeat(2,auto)] grid-flow-col gap-3 sm:gap-4 md:gap-5 overflow-hidden auto-cols-[100%] sm:auto-cols-[calc((100%-16px)/2)] lg:auto-cols-[calc((100%-40px)/3)] xl:auto-cols-[calc((100%-60px)/4)] 2xl:auto-cols-[calc((100%-80px)/5)]">
                {[...Array(8)].map((_, j) => (
                  <div key={j} className="w-full">
                    <ProductCardSkeleton viewMode="grid" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        sections.map((section) => (
          <DiscoveryShelf
            key={section.id}
            id={section.id}
            title={section.title}
            subtitle={section.subtitle}
            categorySlug={section.category_slug}
            seeMoreUrl={section.see_more_url}
            products={section.products || []}
            type={section.type}
          />
        ))
      )}
    </div>
  );
};

export default DiscoveryFeed;
