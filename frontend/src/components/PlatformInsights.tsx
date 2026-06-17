import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Package, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api';
import ProductCard from './ProductCard';

const PlatformInsights: React.FC = () => {
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
            <div className="w-full h-32 rounded-[2rem] bg-gray-100 dark:bg-gray-800 animate-pulse my-6" />
        );
    }

    if (!stats && trendingProducts.length === 0) return null;

    return (
        <div className="w-full mb-8 mt-2 space-y-6">
            {/* Live Stats Row */}
            {stats && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2"
                >
                    <div className="card p-3 min-w-[140px] flex items-center gap-3 shrink-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-sm border border-brand-100 dark:border-brand-900/30">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                            <Users size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Active Users</p>
                            <p className="font-black text-sm dark:text-white">{stats.active_users.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="card p-3 min-w-[140px] flex items-center gap-3 shrink-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-sm border border-brand-100 dark:border-brand-900/30">
                        <div className="p-2 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-lg">
                            <TrendingUp size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Weekly Visits</p>
                            <p className="font-black text-sm dark:text-white">
                                {stats.weekly_visits > 1000 ? `${(stats.weekly_visits / 1000).toFixed(1)}K` : stats.weekly_visits}
                            </p>
                        </div>
                    </div>

                    <div className="card p-3 min-w-[140px] flex items-center gap-3 shrink-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-sm border border-brand-100 dark:border-brand-900/30">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg">
                            <Package size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Products Sold</p>
                            <p className="font-black text-sm dark:text-white">{stats.products_sold.toLocaleString()}</p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Trending Products Carousel */}
            {trendingProducts.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Flame size={16} className="text-orange-500" />
                            </div>
                            <h3 className="font-black text-lg text-gray-900 dark:text-white">Trending Right Now</h3>
                        </div>
                    </div>

                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x items-stretch">
                        {trendingProducts.map((product) => (
                            <div key={product.id} className="w-[160px] md:w-[200px] snap-start shrink-0 h-full">
                                <ProductCard product={product} viewMode="grid" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformInsights;
