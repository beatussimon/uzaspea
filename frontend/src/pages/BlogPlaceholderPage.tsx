import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles, ArrowLeft, HelpCircle, ShoppingBag, Bell, Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';

const BlogPlaceholderPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12 animate-fade-in">
      {/* Back button */}
      <div>
        <Link 
          to="/help" 
          className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
        >
          <ArrowLeft size={14} /> Back to Help Center
        </Link>
      </div>

      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold ring-1 ring-brand-500/20 select-none">
          <Sparkles size={14} />
          <span>SokoniMax Blog & Guides &bull; Coming Soon</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Insights, Stories & Marketplace Guides
        </h1>

        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          We are crafting in-depth articles, seller success playbooks, safe trading guides, and ecommerce insights to empower buyers and sellers across Tanzania.
        </p>
      </div>

      {/* Upcoming Topics Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="card p-6 border border-surface-border dark:border-surface-dark-border space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Compass size={20} />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Seller Growth & Tactics</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Tips on optimizing listings, inventory management, and maximizing sales volume through verified seller channels.
          </p>
        </div>

        <div className="card p-6 border border-surface-border dark:border-surface-dark-border space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <BookOpen size={20} />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Inspection & Trust</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Behind the scenes of our certified inspection process, fraud prevention mechanisms, and escrow guarantee.
          </p>
        </div>

        <div className="card p-6 border border-surface-border dark:border-surface-dark-border space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Bell size={20} />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Platform News & Updates</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Official announcements, new logistics partner integrations, mobile money features, and policy upgrades.
          </p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="p-8 rounded-2xl bg-gradient-to-br from-surface-muted/60 to-surface-muted dark:from-[#111] dark:to-[#161616] border border-surface-border dark:border-surface-dark-border text-center space-y-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          Looking for assistance right now?
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Visit our Help Center for instant solutions, or explore thousands of verified listings on the marketplace.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/help">
            <Button size="sm" className="text-xs font-bold gap-2">
              <HelpCircle size={14} /> Go to Help & FAQ
            </Button>
          </Link>
          <Link to="/products">
            <button className="btn-secondary text-xs font-bold py-2.5 px-4 inline-flex items-center gap-2">
              <ShoppingBag size={14} /> Browse Marketplace
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BlogPlaceholderPage;
