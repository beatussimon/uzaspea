import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { 
  Search, ChevronDown, X,
  Phone, Mail, MessageCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FeedbackModal } from '../../components/FeedbackModal';
import { motion, AnimatePresence } from 'framer-motion';

const HelpCenterPage: React.FC = () => {
    const { isAuthenticated } = useAuth();

    // FAQs state
    const [faqs, setFaqs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('all');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [loadingFaqs, setLoadingFaqs] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Site settings & Support Contacts
    const [siteSettings, setSiteSettings] = useState<any>({});

    // Modal state
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<'new' | 'history'>('new');
    const [modalDefaultCategory, setModalDefaultCategory] = useState<string>('other');

    // Ticket count for authenticated user
    const [userTicketCount, setUserTicketCount] = useState<number>(0);

    const faqCategories = [
        { id: 'all', label: 'All' },
        { id: 'orders', label: 'Orders & Delivery' },
        { id: 'payments', label: 'Payments' },
        { id: 'inspections', label: 'Inspections' },
        { id: 'account', label: 'Account' },
        { id: 'general', label: 'General' },
    ];

    useEffect(() => {
        api.get('/api/site-settings/').then(r => setSiteSettings(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        const fetchFaqs = async () => {
            setLoadingFaqs(true);
            try {
                const res = await api.get(`/api/faq/?q=${encodeURIComponent(searchQuery)}`);
                setFaqs(res.data.results || res.data || []);
            } catch (err) {
                console.error('Failed to fetch FAQs');
            } finally {
                setLoadingFaqs(false);
            }
        };
        fetchFaqs();
    }, [searchQuery]);

    const fetchTicketCount = async () => {
        if (!isAuthenticated) {
            setUserTicketCount(0);
            return;
        }
        try {
            const res = await api.get('/api/support-tickets/');
            const tickets = res.data.results || res.data || [];
            setUserTicketCount(tickets.length);
        } catch (err) {
            // Ignore if unauthorized
        }
    };

    useEffect(() => {
        fetchTicketCount();
    }, [isAuthenticated]);

    // Filter FAQs by category, but if searching, search matches take priority
    const filteredFaqs = useMemo(() => {
        if (selectedFaqCategory === 'all') return faqs;
        if (searchQuery.trim()) {
            const topicMatches = faqs.filter(faq => (faq.category || 'general').toLowerCase() === selectedFaqCategory.toLowerCase());
            return topicMatches.length > 0 ? topicMatches : faqs;
        }
        return faqs.filter(faq => (faq.category || 'general').toLowerCase() === selectedFaqCategory.toLowerCase());
    }, [faqs, selectedFaqCategory, searchQuery]);

    const openFeedbackModal = (tab: 'new' | 'history' = 'new', category: string = 'other') => {
        setModalTab(tab);
        setModalDefaultCategory(category);
        setIsFeedbackModalOpen(true);
    };

    const handleOpenSearch = () => {
        setIsSearchOpen(true);
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 100);
    };

    const handleCloseSearch = () => {
        setSearchQuery('');
        setIsSearchOpen(false);
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in text-gray-900 dark:text-gray-100">
            
            {/* Minimalist Hero Section */}
            <div className="text-center space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    How can we help?
                </h1>

                {/* Direct Clean Action Links */}
                <div className="flex items-center justify-center gap-5 pt-1 text-xs">
                    <button
                        type="button"
                        onClick={() => openFeedbackModal('new')}
                        className="font-semibold text-brand-600 dark:text-brand-400 hover:underline transition cursor-pointer"
                    >
                        Send us your feedback
                    </button>

                    {isAuthenticated && (
                        <button
                            type="button"
                            onClick={() => openFeedbackModal('history')}
                            className="font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <span>My Inquiries</span>
                            {userTicketCount > 0 && (
                                <span className="bg-brand-500 text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-none">
                                    {userTicketCount}
                                </span>
                            )}
                        </button>
                    )}

                    <Link
                        to="/blog"
                        className="font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                    >
                        Learn More &rarr;
                    </Link>
                </div>
            </div>

            {/* Search & Category Pills */}
            <div className="pt-1">
                {/* Desktop View (sm: and up): Category Pills on Left, Search Bar on Right Ready to Type */}
                <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4 py-1 select-none">
                    {/* Category Pills on Left */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
                        {faqCategories.map(cat => {
                            const isActive = selectedFaqCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedFaqCategory(cat.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                                        isActive
                                            ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                                            : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search Input on Right (Ready to Type) */}
                    <div className="relative w-48 lg:w-60 shrink-0">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search FAQs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-7 py-1.5 text-xs bg-white dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border rounded-full text-gray-900 dark:text-white placeholder-gray-400 outline-none ring-0 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white p-0.5 cursor-pointer"
                                aria-label="Clear search"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile View (< sm): Expandable Search Trigger on Left + Category Pills (Unchanged) */}
                <div className="flex sm:hidden items-center gap-2 overflow-x-auto py-1 scrollbar-none select-none">
                    <AnimatePresence initial={false}>
                        {isSearchOpen || searchQuery ? (
                            <motion.div
                                key="search-input-mobile"
                                initial={{ width: 32, opacity: 0 }}
                                animate={{ width: 180, opacity: 1 }}
                                exit={{ width: 32, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="relative flex items-center shrink-0"
                            >
                                <Search size={13} className="absolute left-2.5 text-gray-400 pointer-events-none" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search FAQs..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-7 pr-6 py-1.5 text-xs bg-white dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border rounded-full text-gray-900 dark:text-white placeholder-gray-400 outline-none ring-0 transition"
                                />
                                <button
                                    type="button"
                                    onClick={handleCloseSearch}
                                    className="absolute right-2 text-gray-400 hover:text-gray-700 dark:hover:text-white p-0.5 cursor-pointer"
                                    aria-label="Close search"
                                >
                                    <X size={12} />
                                </button>
                            </motion.div>
                        ) : (
                            <motion.button
                                key="search-button-mobile"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                type="button"
                                onClick={handleOpenSearch}
                                className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-[#161616] transition shrink-0 inline-flex items-center justify-center cursor-pointer"
                                title="Search FAQs"
                                aria-label="Open search"
                            >
                                <Search size={14} />
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* Category Pills on Mobile */}
                    <div className="flex items-center gap-1.5 shrink-0 transition-all">
                        {faqCategories.map(cat => {
                            const isActive = selectedFaqCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedFaqCategory(cat.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                                        isActive
                                            ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                                            : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* FAQ Accordion List with Soft Dividers */}
            <div className="space-y-0.5">
                <div className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {filteredFaqs.map(faq => {
                        const isOpen = expandedFaq === faq.id;
                        return (
                            <div key={faq.id} className="py-1 transition">
                                <button
                                    onClick={() => setExpandedFaq(isOpen ? null : faq.id)}
                                    className="w-full py-3 px-2 flex items-center justify-between text-left transition select-none group gap-3 rounded-lg hover:bg-surface-muted/50 dark:hover:bg-[#161616]/50 cursor-pointer"
                                >
                                    <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white group-hover:text-brand-500 dark:group-hover:text-brand-400 transition leading-snug">
                                        {faq.question}
                                    </span>
                                    <ChevronDown 
                                        size={15} 
                                        className={`text-gray-400 transition-transform duration-200 shrink-0 ${
                                            isOpen ? 'rotate-180 text-brand-500' : ''
                                        }`} 
                                    />
                                </button>
                                {isOpen && (
                                    <div className="px-2 pt-0.5 pb-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed animate-fade-in">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Empty State */}
                {filteredFaqs.length === 0 && !loadingFaqs && (
                    <div className="py-10 text-center space-y-2">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            No questions found {searchQuery ? `for "${searchQuery}"` : ''} in this topic.
                        </p>
                        <div className="flex items-center justify-center gap-3 text-xs">
                            <button
                                type="button"
                                onClick={() => openFeedbackModal('new')}
                                className="font-bold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                                <span>Send us your feedback &rarr;</span>
                            </button>
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchQuery(''); setSelectedFaqCategory('all'); }}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white cursor-pointer"
                                >
                                    Clear search
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Minimalist Human Footer Strip */}
            <div className="pt-6 border-t border-surface-border dark:border-surface-dark-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                <p className="text-center sm:text-left">
                    Can't find what you need?{' '}
                    <button
                        type="button"
                        onClick={() => openFeedbackModal('new')}
                        className="text-gray-900 dark:text-white hover:text-brand-500 dark:hover:text-brand-400 font-semibold underline underline-offset-4 cursor-pointer"
                    >
                        Send us your feedback
                    </button>
                </p>

                {/* Quick Contact Icons */}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    {siteSettings.support_email && (
                        <a 
                            href={`mailto:${siteSettings.support_email}`} 
                            className="hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 transition"
                        >
                            <Mail size={13} />
                            <span>{siteSettings.support_email}</span>
                        </a>
                    )}
                    {siteSettings.whatsapp_number && (
                        <a 
                            href={`https://wa.me/${siteSettings.whatsapp_number.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:text-emerald-500 dark:hover:text-emerald-400 flex items-center gap-1.5 transition"
                        >
                            <MessageCircle size={13} />
                            <span>WhatsApp</span>
                        </a>
                    )}
                    {siteSettings.support_phone && (
                        <a 
                            href={`tel:${siteSettings.support_phone}`} 
                            className="hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 transition"
                        >
                            <Phone size={13} />
                            <span>{siteSettings.support_phone}</span>
                        </a>
                    )}
                </div>
            </div>

            {/* Reusable Feedback & Support Popup Modal */}
            <FeedbackModal
                isOpen={isFeedbackModalOpen}
                onClose={() => setIsFeedbackModalOpen(false)}
                initialTab={modalTab}
                defaultCategory={modalDefaultCategory}
                onTicketCreated={() => {
                    fetchTicketCount();
                }}
            />
        </div>
    );
};

export default HelpCenterPage;
