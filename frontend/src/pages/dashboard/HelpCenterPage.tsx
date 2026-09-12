import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { Search, ChevronDown, ChevronRight, X, Phone, Mail, MessageCircle, BookOpen } from 'lucide-react';
import { SiWhatsapp, SiInstagram, SiFacebook, SiTiktok, SiX, SiYoutube } from 'react-icons/si';
import { FaLinkedin } from 'react-icons/fa';
import { useAuth, useUserRoles } from '../../context/AuthContext';
import { FeedbackModal } from '../../components/FeedbackModal';
import { motion, AnimatePresence } from 'framer-motion';

const ensureUrl = (url?: string, prefix = 'https://') => {
    if (!url) return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `${prefix}${trimmed}`;
};

const resolveWhatsAppUrl = (input?: string): string => {
    if (!input) return '';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)/i.test(trimmed)) return `https://${trimmed}`;
    let digits = trimmed.replace(/[^0-9]/g, '');
    if (digits.startsWith('0') && digits.length === 10) {
        digits = `255${digits.slice(1)}`;
    }
    return `https://wa.me/${digits}`;
};

const HelpCenterPage: React.FC = () => {
    const { isAuthenticated, user } = useAuth();
    const roles = useUserRoles();
    const isSellerOrBusiness = isAuthenticated && !roles.isPureCustomer;
    const shouldShowSellerOnboarding = !isSellerOrBusiness;

    const firstName = useMemo(() => {
        if (!isAuthenticated || !user) return '';
        if (user.first_name && user.first_name.trim()) {
            return user.first_name.trim();
        }
        if (user.username && user.username.trim()) {
            const clean = user.username.trim().split(/[._\s-]/)[0];
            return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : '';
        }
        return '';
    }, [isAuthenticated, user]);

    const [searchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');

    // FAQs state
    const [faqs, setFaqs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileFabOpen, setIsMobileFabOpen] = useState(false);
    const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>(() => {
        if (tabParam === 'site-verification') return 'site-verification';
        return 'all';
    });
    const [expandedFaq, setExpandedFaq] = useState<number | null | 'closed'>(null);
    const [loadingFaqs, setLoadingFaqs] = useState(false);

    // Reset expanded FAQ to null (first open by default) when category or search changes
    useEffect(() => {
        setExpandedFaq(null);
    }, [selectedFaqCategory, searchQuery]);

    // Site settings & Support Contacts (Cached in localStorage for instant rendering)
    const [siteSettings, setSiteSettings] = useState<any>(() => {
        try {
            const cached = localStorage.getItem('sokonimax_site_settings_cache');
            return cached ? JSON.parse(cached) : {};
        } catch {
            return {};
        }
    });
    const [siteStatus, setSiteStatus] = useState<any>(null);

    // Modal state
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<'new' | 'history'>('new');
    const [modalDefaultCategory, setModalDefaultCategory] = useState<string>('other');


    const faqCategories = [
        { id: 'all', label: 'All' },
        { id: 'site-verification', label: isSellerOrBusiness ? 'Seller Guide' : 'Selling on SokoniMax' },
        { id: 'orders', label: 'Orders & Delivery' },
        { id: 'payments', label: 'Payments' },
        { id: 'inspections', label: 'Inspections' },
        { id: 'account', label: 'Account' },
        { id: 'general', label: 'General' },
    ];

    useEffect(() => {
        if (tabParam === 'site-verification') {
            setSelectedFaqCategory('site-verification');
        }
    }, [tabParam]);

    useEffect(() => {
        if (isAuthenticated && roles.isPureCustomer) {
            api.get('/api/seller-site-visits/my-status/')
                .then(res => setSiteStatus(res.data))
                .catch(() => {});
        }
    }, [isAuthenticated, roles.isPureCustomer]);

    useEffect(() => {
        // Fetch fresh settings in background and persist in cache
        api.get('/api/site-settings/').then(r => {
            if (r.data) {
                setSiteSettings(r.data);
                try {
                    localStorage.setItem('sokonimax_site_settings_cache', JSON.stringify(r.data));
                } catch {}
            }
        }).catch(() => {});

        // Listen for live updates from admin across tabs/windows
        const handleSettingsUpdate = (e: any) => {
            if (e.detail) {
                setSiteSettings(e.detail);
            } else {
                try {
                    const cached = localStorage.getItem('sokonimax_site_settings_cache');
                    if (cached) setSiteSettings(JSON.parse(cached));
                } catch {}
            }
        };
        window.addEventListener('site-settings-updated', handleSettingsUpdate);
        window.addEventListener('storage', handleSettingsUpdate);
        return () => {
            window.removeEventListener('site-settings-updated', handleSettingsUpdate);
            window.removeEventListener('storage', handleSettingsUpdate);
        };
    }, []);

    const contactItems = useMemo(() => {
        const items: Array<{
            key: string;
            label: string;
            tooltip: string;
            href: string;
            target?: string;
            icon: React.ReactNode;
            hoverColor: string;
        }> = [];

        if (siteSettings?.support_phone?.trim()) {
            const raw = siteSettings.support_phone.trim();
            items.push({
                key: 'phone',
                label: 'Call',
                tooltip: 'Call',
                href: `tel:${raw.replace(/\s+/g, '')}`,
                icon: <Phone size={22} className="text-gray-700 dark:text-gray-200" />,
                hoverColor: 'hover:border-brand-500 hover:text-brand-500',
            });
        }

        if (siteSettings?.whatsapp_number?.trim()) {
            const raw = siteSettings.whatsapp_number.trim();
            items.push({
                key: 'whatsapp',
                label: 'WhatsApp',
                tooltip: 'WhatsApp',
                href: resolveWhatsAppUrl(raw),
                target: '_blank',
                icon: <SiWhatsapp size={24} className="text-[#25D366]" />,
                hoverColor: 'hover:border-[#25D366]',
            });
        }

        if (siteSettings?.instagram_url?.trim()) {
            const raw = siteSettings.instagram_url.trim();
            const href = /^https?:\/\//i.test(raw) ? raw : `https://instagram.com/${raw.replace(/^@/, '')}`;
            items.push({
                key: 'instagram',
                label: 'Instagram',
                tooltip: 'Instagram',
                href,
                target: '_blank',
                icon: <SiInstagram size={23} className="text-[#E4405F]" />,
                hoverColor: 'hover:border-[#E4405F]',
            });
        }

        if (siteSettings?.tiktok_url?.trim()) {
            const raw = siteSettings.tiktok_url.trim();
            const href = /^https?:\/\//i.test(raw) ? raw : `https://tiktok.com/@${raw.replace(/^@/, '')}`;
            items.push({
                key: 'tiktok',
                label: 'TikTok',
                tooltip: 'TikTok',
                href,
                target: '_blank',
                icon: <SiTiktok size={21} className="text-gray-800 dark:text-white" />,
                hoverColor: 'hover:border-black dark:hover:border-white',
            });
        }

        if (siteSettings?.twitter_url?.trim()) {
            const raw = siteSettings.twitter_url.trim();
            const href = /^https?:\/\//i.test(raw) ? raw : `https://x.com/${raw.replace(/^@/, '')}`;
            items.push({
                key: 'twitter',
                label: 'X (Twitter)',
                tooltip: 'X (Twitter)',
                href,
                target: '_blank',
                icon: <SiX size={20} className="text-gray-800 dark:text-white" />,
                hoverColor: 'hover:border-black dark:hover:border-white',
            });
        }

        if (siteSettings?.facebook_url?.trim()) {
            items.push({
                key: 'facebook',
                label: 'Facebook',
                tooltip: 'Facebook',
                href: ensureUrl(siteSettings.facebook_url),
                target: '_blank',
                icon: <SiFacebook size={23} className="text-[#1877F2]" />,
                hoverColor: 'hover:border-[#1877F2]',
            });
        }

        if (siteSettings?.linkedin_url?.trim()) {
            items.push({
                key: 'linkedin',
                label: 'LinkedIn',
                tooltip: 'LinkedIn',
                href: ensureUrl(siteSettings.linkedin_url),
                target: '_blank',
                icon: <FaLinkedin size={22} className="text-[#0A66C2]" />,
                hoverColor: 'hover:border-[#0A66C2]',
            });
        }

        if (siteSettings?.youtube_url?.trim()) {
            items.push({
                key: 'youtube',
                label: 'YouTube',
                tooltip: 'YouTube',
                href: ensureUrl(siteSettings.youtube_url),
                target: '_blank',
                icon: <SiYoutube size={23} className="text-[#FF0000]" />,
                hoverColor: 'hover:border-[#FF0000]',
            });
        }

        return items;
    }, [siteSettings]);

    useEffect(() => {
        const fetchFaqs = async () => {
            setLoadingFaqs(true);
            try {
                const res = await api.get('/api/faq/?page_size=100');
                setFaqs(res.data.results || res.data || []);
            } catch (err) {
                console.error('Failed to fetch FAQs', err);
            } finally {
                setLoadingFaqs(false);
            }
        };
        fetchFaqs();
    }, []);


    const SITE_VERIFICATION_FAQS = useMemo(() => [
        {
            id: 9001,
            category: 'site-verification',
            question: "Why does SokoniMax require an in-person physical store visit before I can sell?",
            answer: "To prevent spam accounts, counterfeit listings, and delivery disputes, SokoniMax requires every merchant to undergo an in-person physical premises inspection. A certified staff member visits your store, verifies your physical inventory and presence, and logs official coordinates and storefront photographs before your account can be approved for selling."
        },
        {
            id: 9002,
            category: 'site-verification',
            question: "How do I request a site verification visit?",
            answer: "Call or message our official verification hotline directly using the buttons provided above. Provide our staff with your shop name, physical street address or landmark, and preferred inspection hours. Our verification field team will schedule and execute the visit."
        },
        {
            id: 9003,
            category: 'site-verification',
            question: "What happens during the physical site visit?",
            answer: "A certified SokoniMax staff member visits your physical shop. They will: 1) Verify that your shop exists and is open for business; 2) Take storefront and interior stock photos; 3) Note precise GPS coordinates; and 4) Submit the official inspection report to the SokoniMax administration for review."
        },
        {
            id: 9004,
            category: 'site-verification',
            question: "How long does admin review take, and how will I know I'm approved?",
            answer: "Once our staff submits your physical visit report, our administration reviews the evidence within 24–48 hours. When approved, you will receive an instant notification in your account, and your store status in Settings will show 'Site Verified ✓'. You can then proceed immediately to choose your subscription tier and launch your store."
        },
        {
            id: 9005,
            category: 'site-verification',
            question: "Can I sell without a physical shop or inventory?",
            answer: "Currently, SokoniMax requires all verified merchants to operate an active, verifiable business or physical workshop/store in Tanzania. This ensures accurate pickup hub logistics, verified seller ratings, and 100% buyer trust."
        }
    ], []);

    // Filter FAQs by category and search query
    const filteredFaqs = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        const matchesQuery = (faq: any) => {
            if (!q) return true;
            const question = (faq.question || '').toLowerCase();
            const answer = (faq.answer || '').toLowerCase();
            const category = (faq.category || '').toLowerCase();
            return question.includes(q) || answer.includes(q) || category.includes(q);
        };

        // All topics
        if (selectedFaqCategory === 'all') {
            const allItems = [...faqs, ...SITE_VERIFICATION_FAQS];
            return allItems.filter(matchesQuery);
        }

        // Site Verification topic
        if (selectedFaqCategory === 'site-verification') {
            const apiMatches = faqs.filter(faq => (faq.category || '').toLowerCase() === 'site-verification');
            const siteItems = apiMatches.length > 0 ? apiMatches : SITE_VERIFICATION_FAQS;
            return siteItems.filter(matchesQuery);
        }

        // Other topics (orders, payments, inspections, account, general)
        const catItems = faqs.filter(faq => (faq.category || 'general').toLowerCase() === selectedFaqCategory.toLowerCase());
        return catItems.filter(matchesQuery);
    }, [faqs, selectedFaqCategory, searchQuery, SITE_VERIFICATION_FAQS]);

    // Count of all matches across all categories for the current search query
    const globalMatchesCount = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return 0;
        const allItems = [...faqs, ...SITE_VERIFICATION_FAQS];
        return allItems.filter(faq => {
            const question = (faq.question || '').toLowerCase();
            const answer = (faq.answer || '').toLowerCase();
            const category = (faq.category || '').toLowerCase();
            return question.includes(q) || answer.includes(q) || category.includes(q);
        }).length;
    }, [faqs, SITE_VERIFICATION_FAQS, searchQuery]);

    const openFeedbackModal = (tab: 'new' | 'history' = 'new', category: string = 'other') => {
        setModalTab(tab);
        setModalDefaultCategory(category);
        setIsFeedbackModalOpen(true);
    };

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

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
        <div className="container-page pb-12 md:pb-2 pt-1 sm:pt-2 space-y-3 sm:space-y-4 animate-fade-in text-gray-900 dark:text-gray-100">
            
            {/* Title Centered in the Middle */}
            <div className="text-center py-1 sm:py-1.5 px-2">
                <h1 className="text-[26px] sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight max-w-xs sm:max-w-none mx-auto">
                    {firstName ? (
                        <>
                            Hello {firstName},<br className="sm:hidden" /> How can we help you?
                        </>
                    ) : (
                        <>
                            How can we<br className="sm:hidden" /> help you?
                        </>
                    )}
                </h1>
            </div>

            {/* Mobile View (< md): Search Toggle / Input + Category Pills in a single horizontal scroll row */}
            <div className="md:hidden flex items-center gap-2 overflow-x-auto py-1 scrollbar-none select-none">
                <AnimatePresence initial={false}>
                    {isSearchOpen || searchQuery ? (
                        <motion.div
                            key="search-input-mobile"
                            initial={{ width: 36, opacity: 0 }}
                            animate={{ width: 190, opacity: 1 }}
                            exit={{ width: 36, opacity: 0 }}
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
                                className="w-full pl-7 pr-7 py-1.5 text-xs bg-white dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border rounded-full text-gray-900 dark:text-white placeholder-gray-400 outline-none ring-0 transition"
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
                            onClick={handleOpenSearch}
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border shrink-0 cursor-pointer"
                            aria-label="Search FAQs"
                        >
                            <Search size={13} />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Restored Mobile Category Pills */}
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

            {/* Mobile Floating Contacts & Resources (Positioned cleanly above Back-To-Top button) */}
            <div 
                className="md:hidden fixed flex flex-col items-end gap-2.5 z-[90]"
                style={{
                    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 140px)',
                    right: '20px'
                }}
            >
                <AnimatePresence>
                    {isMobileFabOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className="flex flex-col items-end gap-2.5 mb-1"
                        >
                            {/* Contact Items */}
                            {contactItems.map((item) => (
                                <a
                                    key={item.key}
                                    href={item.href}
                                    target={item.target}
                                    rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
                                    className="flex items-center gap-2 group cursor-pointer"
                                >
                                    <span className="px-2.5 py-1 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold shadow-md whitespace-nowrap">
                                        {item.label}
                                    </span>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border shadow-lg active:scale-95 transition-transform ${item.hoverColor}`}>
                                        {item.icon}
                                    </div>
                                </a>
                            ))}

                            {/* Learn More inside other collapsible icons */}
                            <Link
                                to="/blog"
                                onClick={() => setIsMobileFabOpen(false)}
                                className="flex items-center gap-2 group cursor-pointer"
                            >
                                <span className="px-2.5 py-1 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold shadow-md whitespace-nowrap">
                                    Learn More
                                </span>
                                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border shadow-lg active:scale-95 transition-transform hover:border-brand-500 text-gray-700 dark:text-gray-200 hover:text-brand-500">
                                    <BookOpen size={21} />
                                </div>
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating FAB Trigger Button */}
                <button
                    type="button"
                    onClick={() => setIsMobileFabOpen(!isMobileFabOpen)}
                    className="w-12 h-12 rounded-full shadow-2xl bg-white dark:bg-[#111111] text-gray-900 dark:text-white border border-gray-200 dark:border-[#222222] transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                    aria-label="Direct contacts and resources"
                >
                    {isMobileFabOpen ? <X size={20} /> : <MessageCircle size={22} className="text-brand-500" />}
                </button>
            </div>

            {/* Main Content Area: Symmetrical 3-Column Layout with Mathematically Equal Left and Right Spaces */}
            <div className="flex flex-col md:flex-row gap-6 lg:gap-8 md:items-start">
                {/* Left Column: Categories List (Stationary - does not scroll) */}
                <aside aria-label="FAQ Categories" className="hidden md:block w-48 lg:w-52 shrink-0 select-none sticky top-20">
                    <nav className="space-y-1">
                        <p className="text-2xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider px-3 mb-1.5">
                            Topics
                        </p>

                        {/* Search Input (Minimalist Single Underline) */}
                        <div className="relative w-full px-2 mb-2.5">
                            <input
                                type="text"
                                placeholder="Search FAQs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-1 pr-6 py-1 text-xs bg-transparent border-0 border-b border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 rounded-none outline-none focus:outline-none ring-0 focus:ring-0 focus:border-gray-900 dark:focus:border-white transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white p-0.5 cursor-pointer"
                                    aria-label="Clear search"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {faqCategories.map(cat => {
                            const isActive = selectedFaqCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedFaqCategory(cat.id)}
                                    className={`w-full text-left py-2 px-3 text-xs sm:text-sm transition cursor-pointer flex items-center justify-between rounded-md ${
                                        isActive
                                            ? 'text-gray-900 dark:text-white font-bold bg-gray-100/80 dark:bg-neutral-800/60'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium hover:bg-gray-50 dark:hover:bg-neutral-900/40'
                                    }`}
                                >
                                    <span>{cat.label}</span>
                                    {isActive && (
                                        <ChevronRight size={14} className="text-gray-900 dark:text-white shrink-0 ml-1.5" />
                                    )}
                                </button>
                            );
                        })}

                        {/* Send us your feedback link below topics */}
                        <div className="pt-3 px-3 border-t border-surface-border dark:border-surface-dark-border mt-3">
                            <button
                                type="button"
                                onClick={() => openFeedbackModal('new')}
                                className="w-full text-left text-xs sm:text-sm font-semibold text-black dark:text-white hover:underline transition cursor-pointer"
                            >
                                Send us your feedback
                            </button>
                        </div>
                    </nav>
                </aside>

                {/* Center Column: FAQs (ONLY THIS COLUMN SCROLLS ON DESKTOP, SCROLLBAR HIDDEN) */}
                <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[calc(100vh-280px)] md:min-h-[calc(100vh-260px)] md:max-h-[calc(100vh-140px)] md:overflow-y-auto md:pr-4 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                    {/* Top Content: Guide & FAQs */}
                    <div className="space-y-6 flex-1">
                        {/* Store Verification Guide (Only for Pure Customers looking to sell) */}
                        {shouldShowSellerOnboarding && selectedFaqCategory === 'site-verification' && (
                            <div className="card p-5 space-y-3 mb-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                                            Store Verification
                                        </h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            All sellers on SokoniMax require a physical store inspection before account activation.
                                        </p>
                                    </div>
                                    {siteStatus?.status === 'pending_review' && (
                                        <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                                            Inspection Under Review
                                        </span>
                                    )}
                                    {siteStatus?.can_upgrade && (
                                        <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                                            Verified ✓
                                        </span>
                                    )}
                                </div>

                                {siteStatus?.can_upgrade ? (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-surface-border dark:border-surface-dark-border">
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            Your location has been verified. You can now choose your seller tier and start selling.
                                        </p>
                                        <Link
                                            to="/upgrade"
                                            className="px-3.5 py-2 rounded-btn bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition shrink-0"
                                        >
                                            Upgrade Store
                                        </Link>
                                    </div>
                                ) : siteStatus?.status === 'pending_review' ? (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 pt-1 border-t border-surface-border dark:border-surface-dark-border">
                                        Your store visit report has been submitted and is currently being reviewed by our administration.
                                    </p>
                                ) : (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-surface-border dark:border-surface-dark-border">
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Contact our team to schedule your physical store visit:
                                        </p>
                                        <div className="flex items-center gap-2">
                                            {siteSettings.support_phone && (
                                                <a
                                                    href={`tel:${siteSettings.support_phone}`}
                                                    className="px-3 py-1.5 rounded-btn bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-semibold hover:opacity-90 transition"
                                                >
                                                    Call {siteSettings.support_phone}
                                                </a>
                                            )}
                                            {siteSettings.whatsapp_number && (
                                                <a
                                                    href={`https://wa.me/${siteSettings.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent('Hello SokoniMax, I would like to request a physical store visit for seller verification.')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1.5 rounded-btn border border-surface-border dark:border-surface-dark-border text-xs font-semibold hover:bg-surface-muted dark:hover:bg-neutral-800 transition"
                                                >
                                                    WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* FAQ Accordion List with Soft Dividers */}
                        <div className="space-y-0.5">
                            <div className="divide-y divide-surface-border dark:divide-surface-dark-border">
                                {filteredFaqs.map((faq, index) => {
                                    const isOpen = expandedFaq === faq.id || (expandedFaq === null && index === 0);
                                    return (
                                        <div key={faq.id} className="py-1 transition">
                                            <button
                                                onClick={() => setExpandedFaq(isOpen ? 'closed' : faq.id)}
                                                className="w-full py-3 px-2 flex items-center justify-between text-left transition select-none group gap-3 rounded-lg hover:bg-surface-muted/50 dark:hover:bg-[#161616]/50 cursor-pointer"
                                            >
                                                <span className={`text-xs sm:text-sm leading-snug transition ${
                                                    isOpen 
                                                        ? 'text-black dark:text-white font-bold' 
                                                        : 'text-gray-900 dark:text-gray-100 group-hover:text-black dark:group-hover:text-white font-medium'
                                                }`}>
                                                    {faq.question}
                                                </span>
                                                <ChevronDown 
                                                    size={15} 
                                                    className={`transition-transform duration-200 shrink-0 ${
                                                        isOpen ? 'rotate-180 text-black dark:text-white' : 'text-gray-400 dark:text-neutral-500'
                                                    }`} 
                                                />
                                            </button>
                                            {isOpen && (
                                                <div className="px-2 pt-0.5 pb-3 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed animate-fade-in">
                                                    {faq.answer}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Empty State */}
                            {filteredFaqs.length === 0 && !loadingFaqs && (
                                <div className="py-12 text-center space-y-3">
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                        {searchQuery ? (
                                            selectedFaqCategory !== 'all' ? (
                                                <>No questions found for <span className="font-semibold text-black dark:text-white">"{searchQuery}"</span> in this topic.</>
                                            ) : (
                                                <>No questions found matching <span className="font-semibold text-black dark:text-white">"{searchQuery}"</span>.</>
                                            )
                                        ) : (
                                            'No questions found in this topic.'
                                        )}
                                    </p>
                                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs pt-1">
                                        {searchQuery && selectedFaqCategory !== 'all' && globalMatchesCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedFaqCategory('all')}
                                                className="font-semibold text-black dark:text-white underline cursor-pointer inline-flex items-center gap-1"
                                            >
                                                <span>Search all topics ({globalMatchesCount} {globalMatchesCount === 1 ? 'match' : 'matches'}) &rarr;</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => openFeedbackModal('new')}
                                            className="font-bold text-black dark:text-white underline inline-flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>Send us your feedback &rarr;</span>
                                        </button>
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery('')}
                                                className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white cursor-pointer"
                                            >
                                                Clear search
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Minimalist Human Footer Strip (Inside middle column stream, pinned to bottom) */}
                    <div className="pt-6 mt-auto border-t border-surface-border dark:border-surface-dark-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <p className="text-center sm:text-left">
                            Can't find what you need?{' '}
                            <button
                                type="button"
                                onClick={() => openFeedbackModal('new')}
                                className="text-black dark:text-white font-semibold underline underline-offset-4 cursor-pointer"
                            >
                                Send us your feedback
                            </button>
                        </p>

                        {/* Quick Contact Email */}
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
                        </div>
                    </div>
                </div>

                {/* Right Column: Desktop Contact Channels & Learn More (Strictly single vertical line, stationary, responsive) */}
                <aside
                    aria-label="Direct contacts and resources"
                    className="hidden md:flex flex-col items-center w-48 lg:w-52 shrink-0 select-none sticky top-20 h-fit"
                >
                    <div className="flex flex-col items-center gap-2.5 w-full pt-1">
                        {/* Contact Items - Single line vertical stack */}
                        <div className="flex flex-col items-center gap-2.5">
                            {contactItems.map((item) => (
                                <div key={item.key} className="relative group flex items-center">
                                    {/* Hover Tooltip on Left */}
                                    <span className="pointer-events-none absolute right-full mr-2.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-150 z-40">
                                        {item.tooltip}
                                        <span className="absolute top-1/2 -translate-y-1/2 -right-1 border-4 border-transparent border-l-gray-900 dark:border-l-white" />
                                    </span>

                                    <a
                                        href={item.href}
                                        target={item.target}
                                        rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
                                        aria-label={item.tooltip}
                                        className={`w-11 h-11 rounded-full flex items-center justify-center bg-white dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border shadow-xs hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer ${item.hoverColor}`}
                                    >
                                        {item.icon}
                                    </a>
                                </div>
                            ))}

                            {/* Divider between contacts and Learn More */}
                            {contactItems.length > 0 && (
                                <div className="w-6 h-[1px] bg-gray-200 dark:bg-neutral-800 my-0.5" />
                            )}

                            {/* Learn More */}
                            <div className="relative group flex items-center">
                                <span className="pointer-events-none absolute right-full mr-2.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-150 z-40">
                                    Learn More
                                    <span className="absolute top-1/2 -translate-y-1/2 -right-1 border-4 border-transparent border-l-gray-900 dark:border-l-white" />
                                </span>

                                <Link
                                    to="/blog"
                                    aria-label="Learn More"
                                    className="w-11 h-11 rounded-full flex items-center justify-center bg-white dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border shadow-xs hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer hover:border-brand-500 text-gray-700 dark:text-gray-200 hover:text-brand-500"
                                >
                                    <BookOpen size={20} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Reusable Feedback & Support Popup Modal */}
            <FeedbackModal
                isOpen={isFeedbackModalOpen}
                onClose={() => setIsFeedbackModalOpen(false)}
                initialTab={modalTab}
                defaultCategory={modalDefaultCategory}
            />
        </div>
    );
};

export default HelpCenterPage;
