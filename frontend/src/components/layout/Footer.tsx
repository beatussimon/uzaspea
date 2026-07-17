import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

const Footer = () => {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    if (expanded && !settings.company_name) {
      api.get('/api/site-settings/').then(r => setSettings(r.data)).catch(() => {});
    }
  }, [expanded]);

  const handleToggle = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded) {
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  };

  return (
    <footer className="mt-auto border-t border-surface-border dark:border-surface-dark-border bg-white dark:bg-gray-800 transition-all duration-300">
      {/* Collapsed state — single line */}
      <div
        className="container-page flex items-center justify-between h-12 cursor-pointer select-none"
        onClick={handleToggle}
      >
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} SokoniMax. All rights reserved.</p>
        <button className={`text-gray-400 hover:text-gray-600 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="container-page pb-12 pt-8 border-t border-surface-border/50 dark:border-surface-dark-border/50 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 animate-slide-up">
          {/* Column 1: Brand & Bio */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-3">
            <h5 className="font-bold text-gray-900 dark:text-white text-base tracking-tight">SokoniMax</h5>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
              Your premier verified online marketplace for buying and selling in Tanzania. Quality products, secure logistics, and trusted local inspection.
            </p>
          </div>
          
          {/* Column 2: Shop & Explore */}
          <div className="col-span-1">
            <h5 className="font-bold text-gray-900 dark:text-white text-sm mb-3">Shop & Explore</h5>
            <ul className="space-y-2">
              <li><Link to="/" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition">Home Marketplace</Link></li>
              <li><Link to="/products" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition">All Products</Link></li>
              <li><Link to="/help" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition">How It Works</Link></li>
            </ul>
          </div>
          
          {/* Column 3: Customer Support */}
          <div className="col-span-1">
            <h5 className="font-bold text-gray-900 dark:text-white text-sm mb-3">Customer Support</h5>
            <ul className="space-y-2">
              <li><Link to="/help" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition">Help Center & FAQ</Link></li>
              <li><Link to="/orders" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition">Track My Order</Link></li>
              <li><Link to="/upgrade" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition">Become a Pro Seller</Link></li>
            </ul>
          </div>
          
          {/* Column 4: Stay Connected */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-3">
            <h5 className="font-bold text-gray-900 dark:text-white text-sm">Stay Connected</h5>
            <div className="flex gap-2">
              {settings.facebook_url && (
                <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 bg-neutral-100 hover:bg-brand-50 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded text-gray-500 hover:text-brand-600 transition text-xs font-semibold">Facebook</a>
              )}
              {settings.twitter_url && (
                <a href={settings.twitter_url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 bg-neutral-100 hover:bg-brand-50 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded text-gray-500 hover:text-brand-600 transition text-xs font-semibold">Twitter</a>
              )}
              {settings.instagram_url && (
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 bg-neutral-100 hover:bg-brand-50 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded text-gray-500 hover:text-brand-600 transition text-xs font-semibold">Instagram</a>
              )}
              {!settings.facebook_url && !settings.twitter_url && !settings.instagram_url && (
                <p className="text-xs text-gray-400">Social channels coming soon</p>
              )}
            </div>
            
            {/* Payment badge mockup */}
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block w-full mb-1">Supported Payments</span>
              <span className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-neutral-800 rounded font-black text-gray-500 dark:text-gray-400">M-PESA</span>
              <span className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-neutral-800 rounded font-black text-gray-500 dark:text-gray-400">TIGO PESA</span>
              <span className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-neutral-800 rounded font-black text-gray-500 dark:text-gray-400">AIRTEL MONEY</span>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
