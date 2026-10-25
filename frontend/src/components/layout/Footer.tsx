import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SiFacebook, SiX, SiInstagram, SiYoutube, SiRumble, SiKick } from 'react-icons/si';
import api from '../../api';
import { useUserRoles } from '../../context/AuthContext';

const Footer = () => {
  const { t } = useTranslation();
  const roles = useUserRoles();
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
    <footer className="mt-auto bg-white dark:bg-gray-800 transition-all duration-300">
      {/* Collapsed state — single line */}
      <div
        className="container-page flex items-center justify-between h-12 cursor-pointer select-none"
        onClick={handleToggle}
      >
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} SokoniMax. {t('all_rights_reserved', 'All rights reserved.')}</p>
        <button className={`text-gray-400 hover:text-gray-600 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} aria-label="Toggle footer">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="container-page pb-8 pt-2.5 md:pb-10 md:pt-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 md:gap-y-6 animate-slide-up text-center md:text-left">
          {/* Column 1: Brand & Bio */}
          <div className="col-span-2 md:col-span-1 flex flex-col items-center md:items-start justify-center md:justify-start gap-1.5">
            <h5 className="font-bold text-gray-900 dark:text-white text-base tracking-tight">SokoniMax</h5>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm md:max-w-xs mx-auto md:mx-0">
              {t('marketplace_desc', 'Your premier verified online marketplace for buying and selling in Tanzania. Quality products, secure logistics, and trusted local inspection.')}
            </p>
          </div>
          
          {/* Column 2: Shop & Explore */}
          <div className="col-span-1 flex flex-col items-center md:items-start">
            <h5 className="font-bold text-gray-900 dark:text-white text-sm mb-2">{t('shop_and_explore', 'Shop & Explore')}</h5>
            <ul className="space-y-1.5 flex flex-col items-center md:items-start">
              <li><Link to="/" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-500 transition">{t('home_marketplace', 'Home Marketplace')}</Link></li>
              <li><Link to="/products" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-500 transition">{t('all_products', 'All Products')}</Link></li>
              <li><Link to="/help" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-500 transition">{t('how_it_works', 'How It Works')}</Link></li>
            </ul>
          </div>
          
          {/* Column 3: Customer Support */}
          <div className="col-span-1 flex flex-col items-center md:items-start">
            <h5 className="font-bold text-gray-900 dark:text-white text-sm mb-2">{t('customer_support', 'Customer Support')}</h5>
            <ul className="space-y-1.5 flex flex-col items-center md:items-start">
              <li><Link to="/help" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-500 transition">{t('help_center_faq', 'Help Center & FAQ')}</Link></li>
              <li><Link to="/orders" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-500 transition">{t('track_my_order', 'Track My Order')}</Link></li>
              <li><Link to={roles.isPureCustomer ? "/help?tab=site-verification" : "/upgrade"} className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-500 transition">{t('become_a_pro_seller', 'Become a Pro Seller')}</Link></li>
            </ul>
          </div>
          
          {/* Column 4: Stay Connected */}
          <div className="col-span-2 md:col-span-1 flex flex-col items-center md:items-start justify-center md:justify-start gap-2">
            <h5 className="font-bold text-gray-900 dark:text-white text-sm">{t('stay_connected', 'Stay Connected')}</h5>
            <div className="flex flex-wrap gap-2 items-center justify-center md:justify-start pt-1">
              <a
                href={settings.facebook_url || 'https://facebook.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-[#1877F2] text-white flex items-center justify-center hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-xs"
                title="Facebook"
                aria-label="Facebook"
              >
                <SiFacebook size={18} />
              </a>
              <a
                href={settings.twitter_url || 'https://x.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-white text-black border border-gray-200 dark:border-neutral-700 flex items-center justify-center hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-xs"
                title="X"
                aria-label="X"
              >
                <SiX size={15} />
              </a>
              <a
                href={settings.instagram_url || 'https://instagram.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white flex items-center justify-center hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-xs"
                title="Instagram"
                aria-label="Instagram"
              >
                <SiInstagram size={18} />
              </a>
              <a
                href={settings.youtube_url || 'https://youtube.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-[#FF0000] text-white flex items-center justify-center hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-xs"
                title="YouTube"
                aria-label="YouTube"
              >
                <SiYoutube size={18} />
              </a>
              <a
                href={settings.rumble_url || 'https://rumble.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-[#85c742] text-white flex items-center justify-center hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-xs"
                title="Rumble"
                aria-label="Rumble"
              >
                <SiRumble size={17} />
              </a>
              <a
                href={settings.kick_url || 'https://kick.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-[#53FC18] text-black flex items-center justify-center hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-xs"
                title="Kick"
                aria-label="Kick"
              >
                <SiKick size={16} />
              </a>
            </div>
            
            {/* Payment badge mockup */}
            <div className="mt-2 flex flex-wrap gap-2 items-center justify-center md:justify-start">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block w-full mb-1 text-center md:text-left">{t('supported_payments', 'Supported Payments')}</span>
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
