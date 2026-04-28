import React, { useEffect, useState } from 'react';
import api from '../api';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';
import { Sparkles, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const PromotedProductsRow: React.FC = () => {
    const [promotions, setPromotions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/sponsored/?public=true')
            .then(res => {
                const data = res.data.results || res.data;
                // Filter for approved and non-expired is handled by backend but safety first
                setPromotions(Array.isArray(data) ? data : []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (!loading && promotions.length === 0) return null;

    return (
        <section className="mb-10 mt-2 px-1">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Featured Selections</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest -mt-0.5">Top picks from our community</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest cursor-pointer hover:gap-2 transition-all">
                    Explore All <ChevronRight size={14} />
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1 snap-x">
                {loading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="min-w-[200px] w-[200px] md:w-[240px]">
                            <ProductCardSkeleton viewMode="grid" />
                        </div>
                    ))
                ) : (
                    promotions.map((promo, idx) => (
                        <motion.div 
                            key={promo.id} 
                            className="min-w-[200px] w-[200px] md:w-[240px] snap-start"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            {/* We wrap ProductCard and inject some "Promoted" styling */}
                            <div className="relative group">
                                <ProductCard product={promo.product_details} viewMode="grid" />
                                <div className="absolute top-2 left-2 z-10">
                                    <span className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md text-[10px] font-black text-brand-600 px-2 py-0.5 rounded-full shadow-sm border border-brand-100 dark:border-brand-900/10 uppercase tracking-widest">
                                        Promoted
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </section>
    );
};

export default PromotedProductsRow;
