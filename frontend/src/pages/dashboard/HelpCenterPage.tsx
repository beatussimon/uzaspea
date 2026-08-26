import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Mail, Phone, MapPin, Search, ChevronDown, ChevronUp, Send, MessageCircle, Clock, CheckCircle, Lock, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const HelpCenterPage: React.FC = () => {
    const { t } = useTranslation();
    const { user, isAuthenticated } = useAuth();
    const [faqs, setFaqs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    
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
        { id: 'order_issue', label: t('category_order_issue', 'Order & Delivery Issue'), prefix: '[Order Issue]' },
        { id: 'payment_issue', label: t('category_payment_issue', 'Payment & Billing Issue'), prefix: '[Payment Issue]' },
        { id: 'account_issue', label: t('category_account_issue', 'Account & Security'), prefix: '[Account Issue]' },
        { id: 'inspection_issue', label: t('category_inspection_issue', 'Inspection & Verification'), prefix: '[Inspection Issue]' },
        { id: 'bug_report', label: t('category_bug_report', 'Bug Report / Technical Issue'), prefix: '[Bug Report]' },
        { id: 'other', label: t('category_general_feedback', 'General Inquiry & Feedback'), prefix: '[General Inquiry]' },
    ];

    const handleCategoryChange = (catId: string) => {
        setSelectedCategory(catId);
        const cat = categories.find(c => c.id === catId);
        if (cat) {
            const cleanSubject = ticketForm.subject.replace(/^\[.*?\]\s*/, '');
            setTicketForm(prev => ({
                ...prev,
                subject: cleanSubject ? `${cat.prefix} ${cleanSubject}` : `${cat.prefix} `
            }));
        }
    };

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isAuthenticated && (!ticketForm.name.trim() || !ticketForm.email.trim())) {
            toast.error('Please provide your name and email so we can contact you.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                subject: ticketForm.subject.trim() || `[${selectedCategory}] Customer Inquiry`,
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
        setReplying(true);
        try {
            await api.post(`/api/support-tickets/${ticketId}/reply/`, { message: replyMessage });
            setReplyMessage('');
            const res = await api.get('/api/support-tickets/');
            setUserTickets(res.data.results || res.data);
            setActiveTicket((res.data.results || res.data).find((t: any) => t.id === ticketId) || null);
            toast.success('Reply sent.');
        } catch (error) {
            toast.error('Failed to send reply.');
        } finally {
            setReplying(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">Help & Support</h1>
                <p className="text-gray-500">How can we assist you today?</p>
            </div>

            {/* Contact Info */}
            {(siteSettings.support_phone || siteSettings.whatsapp_number || siteSettings.support_email || siteSettings.address) && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {siteSettings.support_phone && (
                  <a href={`tel:${siteSettings.support_phone}`} className="card p-6 flex flex-col items-center text-center space-y-2 hover:shadow-lg transition-shadow">
                    <div className="w-12 h-12   text-brand-500 flex items-center justify-center rounded-full">
                      <Phone size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Call Us</h3>
                    <p className="text-sm text-gray-500">{siteSettings.support_phone}</p>
                  </a>
                )}
                {siteSettings.whatsapp_number && (
                  <a href={`https://wa.me/${siteSettings.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="card p-6 flex flex-col items-center text-center space-y-2 hover:shadow-lg transition-shadow">
                    <div className="w-12 h-12   text-green-500 flex items-center justify-center rounded-full">
                      <MessageCircle size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">WhatsApp</h3>
                    <p className="text-sm text-gray-500">{siteSettings.whatsapp_number}</p>
                  </a>
                )}
                {siteSettings.support_email && (
                  <a href={`mailto:${siteSettings.support_email}`} className="card p-6 flex flex-col items-center text-center space-y-2 hover:shadow-lg transition-shadow">
                    <div className="w-12 h-12   text-blue-500 flex items-center justify-center rounded-full">
                      <Mail size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Email Us</h3>
                    <p className="text-sm text-gray-500">{siteSettings.support_email}</p>
                  </a>
                )}
                {siteSettings.address && (
                  <div className="card p-6 flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12   text-purple-500 flex items-center justify-center rounded-full">
                      <MapPin size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Visit Us</h3>
                    <p className="text-sm text-gray-500">{siteSettings.address}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* FAQs */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Frequently Asked Questions</h2>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search FAQs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10 w-full"
                        />
                        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                        {faqs.map(faq => (
                            <div key={faq.id} className="card border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <button
                                    onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                                >
                                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{faq.question}</span>
                                    {expandedFaq === faq.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                {expandedFaq === faq.id && (
                                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        ))}
                        {faqs.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">No FAQs found.</p>
                        )}
                    </div>
                </div>

                {/* Right Column: Support & Feedback Section */}
                <div className="card p-6 h-fit">
                    {submittedTicket ? (
                        /* Submission Confirmation Card with Tick & Hotline Revelation */
                        <div className="text-center space-y-6 py-4 animate-fade-in">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50 dark:ring-emerald-950/20">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                                    {t('inquiry_received_title', 'Inquiry Received!')}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                                    {t('inquiry_received_desc', 'Thank you for contacting us. Your ticket has been registered under reference')} <strong className="text-gray-900 dark:text-white font-mono">#{submittedTicket.id}</strong>. {t('inquiry_received_review', 'Our support team will review your message.')}
                                </p>
                            </div>

                            {/* Hotline & Urgent Contact Section */}
                            {(siteSettings.support_phone || siteSettings.whatsapp_number) && (
                                <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 text-left space-y-3">
                                    <p className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                                        {t('need_urgent_help', 'Need Urgent Assistance?')}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {siteSettings.support_phone && (
                                            <a
                                                href={`tel:${siteSettings.support_phone}`}
                                                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 text-xs font-bold transition-colors"
                                            >
                                                <Phone size={14} />
                                                <span>{siteSettings.support_phone}</span>
                                            </a>
                                        )}
                                        {siteSettings.whatsapp_number && (
                                            <a
                                                href={`https://wa.me/${siteSettings.whatsapp_number.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 text-xs font-bold transition-colors"
                                            >
                                                <MessageCircle size={14} />
                                                <span>WhatsApp Support</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <button
                                    type="button"
                                    onClick={() => setSubmittedTicket(null)}
                                    className="btn-secondary inline-flex items-center gap-2 text-xs font-bold py-2.5 px-6"
                                >
                                    <RotateCcw size={14} />
                                    <span>{t('submit_another_inquiry', 'Submit Another Inquiry')}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Standard Form View */
                        <>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t('contact_support_feedback', 'Contact Support & Give Feedback')}</h2>
                            <p className="text-sm text-gray-500 mb-6">{t('contact_support_desc', 'Need assistance or have feedback? Send us a direct message and our team will get back to you promptly.')}</p>
                            
                            <form onSubmit={handleTicketSubmit} className="space-y-4">
                                {/* Category Dropdown */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                        {t('what_are_you_contacting_us_about', 'What are you contacting us about?')}
                                    </label>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => handleCategoryChange(e.target.value)}
                                        className="input w-full font-medium"
                                    >
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Guest Identification Fields */}
                                {!isAuthenticated && (
                                    <div className="space-y-3 pt-1">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('your_name', 'Your Name')} <span className="text-red-500">*</span></label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={ticketForm.name}
                                                    onChange={e => setTicketForm({...ticketForm, name: e.target.value})}
                                                    className="input w-full"
                                                    placeholder={t('enter_name_placeholder', 'e.g. Juma Ali')}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('your_email', 'Email Address')} <span className="text-red-500">*</span></label>
                                                <input
                                                    required
                                                    type="email"
                                                    value={ticketForm.email}
                                                    onChange={e => setTicketForm({...ticketForm, email: e.target.value})}
                                                    className="input w-full"
                                                    placeholder={t('enter_email_placeholder', 'e.g. juma@example.com')}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('phone_number_optional', 'Phone / WhatsApp Number (Optional)')}</label>
                                            <input
                                                type="tel"
                                                value={ticketForm.phone_number}
                                                onChange={e => setTicketForm({...ticketForm, phone_number: e.target.value})}
                                                className="input w-full"
                                                placeholder="+255 7XX XXX XXX"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('subject', 'Subject')} <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={ticketForm.subject}
                                        onChange={e => setTicketForm({...ticketForm, subject: e.target.value})}
                                        className="input w-full"
                                        placeholder={t('describe_question_placeholder', 'Briefly describe your question or feedback...')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('message', 'Message')} <span className="text-red-500">*</span></label>
                                    <textarea
                                        required
                                        value={ticketForm.message}
                                        onChange={e => setTicketForm({...ticketForm, message: e.target.value})}
                                        className="input w-full resize-none h-32"
                                        placeholder={t('provide_details_placeholder', 'Provide as much detail as possible...')}
                                    ></textarea>
                                </div>
                                <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2 font-bold py-3">
                                    <Send size={16} />
                                    {submitting ? t('sending', 'Sending...') : t('send_message_and_feedback', 'Send Message & Feedback')}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Support & Feedback History: Authenticated vs Guest */}
                    <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-6">
                        {isAuthenticated ? (
                            /* Authenticated View: User's History */
                            <>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('your_support_and_feedback_history', 'Your Support & Feedback History')}</h2>
                                <div className="space-y-4">
                                    {userTickets.map(ticket => {
                                        const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
                                        const isInProgress = ticket.status === 'in_progress';
                                        const isActive = activeTicket?.id === ticket.id;
                                        
                                        return (
                                            <div key={ticket.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 transition-all">
                                                <div 
                                                    className="flex justify-between items-start mb-2 cursor-pointer group"
                                                    onClick={() => setActiveTicket(isActive ? null : ticket)}
                                                >
                                                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-brand-500 transition-colors">{ticket.subject}</h3>
                                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 ${
                                                        isInProgress ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' :
                                                        isResolved ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' :
                                                        'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                                    }`}>
                                                        {isResolved ? <CheckCircle size={12} /> : <Clock size={12} />}
                                                        <span>
                                                            {isResolved ? t('status_resolved', 'Resolved') : isInProgress ? t('status_in_review', 'In Review') : t('status_received', 'Received')}
                                                        </span>
                                                    </span>
                                                </div>
                                                
                                                {!isActive && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                                        {ticket.messages && ticket.messages.length > 0 ? ticket.messages[ticket.messages.length - 1].body : (ticket.message || 'No messages yet.')}
                                                    </p>
                                                )}

                                                {isActive && (
                                                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                                            {ticket.messages?.map((msg: any) => {
                                                                const isStaff = !!msg.is_internal || msg.sender_name === 'Staff' || (msg.sender && ticket.assigned_to && msg.sender === ticket.assigned_to);
                                                                return (
                                                                    <div key={msg.id} className={`flex flex-col ${isStaff ? 'items-start' : 'items-end'}`}>
                                                                        <span className="text-xs text-gray-500 mb-1 font-bold">{isStaff ? t('support_team', 'Support Team') : t('you', 'You')}</span>
                                                                        <div className={`p-3 rounded-xl max-w-[90%] text-sm ${
                                                                            isStaff 
                                                                                ? 'bg-brand-50 dark:bg-brand-950/40 border-l-4 border-brand-500 rounded-tl-none text-gray-800 dark:text-gray-200' 
                                                                                : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-tr-none text-gray-700 dark:text-gray-300'
                                                                        }`}>
                                                                            {msg.body}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        
                                                        {!isResolved && (
                                                            <form onSubmit={(e) => handleTicketReply(e, ticket.id)} className="mt-4 flex gap-2">
                                                                <input 
                                                                    type="text" 
                                                                    className="input flex-1" 
                                                                    placeholder={t('type_a_reply', 'Type a reply...')} 
                                                                    value={replyMessage}
                                                                    onChange={e => setReplyMessage(e.target.value)}
                                                                    required
                                                                />
                                                                <button type="submit" disabled={replying} className="btn-primary shrink-0 px-4">
                                                                    {replying ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
                                                                </button>
                                                            </form>
                                                        )}
                                                        {isResolved && (
                                                            <p className="text-xs text-center text-gray-500 italic mt-2">{t('ticket_resolved_notice', 'This ticket is resolved. Please submit a new inquiry for further questions.')}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {userTickets.length === 0 && (
                                        <p className="text-sm text-gray-500 text-center py-3">{t('no_support_requests_yet', 'You haven\'t submitted any support requests or feedback yet.')}</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* Guest Notice: Prompt Login for History Access */
                            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-dashed border-gray-200 dark:border-gray-700 text-center space-y-3">
                                <div className="w-10 h-10 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center mx-auto">
                                    <Lock size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                        {t('track_inquiries_title', 'Want to track your ticket history?')}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                                        {t('track_inquiries_desc', 'Sign in or create an account to view previous conversations, responses, and real-time status updates.')}
                                    </p>
                                </div>
                                <div>
                                    <Link
                                        to="/login?next=/help"
                                        className="btn-primary inline-flex items-center gap-2 text-xs font-bold py-2 px-5"
                                    >
                                        {t('sign_in_to_view_history', 'Sign In to View History')}
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpCenterPage;
