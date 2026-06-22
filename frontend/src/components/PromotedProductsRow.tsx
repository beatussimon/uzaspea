import React, { useEffect, useState } from 'react';
import api from '../api';
import ProductCard from './ProductCard';
import SponsorCard from './SponsorCard';
import { ProductCardSkeleton } from './Skeleton';

const PromotedProductsRow: React.FC = () => {
    const [promotions, setPromotions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/sponsored/?public=true')
            .then(res => {
                const data = res.data.results || res.data;
                setPromotions(Array.isArray(data) ? data : []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <section className="w-full">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Featured Listings</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest -mt-0.5">Premium placements and handpicked recommendations</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {loading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="relative">
                            <ProductCardSkeleton viewMode="grid" />
                        </div>
                    ))
                ) : (
                    <>
                        {promotions.slice(0, 4).map((promo) => (
                            <div key={promo.id} className="relative group">
                                <ProductCard product={promo.product_details} viewMode="grid" isSponsored={true} />
                            </div>
                        ))}
                        {Array.from({ length: Math.max(0, 4 - promotions.slice(0, 4).length) }).map((_, i) => (
                            <div key={`sponsor-placeholder-${i}`} className="relative h-full">
                                <SponsorCard />
                            </div>
                        ))}
                    </>
                )}
            </div>
        </section>
    );
};

export default PromotedProductsRow;
