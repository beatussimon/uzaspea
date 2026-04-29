import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Mail, Phone, MapPin, Search, ChevronDown, ChevronUp, Send } from 'lucide-react';

const HelpCenterPage: React.FC = () => {
    const [faqs, setFaqs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });
    const [submitting, setSubmitting] = useState(false);

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

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/api/support-tickets/', ticketForm);
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

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-6 flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center rounded-full">
                        <Phone size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Call Us</h3>
                    <p className="text-sm text-gray-500">+255 123 456 789</p>
                </div>
                <div className="card p-6 flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center rounded-full">
                        <Mail size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Email Us</h3>
                    <p className="text-sm text-gray-500">support@uzaspea.co.tz</p>
                </div>
                <div className="card p-6 flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center rounded-full">
                        <MapPin size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Visit Us</h3>
                    <p className="text-sm text-gray-500">Posta, Dar es Salaam, TZ</p>
                </div>
            </div>

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
                </div>
            </div>
        </div>
    );
};

export default HelpCenterPage;
