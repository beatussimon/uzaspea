import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Flame, TrendingUp, Users, Package } from 'lucide-react';
import api from '../api';
import ProductCard from '../components/ProductCard';

const COLORS = ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'];

const TrendingPage: React.FC = () => {
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                // Fetch latest products as a proxy for trending
                const prodRes = await api.get('/api/products/?page=1');
                setProducts((prodRes.data.results || prodRes.data).slice(0, 8));

                const catRes = await api.get('/api/categories/');
                // Mock chart data based on categories
                const catData = (catRes.data.results || catRes.data).slice(0, 5).map((c: any) => ({
                    name: c.name,
                    value: Math.floor(Math.random() * 500) + 50
                }));
                setCategories(catData.sort((a: any, b: any) => b.value - a.value));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchTrending();
    }, []);

    if (loading) {
        return (
            <div className="container-page py-12 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="container-page py-8 space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                    <Flame size={24} className="text-orange-500 animate-pulse" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trending Now</h1>
                    <p className="text-sm text-gray-500">Platform analytics and popular items</p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500">Weekly Visits</p>
                        <p className="font-bold text-lg dark:text-white">24.5K</p>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg"><Users size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500">Active Users</p>
                        <p className="font-bold text-lg dark:text-white">8,204</p>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-lg"><Package size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500">Products Sold</p>
                        <p className="font-bold text-lg dark:text-white">1,402</p>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg"><Flame size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500">Hot Categories</p>
                        <p className="font-bold text-lg dark:text-white">{categories.length}</p>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-5">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-6">Top Categories by Interest</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categories} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1f2937', color: '#fff', border: 'none', borderRadius: '8px' }} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {categories.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="card p-5">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-6">Market Share</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={categories} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {categories.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', color: '#fff', border: 'none', borderRadius: '8px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Trending Products */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Trending Products</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {products.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
            </div>
        </div>
    );
};

export default TrendingPage;
