import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { 
  Send, Clock, CheckCircle, Lock, 
  RotateCcw, ArrowLeft, X, Check, Search, ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { AnimatePresence, motion } from 'framer-motion';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'new' | 'history';
  defaultCategory?: string;
  onTicketCreated?: (ticket: any) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'new',
  defaultCategory = 'other',
  onTicketCreated
}) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'new' | 'history'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory);
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    message: '',
    name: '',
    email: '',
    phone_number: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<any | null>(null);

  // Ticket History State
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [ticketSearch, setTicketSearch] = useState('');
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Sync tab when initialTab changes or modal reopens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSubmittedTicket(null);
      setActiveTicket(null);
      if (defaultCategory) setSelectedCategory(defaultCategory);
    }
  }, [isOpen, initialTab, defaultCategory]);

  const categories = [
    { id: 'other', label: t('category_general_feedback', 'General Inquiry & Feedback'), prefix: '[General Inquiry]' },
    { id: 'order_issue', label: t('category_order_issue', 'Order & Delivery'), prefix: '[Order Issue]' },
    { id: 'payment_issue', label: t('category_payment_issue', 'Payment & Billing'), prefix: '[Payment Issue]' },
    { id: 'account_issue', label: t('category_account_issue', 'Account & Security'), prefix: '[Account Issue]' },
    { id: 'inspection_issue', label: t('category_inspection_issue', 'Inspection & Verification'), prefix: '[Inspection Issue]' },
    { id: 'bug_report', label: t('category_bug_report', 'Technical & Bug Report'), prefix: '[Bug Report]' },
  ];

  const fetchTickets = async () => {
    if (!isAuthenticated) return;
    setLoadingTickets(true);
    try {
      const res = await api.get('/api/support-tickets/');
      const data = res.data.results || res.data || [];
      setUserTickets(data);
      if (activeTicket) {
        const refreshedActive = data.find((t: any) => t.id === activeTicket.id);
        if (refreshedActive) setActiveTicket(refreshedActive);
      }
    } catch (err) {
      // Ignore unauthorized or network errors
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchTickets();
    }
  }, [isOpen, isAuthenticated]);

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated && (!ticketForm.name.trim() || !ticketForm.email.trim())) {
      toast.error('Please provide your name and email so we can contact you.');
      return;
    }

    if (!ticketForm.message.trim()) {
      toast.error('Please enter a message.');
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
      if (onTicketCreated) {
        onTicketCreated(res.data);
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
      await fetchTickets();
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

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Calm Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-white dark:bg-[#0e0e0e] border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Support & Feedback
              </h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                {activeTab === 'new' 
                  ? 'Send a question or feedback directly to our team' 
                  : 'Track your inquiries and responses'}
              </p>
            </div>
            
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>

          {/* Top Segmented Switcher */}
          <div className="px-6 pb-2">
            <div className="flex bg-gray-100 dark:bg-neutral-900 p-1 rounded-xl select-none gap-1">
              <button
                type="button"
                onClick={() => { 
                  setActiveTab('new'); 
                  setSubmittedTicket(null); 
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'new'
                    ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-xs font-semibold'
                    : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>Send Feedback</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-xs font-semibold'
                    : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>Inquiry History</span>
                {isAuthenticated && userTickets.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-3xs font-black ${
                    activeTab === 'history'
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                  }`}>
                    {userTickets.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            
            {/* TAB 1: SEND INQUIRY / FEEDBACK */}
            {activeTab === 'new' && (
              <div className="space-y-4">
                {submittedTicket ? (
                  /* Success State */
                  <div className="text-center space-y-4 py-6 animate-fade-in">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-6 h-6 stroke-[2.5]" />
                    </div>

                    <div className="space-y-1.5 max-w-sm mx-auto">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        Inquiry Received
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
                        Registered under ticket reference <strong className="font-mono text-gray-900 dark:text-white font-semibold">#{submittedTicket.id}</strong>. Our team will review and reply shortly.
                      </p>
                    </div>

                    <div className="pt-3 flex items-center justify-center gap-2">
                      {isAuthenticated && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setActiveTab('history');
                            setActiveTicket(submittedTicket);
                            setSubmittedTicket(null);
                          }}
                          className="text-xs font-semibold py-2 px-3.5"
                        >
                          View in History
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSubmittedTicket(null)}
                        className="btn-secondary text-xs py-2 px-3.5 font-medium inline-flex items-center gap-1.5"
                      >
                        <RotateCcw size={12} />
                        <span>Submit Another</span>
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="btn-ghost text-xs py-2 px-3.5"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Inquiry Form */
                  <form onSubmit={handleTicketSubmit} className="space-y-3.5">
                    
                    {/* Authenticated User Indicator */}
                    {isAuthenticated && user && (
                      <div className="flex items-center justify-between text-xs py-1 text-gray-500 dark:text-neutral-400">
                        <span>
                          Submitting as <strong className="text-gray-900 dark:text-white font-semibold">{user.username}</strong>
                        </span>
                        <span className="flex items-center gap-1 text-3xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <ShieldCheck size={11} /> Verified
                        </span>
                      </div>
                    )}

                    {/* Topic Selector */}
                    <div className="space-y-1">
                      <label className="block text-2xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                        Topic
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none focus:border-gray-400 dark:focus:border-neutral-600 transition"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Guest Fields */}
                    {!isAuthenticated && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-2xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                            Name *
                          </label>
                          <input
                            required
                            type="text"
                            value={ticketForm.name}
                            onChange={e => setTicketForm({...ticketForm, name: e.target.value})}
                            className="w-full px-3.5 py-2 text-xs bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none focus:border-gray-400 dark:focus:border-neutral-600 transition"
                            placeholder="Your full name"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-2xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                            Email *
                          </label>
                          <input
                            required
                            type="email"
                            value={ticketForm.email}
                            onChange={e => setTicketForm({...ticketForm, email: e.target.value})}
                            className="w-full px-3.5 py-2 text-xs bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none focus:border-gray-400 dark:focus:border-neutral-600 transition"
                            placeholder="name@example.com"
                          />
                        </div>
                      </div>
                    )}

                    {/* Subject */}
                    <div className="space-y-1">
                      <label className="block text-2xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                        Subject *
                      </label>
                      <input
                        required
                        type="text"
                        value={ticketForm.subject}
                        onChange={e => setTicketForm({...ticketForm, subject: e.target.value})}
                        className="w-full px-3.5 py-2 text-xs bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none focus:border-gray-400 dark:focus:border-neutral-600 transition"
                        placeholder="Brief summary..."
                      />
                    </div>

                    {/* Detailed Message */}
                    <div className="space-y-1">
                      <label className="block text-2xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                        Message *
                      </label>
                      <textarea
                        required
                        value={ticketForm.message}
                        onChange={e => setTicketForm({...ticketForm, message: e.target.value})}
                        className="w-full px-3.5 py-2 text-xs bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none focus:border-gray-400 dark:focus:border-neutral-600 transition resize-none h-28 leading-relaxed"
                        placeholder="Provide any details, order numbers, or questions..."
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5"
                      >
                        <Send size={13} />
                        {submitting ? 'Sending...' : 'Submit Message'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: MY INQUIRIES & HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {!isAuthenticated ? (
                  /* Guest Notice */
                  <div className="py-8 text-center space-y-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 rounded-full flex items-center justify-center mx-auto">
                      <Lock size={16} />
                    </div>
                    <div className="space-y-1 max-w-xs mx-auto">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">Sign In to View Inquiries</h4>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">
                        Log in to your account to review support conversations and reply to our team.
                      </p>
                    </div>
                    <div className="pt-1">
                      <Link
                        to="/login?next=/help"
                        onClick={onClose}
                        className="btn-primary inline-flex items-center gap-1.5 text-xs font-bold py-2 px-4"
                      >
                        Sign In
                      </Link>
                    </div>
                  </div>
                ) : activeTicket ? (
                  /* Active Ticket Conversation Thread View */
                  <div className="space-y-3 animate-fade-in">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setActiveTicket(null)}
                        className="text-xs text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 font-medium transition"
                      >
                        <ArrowLeft size={13} /> Back
                      </button>
                      
                      <span className={`text-3xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                        activeTicket.status === 'resolved' || activeTicket.status === 'closed'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : activeTicket.status === 'in_progress'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}>
                        {activeTicket.status === 'resolved' || activeTicket.status === 'closed' ? <CheckCircle size={10} /> : <Clock size={10} />}
                        <span className="capitalize">{activeTicket.status?.replace(/_/g, ' ') || 'Received'}</span>
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-snug">
                        {activeTicket.subject}
                      </h4>
                      <p className="text-3xs text-gray-400 mt-0.5">
                        Ticket #{activeTicket.id} &bull; {new Date(activeTicket.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 py-1">
                      {(!activeTicket.messages || activeTicket.messages.length === 0) && activeTicket.message && (
                        <div className="flex flex-col items-end">
                          <span className="text-3xs text-gray-400 mb-0.5">You</span>
                          <div className="p-2.5 rounded-xl text-xs max-w-[88%] leading-relaxed bg-gray-100 dark:bg-neutral-900 text-gray-800 dark:text-neutral-200">
                            {activeTicket.message}
                          </div>
                        </div>
                      )}

                      {activeTicket.messages?.map((msg: any) => {
                        const isStaff = !!msg.is_internal || msg.sender_name === 'Staff' || (msg.sender && activeTicket.assigned_to && msg.sender === activeTicket.assigned_to);
                        return (
                          <div key={msg.id} className={`flex flex-col ${isStaff ? 'items-start' : 'items-end'}`}>
                            <span className="text-3xs text-gray-400 mb-0.5">
                              {isStaff ? 'Support Team' : 'You'}
                            </span>
                            <div className={`p-2.5 rounded-xl text-xs max-w-[88%] leading-relaxed ${
                              isStaff 
                                ? 'bg-brand-500/10 text-gray-900 dark:text-gray-100 font-medium' 
                                : 'bg-gray-100 dark:bg-neutral-900 text-gray-800 dark:text-neutral-200'
                            }`}>
                              {msg.body}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reply Composer */}
                    {activeTicket.status !== 'resolved' && activeTicket.status !== 'closed' ? (
                      <form onSubmit={(e) => handleTicketReply(e, activeTicket.id)} className="flex gap-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
                        <input 
                          type="text" 
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white outline-none focus:border-gray-400 dark:focus:border-neutral-600 transition" 
                          placeholder="Type your response..." 
                          value={replyMessage}
                          onChange={e => setReplyMessage(e.target.value)}
                          required
                        />
                        <Button type="submit" disabled={replying} size="sm" className="px-3.5 text-xs">
                          <Send size={12} />
                        </Button>
                      </form>
                    ) : (
                      <p className="text-3xs text-center text-gray-400 py-1 border-t border-gray-100 dark:border-neutral-800">
                        This inquiry has been resolved.
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
                        placeholder="Search inquiries..."
                        value={ticketSearch}
                        onChange={(e) => setTicketSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white outline-none focus:border-gray-400 dark:focus:border-neutral-600 transition"
                      />
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {filteredTickets.map(ticket => {
                        const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
                        const isInProgress = ticket.status === 'in_progress';
                        const latestMsg = ticket.messages && ticket.messages.length > 0 
                          ? ticket.messages[ticket.messages.length - 1].body 
                          : (ticket.message || '');
                        
                        return (
                          <div 
                            key={ticket.id} 
                            onClick={() => setActiveTicket(ticket)}
                            className="p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-900/60 transition cursor-pointer space-y-1 select-none border border-transparent hover:border-gray-200 dark:hover:border-neutral-800"
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

                            <p className="text-2xs text-gray-500 dark:text-neutral-400 line-clamp-1">
                              {latestMsg || 'No message preview'}
                            </p>

                            <div className="flex items-center justify-between text-3xs text-gray-400 pt-0.5">
                              <span>Ticket #{ticket.id}</span>
                              <span className="flex items-center gap-0.5">
                                View <ChevronRight size={10} />
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {filteredTickets.length === 0 && !loadingTickets && (
                        <div className="py-8 text-center text-xs text-gray-400 space-y-2">
                          <p>{ticketSearch ? 'No inquiries matching your search.' : 'No submitted inquiries yet.'}</p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('new')}
                            className="text-brand-500 hover:underline font-semibold text-xs"
                          >
                            Submit a message
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FeedbackModal;
