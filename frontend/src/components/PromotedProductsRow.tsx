import React, { useEffect, useState } from 'react';
import api from '../api';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';
import { Sparkles, ChevronRight } from 'lucide-react';

const PromotedProductsRow: React.FC = () => {
    const [promotions, setPromotions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const VISIBLE = 8;

    useEffect(() => {
        api.get('/api/sponsored/?public=true')
            .then(res => {
                const data = res.data.results || res.data;
                setPromotions(Array.isArray(data) ? data.slice(0, VISIBLE) : []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (!loading && promotions.length === 0) return null;

    return (
        <section className="mb-10 mt-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            Featured Selections
                        </h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest -mt-0.5">
                            Sponsored · Top picks from our community
                        </p>
                    </div>
                </div>
                <button className="flex items-center gap-1 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest hover:gap-2 transition-all">
                    View All <ChevronRight size={14} />
                </button>
            </div>

            {/* Grid — 2 cols mobile, 3 tablet, 4 desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {loading
                    ? [...Array(4)].map((_, i) => (
                        <div key={i} className="relative">
                            <ProductCardSkeleton viewMode="grid" />
                        </div>
                    ))
                    : promotions.map((promo) => (
                        <div key={promo.id} className="relative group">
                            <ProductCard product={promo.product_details} viewMode="grid" />
                            {/* Sponsored badge */}
                            <div className="absolute top-2 left-2 z-10 pointer-events-none">
                                <span className="bg-brand-600/90 backdrop-blur-sm text-[9px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                                    Sponsored
                                </span>
                            </div>
                        </div>
                    ))
                }
            </div>
        </section>
    );
};

export default PromotedProductsRow;
