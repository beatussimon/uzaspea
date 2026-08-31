import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  Mail, Phone, Search, ChevronDown, Send, 
  MessageCircle, Clock, CheckCircle, Lock, RotateCcw, MessageSquare, 
  HelpCircle, ArrowLeft, X, Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';

const HelpCenterPage: React.FC = () => {
    const { t } = useTranslation();
    const { user, isAuthenticated } = useAuth();
    const [faqs, setFaqs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    
    // Right panel active tab: 'new' (Send Inquiry) | 'history' (My Inquiries)
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

    // Ticket Form State
    const [ticketForm, setTicketForm] = useState({
        subject: '',
        message: '',
        name: '',
        email: '',
        phone_number: ''
    });
    const [selectedCategory, setSelectedCategory] = useState<string>('other');
    const [submitting, setSubmitting] = useState(false);
    const [submittedTicket, setSubmittedTicket] = useState<any | null>(null);

    // Ticket History State (Authenticated Only)
    const [userTickets, setUserTickets] = useState<any[]>([]);
    const [ticketSearch, setTicketSearch] = useState('');
    const [siteSettings, setSiteSettings] = useState<any>({});
    const [activeTicket, setActiveTicket] = useState<any | null>(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [replying, setReplying] = useState(false);

    useEffect(() => {
        api.get('/api/site-settings/').then(r => setSiteSettings(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const res = await api.get(`/api/faq/?q=${encodeURIComponent(searchQuery)}`);
                setFaqs(res.data.results || res.data);
            } catch (err) {
                console.error('Failed to fetch FAQs');
            }
        };
        fetchFaqs();
    }, [searchQuery]);

    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const res = await api.get('/api/support-tickets/');
                setUserTickets(res.data.results || res.data);
            } catch (err) {
                // Ignore if unauthorized or failed
            }
        };
        if (isAuthenticated) {
            fetchTickets();
        } else {
            setUserTickets([]);
        }
    }, [isAuthenticated]);

    const categories = [
        { id: 'order_issue', label: t('category_order_issue', 'Order & Delivery'), prefix: '[Order Issue]' },
        { id: 'payment_issue', label: t('category_payment_issue', 'Payment & Billing'), prefix: '[Payment Issue]' },
        { id: 'account_issue', label: t('category_account_issue', 'Account & Security'), prefix: '[Account Issue]' },
        { id: 'inspection_issue', label: t('category_inspection_issue', 'Inspection & Verification'), prefix: '[Inspection Issue]' },
        { id: 'bug_report', label: t('category_bug_report', 'Technical & Bug Report'), prefix: '[Bug Report]' },
        { id: 'other', label: t('category_general_feedback', 'General Inquiry & Feedback'), prefix: '[General Inquiry]' },
    ];

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isAuthenticated && (!ticketForm.name.trim() || !ticketForm.email.trim())) {
            toast.error('Please provide your name and email so we can contact you.');
            return;
        }

        setSubmitting(true);
        try {
            const cat = categories.find(c => c.id === selectedCategory);
            const prefix = cat?.prefix || '[General]';
            const cleanSubject = ticketForm.subject.trim();
            const fullSubject = cleanSubject.startsWith('[') ? cleanSubject : `${prefix} ${cleanSubject}`;

            const payload = {
                subject: fullSubject || `${prefix} Customer Inquiry`,
                message: ticketForm.message.trim(),
                category: selectedCategory,
                name: isAuthenticated ? (user?.username || 'User') : ticketForm.name.trim(),
                email: isAuthenticated ? ((user as any)?.email || `${user?.username}@oko.com`) : ticketForm.email.trim(),
                phone_number: ticketForm.phone_number?.trim() || undefined,
            };

            const res = await api.post('/api/support-tickets/', payload);
            setSubmittedTicket(res.data);
            if (isAuthenticated) {
                setUserTickets(prev => [res.data, ...prev]);
            }
            toast.success(t('feedback_sent_success', 'Your inquiry has been submitted successfully!'));
            setTicketForm({ subject: '', message: '', name: '', email: '', phone_number: '' });
        } catch (error: any) {
            toast.error(error.response?.data?.detail || error.response?.data?.error || t('failed_to_send_message', 'Failed to send inquiry. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleTicketReply = async (e: React.FormEvent, ticketId: number) => {
        e.preventDefault();
        if (!replyMessage.trim()) return;
        setReplying(true);
        try {
            await api.post(`/api/support-tickets/${ticketId}/reply/`, { message: replyMessage.trim() });
            setReplyMessage('');
            const res = await api.get('/api/support-tickets/');
            const allTickets = res.data.results || res.data;
            setUserTickets(allTickets);
            setActiveTicket(allTickets.find((t: any) => t.id === ticketId) || null);
            toast.success('Reply sent.');
        } catch (error) {
            toast.error('Failed to send reply.');
        } finally {
            setReplying(false);
        }
    };

    const filteredTickets = useMemo(() => {
        if (!ticketSearch.trim()) return userTickets;
        const q = ticketSearch.toLowerCase();
        return userTickets.filter(t => 
            t.subject?.toLowerCase().includes(q) || 
            t.message?.toLowerCase().includes(q)
        );
    }, [userTickets, ticketSearch]);

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 animate-fade-in">
            {/* Header */}
            <div className="text-center space-y-2 max-w-2xl mx-auto">
                <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Help & Support</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Find instant answers in our FAQ or connect directly with our support team.
                </p>
            </div>

            {/* Quick Contact Chips */}
            {(siteSettings.support_phone || siteSettings.whatsapp_number || siteSettings.support_email) && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {siteSettings.support_phone && (
                  <a 
                    href={`tel:${siteSettings.support_phone}`} 
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-muted/60 dark:bg-[#141414] hover:bg-surface-muted dark:hover:bg-[#1c1c1c] border border-surface-border dark:border-surface-dark-border text-xs font-medium text-gray-700 dark:text-gray-300 transition-all select-none"
                  >
                    <Phone size={14} className="text-brand-500" />
                    <span>{siteSettings.support_phone}</span>
                  </a>
                )}
                {siteSettings.whatsapp_number && (
                  <a 
                    href={`https://wa.me/${siteSettings.whatsapp_number.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-medium text-emerald-600 dark:text-emerald-400 transition-all select-none"
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp Support</span>
                  </a>
                )}
                {siteSettings.support_email && (
                  <a 
                    href={`mailto:${siteSettings.support_email}`} 
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-muted/60 dark:bg-[#141414] hover:bg-surface-muted dark:hover:bg-[#1c1c1c] border border-surface-border dark:border-surface-dark-border text-xs font-medium text-gray-700 dark:text-gray-300 transition-all select-none"
                  >
                    <Mail size={14} className="text-blue-500" />
                    <span>{siteSettings.support_email}</span>
                  </a>
                )}
              </div>
            )}

            {/* 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Column: FAQs (5 cols on lg) */}
                <div className="lg:col-span-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
                            <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">Quick solutions to standard inquiries</p>
                        </div>
                        <HelpCircle size={18} className="text-gray-400" />
                    </div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search topics, questions, policies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-9 pr-8 py-2 text-xs w-full"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <div className="space-y-2.5">
                        {faqs.map(faq => {
                            const isOpen = expandedFaq === faq.id;
                            return (
                                <div 
                                    key={faq.id} 
                                    className="card transition-all overflow-hidden border border-surface-border dark:border-surface-dark-border hover:border-gray-900/20 dark:hover:border-white/20"
                                >
                                    <button
                                        onClick={() => setExpandedFaq(isOpen ? null : faq.id)}
                                        className="w-full px-4 py-3.5 flex items-center justify-between text-left transition select-none"
                                    >
                                        <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white leading-snug">
                                            {faq.question}
                                        </span>
                                        <div className={`p-1 rounded-full text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-500' : ''}`}>
                                            <ChevronDown size={15} />
                                        </div>
                                    </button>
                                    {isOpen && (
                                        <div className="px-4 pb-4 pt-1 text-xs text-gray-600 dark:text-gray-300 leading-relaxed border-t border-surface-border dark:border-surface-dark-border/40 bg-surface-muted/20 dark:bg-[#111]/30 animate-fade-in">
                                            {faq.answer}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {faqs.length === 0 && (
                            <div className="card p-8 text-center text-xs text-gray-400">
                                No FAQs matching "{searchQuery}"
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Support & Inquiries Console (6 cols on lg) */}
                <div className="lg:col-span-6">
                    <div className="card p-5 sm:p-6 border border-surface-border dark:border-surface-dark-border space-y-5">
                        
                        {/* Segmented Top Switcher */}
                        <div className="flex bg-surface-muted dark:bg-[#161616] p-1 rounded-full border border-surface-border dark:border-surface-dark-border select-none">
                            <button
                                type="button"
                                onClick={() => { setActiveTab('new'); setSubmittedTicket(null); }}
                                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                    activeTab === 'new'
                                        ? 'bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white shadow-xs'
                                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <Send size={13} />
                                <span>Send Inquiry</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('history')}
                                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                    activeTab === 'history'
                                        ? 'bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white shadow-xs'
                                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <MessageSquare size={13} />
                                <span>My Inquiries</span>
                                {isAuthenticated && userTickets.length > 0 && (
                                    <span className={`px-1.5 py-0.2 rounded-full text-3xs font-black ${
                                        activeTab === 'history'
                                            ? 'bg-brand-500 text-white'
                                            : 'bg-surface-border dark:bg-[#262626] text-gray-600 dark:text-gray-400'
                                    }`}>
                                        {userTickets.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* TAB 1: SEND INQUIRY */}
                        {activeTab === 'new' && (
                            <div className="space-y-4 animate-fade-in">
                                {submittedTicket ? (
                                    /* Success State */
                                    <div className="text-center space-y-5 py-6 animate-fade-in">
                                        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
                                            <Check className="w-6 h-6 stroke-[2.5]" />
                                        </div>
                                        <div className="space-y-1.5 max-w-sm mx-auto">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                                Inquiry Submitted
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                                Registered under Ticket Reference <strong className="font-mono text-gray-900 dark:text-white">#{submittedTicket.id}</strong>. Our support operations team will review your inquiry shortly.
                                            </p>
                                        </div>

                                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                                            {isAuthenticated && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        setActiveTab('history');
                                                        setActiveTicket(submittedTicket);
                                                        setSubmittedTicket(null);
                                                    }}
                                                    className="w-full sm:w-auto text-xs"
                                                >
                                                    View in My Inquiries
                                                </Button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setSubmittedTicket(null)}
                                                className="btn-secondary w-full sm:w-auto text-xs py-2 px-4 inline-flex items-center justify-center gap-1.5"
                                            >
                                                <RotateCcw size={13} />
                                                <span>Submit Another</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Inquiry Form */
                                    <form onSubmit={handleTicketSubmit} className="space-y-3.5">
                                        <div>
                                            <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                                Inquiry Topic
                                            </label>
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                                className="input w-full py-2 text-xs font-medium"
                                            >
                                                {categories.map((cat) => (
                                                    <option key={cat.id} value={cat.id}>
                                                        {cat.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {!isAuthenticated && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">Your Name *</label>
                                                    <input
                                                        required
                                                        type="text"
                                                        value={ticketForm.name}
                                                        onChange={e => setTicketForm({...ticketForm, name: e.target.value})}
                                                        className="input w-full py-2 text-xs"
                                                        placeholder="e.g. Juma Ali"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email Address *</label>
                                                    <input
                                                        required
                                                        type="email"
                                                        value={ticketForm.email}
                                                        onChange={e => setTicketForm({...ticketForm, email: e.target.value})}
                                                        className="input w-full py-2 text-xs"
                                                        placeholder="e.g. juma@example.com"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">Subject *</label>
                                            <input
                                                required
                                                type="text"
                                                value={ticketForm.subject}
                                                onChange={e => setTicketForm({...ticketForm, subject: e.target.value})}
                                                className="input w-full py-2 text-xs"
                                                placeholder="Brief summary of your question or issue..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">Detailed Message *</label>
                                            <textarea
                                                required
                                                value={ticketForm.message}
                                                onChange={e => setTicketForm({...ticketForm, message: e.target.value})}
                                                className="input w-full py-2 text-xs resize-none h-28 leading-relaxed"
                                                placeholder="Provide relevant order numbers, item details, or steps to help us resolve your inquiry faster..."
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5"
                                        >
                                            <Send size={13} />
                                            {submitting ? 'Sending Message...' : 'Send Message & Feedback'}
                                        </Button>
                                    </form>
                                )}
                            </div>
                        )}

                        {/* TAB 2: MY INQUIRIES */}
                        {activeTab === 'history' && (
                            <div className="space-y-4 animate-fade-in">
                                {!isAuthenticated ? (
                                    /* Guest Notice */
                                    <div className="p-6 rounded-card bg-surface-muted/40 dark:bg-[#141414] border border-dashed border-surface-border dark:border-surface-dark-border text-center space-y-3">
                                        <div className="w-10 h-10 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center mx-auto">
                                            <Lock size={16} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Sign In to Track Inquiries</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                                                View your ongoing conversations, staff replies, and resolution statuses.
                                            </p>
                                        </div>
                                        <div className="pt-1">
                                            <Link
                                                to="/login?next=/help"
                                                className="btn-primary inline-flex items-center gap-1.5 text-xs font-bold py-2 px-4"
                                            >
                                                Sign In Now
                                            </Link>
                                        </div>
                                    </div>
                                ) : activeTicket ? (
                                    /* Active Ticket Conversation Thread View */
                                    <div className="space-y-3 animate-fade-in">
                                        <div className="flex items-center justify-between pb-3 border-b border-surface-border dark:border-surface-dark-border">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTicket(null)}
                                                className="btn-ghost p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 text-xs"
                                            >
                                                <ArrowLeft size={14} /> Back
                                            </button>
                                            <span className={`text-3xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                                activeTicket.status === 'resolved' || activeTicket.status === 'closed'
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                    : activeTicket.status === 'in_progress'
                                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                            }`}>
                                                {activeTicket.status === 'resolved' || activeTicket.status === 'closed' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                                <span className="capitalize">{activeTicket.status?.replace(/_/g, ' ') || 'Received'}</span>
                                            </span>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{activeTicket.subject}</h4>
                                            <p className="text-3xs text-gray-400 mt-0.5">Ticket #{activeTicket.id}</p>
                                        </div>

                                        {/* Messages Thread */}
                                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                            {activeTicket.messages?.map((msg: any) => {
                                                const isStaff = !!msg.is_internal || msg.sender_name === 'Staff' || (msg.sender && activeTicket.assigned_to && msg.sender === activeTicket.assigned_to);
                                                return (
                                                    <div key={msg.id} className={`flex flex-col ${isStaff ? 'items-start' : 'items-end'}`}>
                                                        <span className="text-3xs text-gray-400 font-semibold mb-0.5">
                                                            {isStaff ? 'Support Team' : 'You'}
                                                        </span>
                                                        <div className={`p-3 rounded-card text-xs max-w-[88%] leading-relaxed ${
                                                            isStaff 
                                                                ? 'bg-brand-500/10 border border-brand-500/20 text-gray-900 dark:text-gray-100 rounded-tl-xs' 
                                                                : 'bg-surface-muted dark:bg-[#1a1a1a] border border-surface-border dark:border-surface-dark-border text-gray-800 dark:text-gray-200 rounded-tr-xs'
                                                        }`}>
                                                            {msg.body}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Reply Composer */}
                                        {activeTicket.status !== 'resolved' && activeTicket.status !== 'closed' ? (
                                            <form onSubmit={(e) => handleTicketReply(e, activeTicket.id)} className="flex gap-2 pt-2 border-t border-surface-border dark:border-surface-dark-border">
                                                <input 
                                                    type="text" 
                                                    className="input flex-1 py-1.5 text-xs" 
                                                    placeholder="Type your response..." 
                                                    value={replyMessage}
                                                    onChange={e => setReplyMessage(e.target.value)}
                                                    required
                                                />
                                                <Button type="submit" disabled={replying} size="sm" className="px-3 text-xs">
                                                    <Send size={13} />
                                                </Button>
                                            </form>
                                        ) : (
                                            <p className="text-3xs text-center text-gray-400 italic pt-2 border-t border-surface-border dark:border-surface-dark-border">
                                                This inquiry is resolved. Please submit a new inquiry if you have further questions.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    /* Inquiries List View */
                                    <div className="space-y-3 animate-fade-in">
                                        <div className="relative">
                                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search past inquiries..."
                                                value={ticketSearch}
                                                onChange={(e) => setTicketSearch(e.target.value)}
                                                className="input pl-8 py-1.5 text-xs w-full"
                                            />
                                        </div>

                                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                            {filteredTickets.map(ticket => {
                                                const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
                                                const isInProgress = ticket.status === 'in_progress';
                                                const latestMsg = ticket.messages && ticket.messages.length > 0 ? ticket.messages[ticket.messages.length - 1].body : (ticket.message || '');
                                                
                                                return (
                                                    <div 
                                                        key={ticket.id} 
                                                        onClick={() => setActiveTicket(ticket)}
                                                        className="p-3 rounded-btn bg-surface-muted/30 dark:bg-[#121212] border border-surface-border dark:border-surface-dark-border hover:border-gray-900/20 dark:hover:border-white/20 transition cursor-pointer space-y-1 select-none"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                                                {ticket.subject}
                                                            </h4>
                                                            <span className={`text-3xs px-2 py-0.2 rounded-full font-bold shrink-0 ${
                                                                isResolved
                                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                                    : isInProgress
                                                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                            }`}>
                                                                {isResolved ? 'Resolved' : isInProgress ? 'In Review' : 'Received'}
                                                            </span>
                                                        </div>
                                                        <p className="text-2xs text-gray-500 dark:text-gray-400 truncate">
                                                            {latestMsg}
                                                        </p>
                                                    </div>
                                                );
                                            })}

                                            {filteredTickets.length === 0 && (
                                                <div className="py-8 text-center text-xs text-gray-400">
                                                    {ticketSearch ? 'No inquiries matching your search.' : 'You have no submitted inquiries.'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HelpCenterPage;
