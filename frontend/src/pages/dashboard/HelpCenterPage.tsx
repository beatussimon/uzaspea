import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Mail, Phone, MapPin, Search, ChevronDown, ChevronUp, Send, MessageCircle } from 'lucide-react';

const HelpCenterPage: React.FC = () => {
    const [faqs, setFaqs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });
    const [submitting, setSubmitting] = useState(false);
    const [userTickets, setUserTickets] = useState<any[]>([]);
    // FIX B-18: Dynamic site settings
    const [siteSettings, setSiteSettings] = useState<any>({});

    useEffect(() => {
        // FIX B-18: Fetch from API
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

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await api.post('/api/support-tickets/', ticketForm);
            setUserTickets(prev => [res.data, ...prev]);
            toast.success('Support ticket submitted successfully. We will get back to you soon.');
            setTicketForm({ subject: '', message: '' });
        } catch (error) {
            toast.error('Failed to submit ticket. Please try again.');
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

            {/* Contact Info — FIX HIGH-5: dynamic from SiteSettings, hidden when empty */}
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

                {/* Ticket Form */}
                <div className="card p-6 h-fit">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Submit a Ticket</h2>
                    <p className="text-sm text-gray-500 mb-6">Need more help? Send us a message and we'll reply to your registered email.</p>
                    <form onSubmit={handleTicketSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Subject</label>
                            <input
                                required
                                type="text"
                                value={ticketForm.subject}
                                onChange={e => setTicketForm({...ticketForm, subject: e.target.value})}
                                className="input w-full"
                                placeholder="Briefly describe your issue"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Message</label>
                            <textarea
                                required
                                value={ticketForm.message}
                                onChange={e => setTicketForm({...ticketForm, message: e.target.value})}
                                className="input w-full resize-none h-32"
                                placeholder="Provide as much detail as possible..."
                            ></textarea>
                        </div>
                        <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
                            <Send size={16} />
                            {submitting ? 'Submitting...' : 'Submit Ticket'}
                        </button>
                    </form>

                    {/* User's Tickets */}
                    <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Your Tickets</h2>
                        <div className="space-y-4">
                            {userTickets.map(ticket => (
                                <div key={ticket.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{ticket.subject}</h3>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            ticket.status === 'open' ? 'bg-blue-100 text-blue-800' :
                                            ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-green-100 text-green-800'
                                        }`}>
                                            {ticket.status.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{ticket.message}</p>
                                    {ticket.staff_reply && (
                                        <div className="mt-3 p-3 bg-brand-50 dark:bg-brand-900/20 border-l-4 border-brand-500 rounded-r-lg">
                                            <p className="text-xs font-bold text-brand-700 uppercase mb-1">Staff Reply:</p>
                                            <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.staff_reply}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {userTickets.length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-2">You haven't submitted any tickets yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpCenterPage;
