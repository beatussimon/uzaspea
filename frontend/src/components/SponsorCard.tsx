import { Link } from 'react-router-dom';
import { Megaphone, ArrowRight } from 'lucide-react';

export default function SponsorCard() {
  return (
    <Link
      to="/dashboard"
      className="group cursor-pointer flex flex-col items-center justify-center text-center
                 bg-gradient-to-br from-neutral-50 to-neutral-100/50
                 dark:from-neutral-900/10 dark:to-neutral-800/5
                 rounded-card p-6 border-2 border-dashed border-neutral-300
                 dark:border-neutral-800 hover:border-brand-500
                 dark:hover:border-brand-400 hover:shadow-card-hover hover:-translate-y-0.5
                 transition-all duration-300 min-h-[320px] h-full"
    >
      <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <Megaphone className="h-6 w-6 text-neutral-600 dark:text-neutral-300" />
      </div>

      <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200 mb-1 uppercase tracking-wide">
        Sponsor Your Item Here
      </h3>

      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-[180px] mb-4">
        Boost your listing visibility and reach more customers
      </p>

      <span className="inline-flex items-center gap-1 text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest group-hover:gap-2 transition-all">
        Get Started <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
