import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProductCard from './ProductCard';
import SponsorCard from './SponsorCard';
import { ProductCardSkeleton } from './Skeleton';

interface PromotedProductsRowProps {
    promotions: any[];
    loading: boolean;
}

const PromotedProductsRow: React.FC<PromotedProductsRowProps> = ({ promotions, loading }) => {
    const { t } = useTranslation();

    const categoryGroups = useMemo(() => {
        if (!promotions || promotions.length === 0) return [];
        
        const groups: Record<string, any[]> = {};
        promotions.forEach(promo => {
            if (promo.product_details && promo.product_details.category_name) {
                const catName = promo.product_details.category_name;
                if (!groups[catName]) groups[catName] = [];
                groups[catName].push(promo);
            }
        });

        // Sort by number of items and take top 4 categories
        return Object.entries(groups)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 4);
    }, [promotions]);

    if (!loading && (!promotions || promotions.length === 0)) return null;

    return (
        <section className="w-full space-y-4 md:space-y-6">
            <div className="flex justify-between items-end mb-2">
                <div>
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                        <Star className="text-brand-500" size={24} />
                        {t('featured_listings', 'Featured Listings')}
                    </h2>
                </div>
                <Link to="/products" className="text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-wider flex items-center gap-1 hover:underline mb-1">
                    {t('view_all_products', 'View all')} <ArrowRight className="h-4 w-4" />
                </Link>
            </div>

            {loading ? (
                <div className="flex overflow-x-auto gap-4 pb-4 md:pb-0 md:grid md:grid-cols-4 md:gap-5 scrollbar-hide">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="shrink-0 w-[260px] sm:w-[280px] md:w-auto">
                            <ProductCardSkeleton viewMode="grid" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-6">
                    {categoryGroups.length > 0 ? (
                        categoryGroups.map(([catName, promos]) => (
                            <div key={catName} className="space-y-2">
                                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                                    {t('featured', 'Featured')} {catName}
                                </h3>
                                <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:pb-0 scrollbar-hide md:grid md:grid-cols-4 md:gap-5 p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none">
                                    {promos.slice(0, 4).map((promo) => (
                                        <div key={promo.id} className="snap-start shrink-0 w-[260px] sm:w-[280px] md:w-auto relative h-full">
                                            <ProductCard product={promo.product_details} viewMode="grid" isSponsored={true} />
                                        </div>
                                    ))}
                                    {/* Pad with SponsorCards if less than 4 */}
                                    {Array.from({ length: Math.max(0, 4 - promos.slice(0, 4).length) }).map((_, i) => (
                                        <div key={`sponsor-placeholder-${catName}-${i}`} className="snap-start shrink-0 w-[260px] sm:w-[280px] md:w-auto relative h-full">
                                            <SponsorCard />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:pb-0 scrollbar-hide md:grid md:grid-cols-4 md:gap-5 p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={`sponsor-placeholder-empty-${i}`} className="snap-start shrink-0 w-[260px] sm:w-[280px] md:w-auto relative h-full">
                                    <SponsorCard />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default PromotedProductsRow;
