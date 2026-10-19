import { Link } from 'react-router-dom';
import { Megaphone, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function SponsorCard() {
  const { t } = useTranslation();

  return (
    <Link
      to="/dashboard/promotions?tab=sponsored&new=true"
      className="group cursor-pointer flex flex-col items-center justify-center text-center
                 bg-surface-muted/60 dark:bg-[#0A0A0A]
                 rounded-card p-6 border-2 border-dashed border-surface-border
                 dark:border-surface-dark-border hover:border-gray-400
                 dark:hover:border-neutral-700 hover:shadow-card-hover active:scale-[0.98]
                 transition-all duration-300 min-h-[320px] h-full"
    >
      <div className="w-12 h-12 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <Megaphone className="h-6 w-6 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
      </div>

      <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1 uppercase tracking-wide">
        {t('sponsor_your_item_here', 'Sponsor Your Item Here')}
      </h3>

      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-[200px] mb-4">
        {t('boost_your_listing', 'Boost your listing visibility and reach more buyers across Tanzania')}
      </p>

      <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-gray-500 dark:text-gray-400 group-hover:text-brand-500 dark:group-hover:text-brand-400 uppercase tracking-widest group-hover:gap-2.5 transition-all">
        {t('boost_now', 'Boost Now')} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
