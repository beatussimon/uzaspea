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

  return (
    <footer className="mt-auto border-t border-surface-border dark:border-surface-dark-border bg-white dark:bg-gray-800 transition-all duration-300">
      {/* Collapsed state — single line */}
      <div
        className="container-page flex items-center justify-between h-12 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} SokoniMax. All rights reserved.</p>
        <button className={`text-gray-400 hover:text-gray-600 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="container-page pb-6 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-surface-border/50 dark:border-surface-dark-border/50 pt-4 animate-slide-up">
          <div>
            <h5 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">About SokoniMax</h5>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Your premier online marketplace for buying and selling in Tanzania.</p>
          </div>
          <div>
            <h5 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">Quick Links</h5>
            <ul className="space-y-1">
              <li><Link to="/" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 transition">Home</Link></li>
              <li><Link to="/products" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 transition">Products</Link></li>
              <li><Link to="/help" className="text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 transition">Help & Support</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">Connect With Us</h5>
            <div className="flex gap-3">
              {settings.facebook_url && (
                <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-brand-600 transition">Facebook</a>
              )}
              {settings.twitter_url && (
                <a href={settings.twitter_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-brand-600 transition">Twitter</a>
              )}
              {settings.instagram_url && (
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-brand-600 transition">Instagram</a>
              )}
              {!settings.facebook_url && !settings.twitter_url && !settings.instagram_url && (
                <p className="text-xs text-gray-400">Social links coming soon</p>
              )}
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
