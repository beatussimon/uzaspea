import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import SafeImage from './SafeImage';

export interface APlusModule {
  id?: string;
  type: 'hero_banner' | 'feature_right' | 'feature_left' | 'infographic' | 'claim_banner' | 'cards';
  image?: string;
  headline?: string;
  body?: string;
  subheadline?: string;
  claim_number?: string;
  claim_footnote?: string;
  cards?: Array<{
    image?: string;
    title: string;
    description: string;
  }>;
}

export interface APlusContentProps {
  product: {
    name: string;
    description?: string;
    brand_name?: string;
    brand_details?: { name: string; logo?: string; slug?: string };
    images?: Array<{ id: number | string; image: string }>;
    has_a_plus_content?: boolean;
    a_plus_content?: {
      enabled?: boolean;
      company_logo?: string;
      headline?: string;
      modules?: APlusModule[];
    };
    specifications?: Record<string, any>;
    structured_specs?: Record<string, any>;
  };
  mode?: 'desktop_tab' | 'mobile_accordion';
  className?: string;
}

export const APlusContent: React.FC<APlusContentProps> = ({
  product,
  mode = 'desktop_tab',
  className = '',
}) => {
  const { t } = useTranslation();
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const aPlusData = product.a_plus_content;
  const modules: APlusModule[] = aPlusData?.modules && aPlusData.modules.length > 0
    ? aPlusData.modules
    : [];

  // Fallback module if enabled by seller but modules array is empty
  const effectiveModules: APlusModule[] = modules.length > 0
    ? modules
    : [
        {
          type: 'hero_banner',
          image: product.images?.[0]?.image || '',
          headline: product.name,
          body: product.description || '',
        },
      ];

  const brandName = product.brand_details?.name || product.brand_name;
  const brandLogo = product.brand_details?.logo || aPlusData?.company_logo;

  const renderModule = (mod: APlusModule, idx: number) => {
    switch (mod.type) {
      case 'hero_banner':
        return (
          <div key={`mod-${idx}`} className="relative rounded-2xl overflow-hidden bg-neutral-900 text-white shadow-sm my-4">
            {mod.image && (
              <div className="w-full aspect-[16/9] sm:aspect-[21/9] max-h-[420px] relative overflow-hidden">
                <SafeImage
                  src={mod.image}
                  alt={mod.headline || product.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
              </div>
            )}
            {(mod.headline || mod.body) && (
              <div className={mod.image ? 'absolute bottom-0 left-0 right-0 p-5 sm:p-8' : 'p-6 sm:p-8'}>
                {mod.headline && (
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-white mb-2 leading-tight">
                    {mod.headline}
                  </h3>
                )}
                {mod.body && (
                  <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed max-w-2xl whitespace-pre-line font-medium">
                    {mod.body}
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'feature_right':
        // Image Left, Text Right (Laneige: Jar Left, Text Right)
        return (
          <div
            key={`mod-${idx}`}
            className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 my-6 sm:my-8 py-2"
          >
            {mod.image && (
              <div className="w-full md:w-1/2 aspect-square max-h-[360px] rounded-2xl overflow-hidden bg-neutral-50 dark:bg-neutral-900/60 shrink-0">
                <SafeImage
                  src={mod.image}
                  alt={mod.headline || ''}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="w-full md:w-1/2 flex flex-col justify-center space-y-2.5">
              {mod.headline && (
                <h4 className="text-lg sm:text-xl font-black uppercase tracking-tight text-neutral-900 dark:text-white leading-snug">
                  {mod.headline}
                </h4>
              )}
              {mod.body && (
                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                  {mod.body}
                </p>
              )}
            </div>
          </div>
        );

      case 'feature_left':
        // Text Left, Image Right (Laneige: Text Left, Swatch Right)
        return (
          <div
            key={`mod-${idx}`}
            className="flex flex-col-reverse md:flex-row items-center gap-6 sm:gap-8 my-6 sm:my-8 py-2"
          >
            <div className="w-full md:w-1/2 flex flex-col justify-center space-y-2.5">
              {mod.headline && (
                <h4 className="text-lg sm:text-xl font-black uppercase tracking-tight text-neutral-900 dark:text-white leading-snug">
                  {mod.headline}
                </h4>
              )}
              {mod.body && (
                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                  {mod.body}
                </p>
              )}
            </div>
            {mod.image && (
              <div className="w-full md:w-1/2 aspect-square max-h-[360px] rounded-2xl overflow-hidden bg-neutral-50 dark:bg-neutral-900/60 shrink-0">
                <SafeImage
                  src={mod.image}
                  alt={mod.headline || ''}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        );

      case 'infographic':
        // Full width composite promotional graphic
        return (
          <div key={`mod-${idx}`} className="my-4 rounded-2xl overflow-hidden shadow-sm">
            {mod.image && (
              <SafeImage
                src={mod.image}
                alt={mod.headline || product.name}
                className="w-full h-auto object-cover rounded-2xl"
              />
            )}
            {mod.headline && (
              <p className="text-xs text-neutral-500 text-center mt-2 font-medium">
                {mod.headline}
              </p>
            )}
          </div>
        );

      case 'claim_banner':
        // Claim / Stat module (Laneige: "100% Agreed it improved brightness")
        return (
          <div
            key={`mod-${idx}`}
            className="my-6 p-6 sm:p-8 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 text-center flex flex-col items-center justify-center space-y-2"
          >
            {mod.claim_number && (
              <span className="text-4xl sm:text-5xl font-black text-brand-600 dark:text-brand-400 tracking-tight">
                {mod.claim_number}
              </span>
            )}
            {mod.headline && (
              <h4 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white max-w-xl">
                {mod.headline}
              </h4>
            )}
            {mod.body && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md">
                {mod.body}
              </p>
            )}
            {mod.claim_footnote && (
              <span className="text-[10px] text-neutral-400 italic mt-2 block">
                *{mod.claim_footnote}
              </span>
            )}
          </div>
        );

      case 'cards':
        // Multi-feature cards
        return (
          <div key={`mod-${idx}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
            {(mod.cards || []).map((card, cIdx) => (
              <div
                key={`card-${cIdx}`}
                className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 space-y-2 flex flex-col"
              >
                {card.image && (
                  <div className="w-full aspect-[4/3] rounded-lg overflow-hidden mb-2">
                    <SafeImage src={card.image} alt={card.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <h5 className="font-bold text-sm text-neutral-900 dark:text-white">{card.title}</h5>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  // Mobile Accordion View
  if (mode === 'mobile_accordion') {
    return (
      <div className={`w-full py-4 border-t border-neutral-200 dark:border-neutral-800 ${className}`}>
        <button
          type="button"
          onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          className="w-full flex items-center justify-between py-2 text-left group"
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-neutral-900 dark:text-white tracking-tight">
              {t('from_the_manufacturer', 'From the manufacturer')}
            </span>
            {brandName && (
              <span className="text-xs font-semibold text-neutral-400">
                • {brandName}
              </span>
            )}
          </div>
          <div className="p-1 rounded-full text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white transition">
            {isMobileExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {isMobileExpanded && (
          <div className="pt-4 space-y-6 animate-fade-in">
            {/* Brand Header Badge */}
            {brandName && (
              <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
                {brandLogo && (
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0">
                    <SafeImage src={brandLogo} alt={brandName} className="w-full h-full object-cover" />
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
                    {t('brand_story', 'Brand Story')}
                  </span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    {brandName}
                  </span>
                </div>
              </div>
            )}

            {/* Modules */}
            {effectiveModules.map((mod, idx) => renderModule(mod, idx))}
          </div>
        )}
      </div>
    );
  }

  // Desktop Tab View
  return (
    <div className={`w-full lg:px-6 pb-6 space-y-6 animate-fade-in ${className}`}>
      {/* Brand Header Banner */}
      {brandName && (
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800/60">
          <div className="flex items-center gap-3">
            {brandLogo && (
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0">
                <SafeImage src={brandLogo} alt={brandName} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400 block">
                {t('official_brand_content', 'Official Brand Story')}
              </span>
              <span className="text-base font-extrabold text-neutral-900 dark:text-white">
                {brandName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
            <ShieldCheck size={14} />
            <span>{t('verified_manufacturer_content', 'Verified Content')}</span>
          </div>
        </div>
      )}

      {/* Render Modules sequentially */}
      <div className="space-y-6">
        {effectiveModules.map((mod, idx) => renderModule(mod, idx))}
      </div>
    </div>
  );
};

export default APlusContent;
