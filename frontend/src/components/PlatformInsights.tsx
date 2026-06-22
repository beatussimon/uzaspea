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
            <div className="w-full h-32 rounded-[2rem] bg-neutral-100 dark:bg-neutral-800/40 animate-pulse my-6" />
        );
    }

    if (!stats && trendingProducts.length === 0) return null;

    return (
        <div className="w-full space-y-12">
            {/* Live Stats Grid */}
            {stats && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-5"
                >
                    <div className="bg-white dark:bg-[#0A0A0A] p-6 rounded-2xl flex items-center gap-4 border border-neutral-100 dark:border-neutral-850/60 shadow-sm transition-all duration-300">
                        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-[11px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500 mb-0.5">Active Users</p>
                            <p className="font-black text-2xl text-neutral-900 dark:text-white leading-none">
                                {stats.active_users.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#0A0A0A] p-6 rounded-2xl flex items-center gap-4 border border-neutral-100 dark:border-neutral-850/60 shadow-sm transition-all duration-300">
                        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-[11px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500 mb-0.5">Weekly Visits</p>
                            <p className="font-black text-2xl text-neutral-900 dark:text-white leading-none">
                                {stats.weekly_visits > 1000 ? `${(stats.weekly_visits / 1000).toFixed(1)}K` : stats.weekly_visits}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#0A0A0A] p-6 rounded-2xl flex items-center gap-4 border border-neutral-100 dark:border-neutral-850/60 shadow-sm transition-all duration-300">
                        <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-2xl">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-[11px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500 mb-0.5">Products Sold</p>
                            <p className="font-black text-2xl text-neutral-900 dark:text-white leading-none">
                                {stats.products_sold.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Trending Products Grid */}
            {trendingProducts.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
                                <Flame size={16} className="text-orange-500" />
                            </div>
                            <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">Trending Right Now</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 p-4 md:p-5 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50">
                        {trendingProducts.slice(0, 4).map((product) => (
                            <div key={product.id} className="relative">
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
