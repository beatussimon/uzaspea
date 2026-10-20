import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import { apiCache } from '../../utils/apiCache';
import { useUserLocation } from '../../context/LocationContext';
import DiscoveryShelf from './DiscoveryShelf';
import NetworkErrorState from '../common/NetworkErrorState';
import { classifyApiError, ClassifiedError } from '../../utils/errorUtils';
import { getRecentProductIdsParam, getSavedVehicleId } from '../../utils/recentViews';
import { trackRecImpression } from '../../utils/recTracking';

interface SectionData {
  id: string;
  kind?: string;
  type: 'horizontal_shelf' | 'grid_shelf';
  title: string;
  subtitle?: string;
  category_slug?: string;
  gender_active?: 'female' | 'male';
  see_more_url?: string;
  paginated?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any[];
}

type Gender = 'female' | 'male' | '';

const FEED_STORAGE_KEY = 'uzaspea_discovery_feed_v3';

const DEFAULT_PREVIEW_SECTIONS: SectionData[] = [
  { id: 'preview_1', type: 'horizontal_shelf', title: 'Picked for you', subtitle: 'Loading your recommendations', products: [] },
  { id: 'preview_2', type: 'horizontal_shelf', title: 'Trending on SokoniMax', subtitle: 'Popular right now', products: [] },
  { id: 'preview_3', type: 'horizontal_shelf', title: 'Fresh Picks Across All Categories', subtitle: 'Just listed', products: [] },
];

export const DiscoveryFeed: React.FC = () => {
  const { location, searchPrefs } = useUserLocation();

  const [gender] = useState<Gender>(() => {
    const saved = localStorage.getItem('preferred_gender');
    return saved === 'female' || saved === 'male' ? saved : '';
  });

  const region = searchPrefs.region || location.region || '';
  const recentParam = getRecentProductIdsParam();
  const vehicleId = getSavedVehicleId();
  const cacheKey = `discovery:v3:${gender || 'auto'}:${region}:${vehicleId || ''}:${recentParam}`;

  const [sections, setSections] = useState<SectionData[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mem = apiCache.get<any>(cacheKey);
    if (mem && Array.isArray(mem.data?.sections)) return mem.data.sections;
    try {
      const saved = localStorage.getItem(FEED_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.data?.sections)) return parsed.data.sections;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => sections.length === 0);
  const [feedError, setFeedError] = useState<ClassifiedError | null>(null);

  const fetchFeed = useCallback(() => {
    setFeedError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = apiCache.get<any>(cacheKey);
    if (cached && Array.isArray(cached.data?.sections)) {
      setSections(cached.data.sections);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params: Record<string, string> = {};
    if (gender) params.gender = gender;
    if (region) params.region = region;
    if (recentParam) params.recent_ids = recentParam;
    if (vehicleId) params.vehicle_id = String(vehicleId);

    api.get('/api/products/discovery/', { params })
      .then((res) => {
        apiCache.set(cacheKey, res.data);
        try {
          localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify({ key: cacheKey, data: res.data }));
        } catch {
          // storage quota
        }
        const list: SectionData[] = Array.isArray(res.data?.sections) ? res.data.sections : [];
        setSections(list);
        const total = list.reduce((acc, s) => acc + (s.products?.length || 0), 0);
        if (total > 0) trackRecImpression('foryou', total);
      })
      .catch((err) => {
        setFeedError(classifyApiError(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [cacheKey, gender, region, recentParam, vehicleId]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  if (feedError && sections.length === 0) {
    return (
      <div className="w-full py-6 sm:py-8">
        <NetworkErrorState error={feedError} onRetry={fetchFeed} isRetrying={loading} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 sm:space-y-3 md:space-y-4">
      {feedError && sections.length > 0 && (
        <NetworkErrorState compact error={feedError} onRetry={fetchFeed} isRetrying={loading} />
      )}
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
            paginated={false}
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
            gender={section.gender_active || (gender || 'female')}
            paginated={section.paginated === true}
            trackSource="foryou"
          />
        ))
      )}
    </div>
  );
};

export default DiscoveryFeed;
