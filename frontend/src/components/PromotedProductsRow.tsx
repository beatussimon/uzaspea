import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ProductCard from './ProductCard';
import SponsorCard from './SponsorCard';
import { ProductCardSkeleton } from './Skeleton';

interface PromotedProductsRowProps {
    promotions: any[];
    loading: boolean;
}

const PromotedProductsRow: React.FC<PromotedProductsRowProps> = ({ promotions, loading }) => {
    return (
        <section className="w-full">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Featured Listings</h2>
                </div>
                <Link to="/products" className="text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-wider flex items-center gap-1 hover:underline">
                    View all products <ArrowRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {loading ? (
                    [...Array(8)].map((_, i) => (
                        <div key={i} className="relative">
                            <ProductCardSkeleton viewMode="grid" />
                        </div>
                    ))
                ) : (
                    <>
                        {promotions.slice(0, 8).map((promo) => (
                            <div key={promo.id} className="relative group">
                                <ProductCard product={promo.product_details} viewMode="grid" isSponsored={true} />
                            </div>
                        ))}
                        {Array.from({ length: Math.max(0, 8 - promotions.slice(0, 8).length) }).map((_, i) => (
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
