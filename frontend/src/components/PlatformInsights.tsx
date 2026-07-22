import React, { useState, useEffect } from 'react';
import { Flame, Star, Zap, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import ProductCard from './ProductCard';

interface PlatformInsightsProps {
    /** Pre-fetched stats to avoid duplicate API call */
    stats?: any;
    /** Pre-fetched trending groups to avoid duplicate API call */
    trendingGroups?: any;
}

const PlatformInsights: React.FC<PlatformInsightsProps> = ({ stats: propStats, trendingGroups: propTrendingGroups }) => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<any>(propStats || null);
    const [trendingGroups, setTrendingGroups] = useState<any>(propTrendingGroups || {
        top_sellers: [],
        most_saved: [],
        newest_trending: []
    });
    const [loading, setLoading] = useState(!propStats && !propTrendingGroups);

    useEffect(() => {
        // Skip fetch if data was passed via props
        if (propStats || propTrendingGroups) {
            setLoading(false);
            return;
        }

        const fetchInsights = async () => {
            try {
                const res = await api.get('/api/analytics/trending/');
                setStats(res.data.stats);
                setTrendingGroups(res.data.trending_products || { top_sellers: [], most_saved: [], newest_trending: [] });
            } catch (err) {
                console.error('Failed to fetch analytics', err);
            } finally {
                setLoading(false);
            }
        };
        fetchInsights();
    }, []);

    // Update from props if they change
    useEffect(() => {
        if (propStats) setStats(propStats);
    }, [propStats]);

    useEffect(() => {
        if (propTrendingGroups) {
            setTrendingGroups(propTrendingGroups);
            setLoading(false);
        }
    }, [propTrendingGroups]);

    if (loading) {
        return (
            <div className="w-full h-32 rounded-[2rem] bg-neutral-100 dark:bg-neutral-800/40 animate-pulse my-6" />
        );
    }

    const hasAnyTrending = 
        trendingGroups.top_sellers?.length > 0 || 
        trendingGroups.most_saved?.length > 0 || 
        trendingGroups.newest_trending?.length > 0;

    if (!stats && !hasAnyTrending) return null;

    const renderRow = (title: string, icon: React.ReactNode, products: any[], metricType: string) => {
        if (!products || products.length === 0) return null;
        
        return (
            <div className="space-y-4 mb-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
                        {icon}
                    </div>
                    <h3 className="font-black text-lg md:text-xl text-gray-900 dark:text-white uppercase tracking-tight">{title}</h3>
                </div>

                {/* Mobile scrollable row, Desktop grid */}
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:pb-0 scrollbar-hide md:grid md:grid-cols-4 md:gap-5">
                    {products.slice(0, 4).map((product) => (
                        <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px] md:w-auto relative h-full">
                            <ProductCard product={product} viewMode="grid" showTrendingMetrics={metricType} />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full space-y-8">
            {/* Trending Products Sections */}
            {hasAnyTrending && (
                <div className="p-4 md:p-6 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50">
                    <div className="flex items-center gap-3 mb-8">
                        <Flame size={24} className="text-orange-500" />
                        <h2 className="font-black text-2xl text-gray-900 dark:text-white uppercase tracking-tight">{t('trending_right_now', 'Trending Right Now')}</h2>
                    </div>

                    {renderRow(t('top_sellers', 'Top Sellers'), <Zap size={16} className="text-orange-500" />, trendingGroups.top_sellers, 'sales')}
                    {renderRow(t('most_saved', 'Most Saved'), <Star size={16} className="text-orange-500" />, trendingGroups.most_saved, 'saves')}
                    {renderRow(t('newest_trending', 'New & Trending'), <Clock size={16} className="text-orange-500" />, trendingGroups.newest_trending, 'newest')}
                </div>
            )}
        </div>
    );
};

export default PlatformInsights;
