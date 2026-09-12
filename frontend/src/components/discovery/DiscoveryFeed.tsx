import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import { apiCache } from '../../utils/apiCache';
import { useUserLocation } from '../../context/LocationContext';
import DiscoveryShelf from './DiscoveryShelf';
import NetworkErrorState from '../common/NetworkErrorState';
import { classifyApiError, ClassifiedError } from '../../utils/errorUtils';

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

const DEFAULT_PREVIEW_SECTIONS: SectionData[] = [
  {
    id: 'look_different',
    type: 'horizontal_shelf',
    title: 'Look Different',
    subtitle: 'Trendy styles, dresses, shoes & beauty picks for you',
    see_more_url: '/products?category=womens-fashion',
    products: [],
  },
  {
    id: 'for_your_car',
    type: 'horizontal_shelf',
    title: 'For Your Car',
    subtitle: 'Essential spare parts, vehicle accessories & automobiles',
    see_more_url: '/products?category=vehicles',
    products: [],
  },
  {
    id: 'phone_deals',
    type: 'horizontal_shelf',
    title: 'Brand New Deals in Phones',
    subtitle: 'Smartphones, mobile accessories & hot electronic gadgets',
    see_more_url: '/products?category=electronics',
    products: [],
  },
];

export const DiscoveryFeed: React.FC = () => {
  const { location, searchPrefs } = useUserLocation();

  const [gender] = useState<'female' | 'male'>(() => {
    const saved = localStorage.getItem('preferred_gender');
    if (saved === 'female' || saved === 'male') return saved;
    return 'female';
  });

  const locScope = useMemo(() => {
    if (searchPrefs.mode === 'proximity' && location.coords && searchPrefs.radius) {
      return `prox:${Number(location.coords.lat).toFixed(3)},${Number(location.coords.lng).toFixed(3)}:${searchPrefs.radius}`;
    }
    if (searchPrefs.mode === 'region' && searchPrefs.region) {
      return `reg:${searchPrefs.region}`;
    }
    return 'nationwide';
  }, [searchPrefs, location.coords]);

  const cacheKey = `discovery:feed:${gender}:${locScope}`;
  const [sections, setSections] = useState<SectionData[]>(() => {
    const memCached = apiCache.get<any>(cacheKey);
    if (memCached && Array.isArray(memCached.data?.sections)) return memCached.data.sections;
    try {
      const saved = localStorage.getItem(`${FEED_STORAGE_KEY}_${gender}_${locScope}`) ||
                    sessionStorage.getItem(`${FEED_STORAGE_KEY}_${gender}_${locScope}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          apiCache.set(cacheKey, parsed);
          return parsed.sections;
        }
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => sections.length === 0);
  const [feedError, setFeedError] = useState<ClassifiedError | null>(null);

  const fetchDiscoveryFeed = useCallback((activeGender: 'female' | 'male') => {
    setFeedError(null);
    const key = `discovery:feed:${activeGender}:${locScope}`;
    const cached = apiCache.get<any>(key);
    if (cached && Array.isArray(cached.data?.sections)) {
      setSections(cached.data.sections);
      setLoading(false);
      return;
    }

    setLoading(true);
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
          localStorage.setItem(`${FEED_STORAGE_KEY}_${activeGender}_${locScope}`, JSON.stringify(res.data));
          sessionStorage.setItem(`${FEED_STORAGE_KEY}_${activeGender}_${locScope}`, JSON.stringify(res.data));
        } catch {}
        if (Array.isArray(res.data?.sections)) {
          setSections(res.data.sections);
        }
        setFeedError(null);
      })
      .catch((err) => {
        const classified = classifyApiError(err);
        setFeedError(classified);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchPrefs, location.coords, locScope]);

  useEffect(() => {
    fetchDiscoveryFeed(gender);
  }, [fetchDiscoveryFeed, gender]);

  if (feedError && sections.length === 0) {
    return (
      <div className="w-full py-6 sm:py-8">
        <NetworkErrorState
          error={feedError}
          onRetry={() => fetchDiscoveryFeed(gender)}
          isRetrying={loading}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 sm:space-y-3 md:space-y-4">
      {feedError && sections.length > 0 && (
        <NetworkErrorState
          compact
          error={feedError}
          onRetry={() => fetchDiscoveryFeed(gender)}
          isRetrying={loading}
        />
      )}
      {/* Discovery Sections */}
      {loading && sections.length === 0 ? (
        DEFAULT_PREVIEW_SECTIONS.map((section) => (
          <DiscoveryShelf
            key={section.id}
            id={section.id}
            title={section.title}
            subtitle={section.subtitle}
            products={[]}
            loading={true}
            type={section.type}
          />
        ))
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
            gender={gender}
          />
        ))
      )}
    </div>
  );
};

export default DiscoveryFeed;
