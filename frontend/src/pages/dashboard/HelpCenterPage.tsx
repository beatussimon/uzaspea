import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import toast from 'react-hot-toast';
import { Mail, Phone, MapPin, Search, ChevronDown, ChevronUp, Send, MessageCircle, ShoppingBag, Lightbulb, Bug, HelpCircle, Clock, CheckCircle } from 'lucide-react';

const HelpCenterPage: React.FC = () => {
    const { t } = useTranslation();
    const [faqs, setFaqs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });
    const [selectedCategory, setSelectedCategory] = useState<string>('General');
    const [submitting, setSubmitting] = useState(false);
    const [userTickets, setUserTickets] = useState<any[]>([]);
    const [siteSettings, setSiteSettings] = useState<any>({});

    useEffect(() => {
        api.get('/api/site-settings/').then(r => setSiteSettings(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const res = await api.get(`/api/faq/?q=${searchQuery}`);
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
                // Ignore if not logged in or failed
            }
        };
        if (localStorage.getItem('access_token')) {
            fetchTickets();
        }
    }, []);

    const categories = [
        { id: 'Order Help', label: t('order_and_delivery', 'Order & Delivery'), icon: ShoppingBag, prefix: '[Order Help]' },
        { id: 'Suggestion', label: t('suggestion', 'Suggestion'), icon: Lightbulb, prefix: '[Suggestion]' },
        { id: 'Report Issue', label: t('report_issue', 'Report Issue'), icon: Bug, prefix: '[Report Issue]' },
        { id: 'General', label: t('general_inquiry', 'General Inquiry'), icon: HelpCircle, prefix: '[General]' },
    ];

    const handleCategorySelect = (cat: typeof categories[0]) => {
        setSelectedCategory(cat.id);
        const cleanSubject = ticketForm.subject.replace(/^\[.*?\]\s*/, '');
        setTicketForm(prev => ({
            ...prev,
            subject: cleanSubject ? `${cat.prefix} ${cleanSubject}` : `${cat.prefix} `
        }));
    };

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...ticketForm,
                subject: ticketForm.subject.trim() || `[${selectedCategory}] Customer Enquiry`
            };
            const res = await api.post('/api/support-tickets/', payload);
            setUserTickets(prev => [res.data, ...prev]);
            toast.success('Your message has been sent successfully. We will get back to you soon.');
            setTicketForm({ subject: '', message: '' });
        } catch (error) {
            toast.error('Failed to send message. Please try again.');
        } finally {
            setSubmitting(false);
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
                    <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center rounded-full">
                      <Phone size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Call Us</h3>
                    <p className="text-sm text-gray-500">{siteSettings.support_phone}</p>
                  </a>
                )}
                {siteSettings.whatsapp_number && (
                  <a href={`https://wa.me/${siteSettings.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="card p-6 flex flex-col items-center text-center space-y-2 hover:shadow-lg transition-shadow">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center rounded-full">
                      <MessageCircle size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">WhatsApp</h3>
                    <p className="text-sm text-gray-500">{siteSettings.whatsapp_number}</p>
                  </a>
                )}
                {siteSettings.support_email && (
                  <a href={`mailto:${siteSettings.support_email}`} className="card p-6 flex flex-col items-center text-center space-y-2 hover:shadow-lg transition-shadow">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center rounded-full">
                      <Mail size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Email Us</h3>
                    <p className="text-sm text-gray-500">{siteSettings.support_email}</p>
                  </a>
                )}
                {siteSettings.address && (
                  <div className="card p-6 flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center rounded-full">
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

                {/* Support & Feedback Form */}
                <div className="card p-6 h-fit">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t('contact_support_feedback', 'Contact Support & Give Feedback')}</h2>
                    <p className="text-sm text-gray-500 mb-6">{t('contact_support_desc', 'Need assistance or have feedback? Send us a direct message and our team will get back to you promptly.')}</p>
                    
                    {/* Topic Categories */}
                    <div className="mb-5">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('what_are_you_contacting_us_about', 'What are you contacting us about?')}</label>
                        <div className="grid grid-cols-2 gap-2">
                            {categories.map((cat) => {
                                const IconComp = cat.icon;
                                const isSelected = selectedCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleCategorySelect(cat)}
                                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                                            isSelected 
                                                ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-500 text-brand-600 dark:text-brand-400 shadow-sm' 
                                                : 'bg-gray-50 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-neutral-600'
                                        }`}
                                    >
                                        <IconComp size={16} className={isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'} />
                                        <span>{cat.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <form onSubmit={handleTicketSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('subject', 'Subject')}</label>
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
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('message', 'Message')}</label>
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
                            {submitting ? 'Sending...' : t('send_message_and_feedback', 'Send Message & Feedback')}
                        </button>
                    </form>

                    {/* User's Request History */}
                    <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('your_support_and_feedback_history', 'Your Support & Feedback History')}</h2>
                        <div className="space-y-4">
                            {userTickets.map(ticket => {
                                const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
                                const isInProgress = ticket.status === 'in_progress';
                                return (
                                    <div key={ticket.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{ticket.subject}</h3>
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
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{ticket.message}</p>
                                        {ticket.staff_reply && (
                                            <div className="mt-3 p-3 bg-brand-50 dark:bg-brand-900/20 border-l-4 border-brand-500 rounded-r-lg">
                                                <p className="text-xs font-bold text-brand-700 dark:text-brand-400 uppercase mb-1">{t('support_team_response', 'Support Team Response:')}</p>
                                                <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.staff_reply}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {userTickets.length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-3">{t('no_support_requests_yet', 'You haven\'t submitted any support requests or feedback yet.')}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpCenterPage;
