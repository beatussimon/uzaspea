import React, { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import ProductCard from './ProductCard';

const PlatformInsights: React.FC = () => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<any>(null);
    const [trendingProducts, setTrendingProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInsights = async () => {
            try {
                const res = await api.get('/api/analytics/trending/');
                setStats(res.data.stats);
                setTrendingProducts(res.data.trending_products || []);
            } catch (err) {
                console.error('Failed to fetch analytics', err);
            } finally {
                setLoading(false);
            }
        };
        fetchInsights();
    }, []);

    if (loading) {
        return (
            <div className="w-full h-32 rounded-[2rem] bg-neutral-100 dark:bg-neutral-800/40 animate-pulse my-6" />
        );
    }

    if (!stats && trendingProducts.length === 0) return null;

    return (
        <div className="w-full space-y-12">

            {/* Trending Products Grid */}
            {trendingProducts.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
                                <Flame size={16} className="text-orange-500" />
                            </div>
                            <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">{t('trending_right_now')}</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 p-4 md:p-5 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50">
                        {trendingProducts.slice(0, 4).map((product) => (
                            <div key={product.id} className="relative">
                                <ProductCard product={product} viewMode="grid" showTrendingMetrics={true} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformInsights;
