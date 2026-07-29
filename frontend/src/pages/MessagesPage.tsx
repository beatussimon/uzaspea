import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  MessageSquare, Send, ArrowLeft, Search, Smile, 
  CheckCheck, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import VerifiedBadge from '../components/VerifiedBadge';
import { useMessages, Message } from '../context/MessageContext';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

const MessagesPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const userId = user?.user_id || (user as any)?.id || parseInt(localStorage.getItem('user_id') || '0');

  const {
    conversations,
    messages,
    fetchMessages,
    sendMessage,
    setActiveConversationId,
    loading: contextLoading,
    typingStatus,
    sendTypingStatus,
  } = useMessages();


  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'main' | 'sokoni'>('main');
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const lastConvIdRef = useRef<string | undefined>(undefined);
  const typingTimeoutRef = useRef<number | null>(null);
  const [isLocallyTyping, setIsLocallyTyping] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const handleInputChange = (val: string) => {
    setNewMessage(val);
    if (!id) return;
    const convId = parseInt(id);

    if (val.trim() === '') {
      if (isLocallyTyping) {
        setIsLocallyTyping(false);
        sendTypingStatus(convId, false);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      return;
    }

    if (!isLocallyTyping) {
      setIsLocallyTyping(true);
      sendTypingStatus(convId, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      setIsLocallyTyping(false);
      sendTypingStatus(convId, false);
    }, 4000);
  };


  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isLocallyTyping && id) {
        sendTypingStatus(parseInt(id), false);
      }
    };
  }, [id, isLocallyTyping, sendTypingStatus]);

  useEffect(() => {
    // Reset typing states on conversation switch
    setIsLocallyTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [id]);



  // Sync route param with context's active conversation
  useEffect(() => {
    if (id) {
      const convIdNum = parseInt(id);
      setActiveConversationId(convIdNum);
      fetchMessages(convIdNum);
      
      // Handle prefill message from navigation state
      if (location.state && location.state.prefillMessage) {
        setNewMessage(location.state.prefillMessage);
        // Clear state so a page refresh doesn't trigger it again
        window.history.replaceState({}, document.title);
      }
      // Simulate a small typing effect when entering a chat for visual premium flair
    } else {
      setActiveConversationId(null);
    }
  }, [id, setActiveConversationId, fetchMessages]);

  // Handle direct message URL parameters like ?user=username
  useEffect(() => {
    if (!id && !contextLoading) {
      const targetUser = searchParams.get('user');
      if (targetUser) {
        if (user && targetUser.toLowerCase() === user.username.toLowerCase()) {
          toast.error("You cannot message yourself");
          navigate('/messages', { replace: true });
          return;
        }
        const existing = conversations.find(c => 
          c.buyer_username.toLowerCase() === targetUser.toLowerCase() || c.seller_username.toLowerCase() === targetUser.toLowerCase()
        );
        if (existing) {
          navigate(`/messages/${existing.id}`, { replace: true });
        } else {
          // Fetch target profile first to start conversation
          api.get(`/api/profiles/${targetUser}/`)
            .then(res => {
              const targetUserId = res.data.user_id;
              if (targetUserId) {
                if (Number(targetUserId) === Number(userId)) {
                  toast.error("You cannot message yourself");
                  navigate('/messages', { replace: true });
                  return;
                }
                return api.post('/api/conversations/', { seller: targetUserId });
              }
              throw new Error('User ID not found');
            })
            .then(res => {
              if (res && res.data) {
                navigate(`/messages/${res.data.id}`, { replace: true });
              }
            })
            .catch(() => toast.error(`Could not start conversation with ${targetUser}`));
        }
      }
    }
  }, [id, conversations, searchParams, navigate, contextLoading, user, userId]);

  const activeConv = conversations.find(c => c.id === parseInt(id || ''));

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messageEndRef.current?.scrollIntoView({ behavior });
  };

  const currentMessages = id ? (messages[parseInt(id)] || []) : [];
  const currentTypingStatus = id ? typingStatus[parseInt(id)] : false;

  const prevMessagesLengthRef = useRef(currentMessages.length);
  useEffect(() => {
    if (currentMessages.length > prevMessagesLengthRef.current) {
      const addedCount = currentMessages.length - prevMessagesLengthRef.current;
      if (isScrolledUp && addedCount > 0) {
        // Assume last message sender
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (lastMsg.sender !== parseInt(userId.toString())) {
          setNewMessagesCount(prev => prev + addedCount);
        }
      } else if (!isScrolledUp) {
        if (id !== lastConvIdRef.current) {
          scrollToBottom('auto');
          lastConvIdRef.current = id;
        } else {
          scrollToBottom('smooth');
        }
      }
    } else if (currentTypingStatus && !isScrolledUp) {
       scrollToBottom('smooth');
    }
    prevMessagesLengthRef.current = currentMessages.length;
  }, [currentMessages, id, currentTypingStatus, isScrolledUp, userId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isUp = scrollHeight - scrollTop > clientHeight + 50;
    setIsScrolledUp(isUp);
    if (!isUp) {
      setNewMessagesCount(0);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !id) return;
    const msgContent = newMessage;
    setNewMessage('');
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsLocallyTyping(false);
    sendTypingStatus(parseInt(id), false);

    try {
      await sendMessage(parseInt(id), msgContent);
    } catch (e) {
      toast.error('Failed to send message');
    }
  };


  const sendEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getGradient = (username: string) => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-purple-500 to-pink-600',
      'from-rose-500 to-orange-600',
      'from-amber-500 to-yellow-600',
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  const sokoniConversations = conversations.filter(c => !!c.product || !!c.product_name);
  const regularConversations = conversations.filter(c => !c.product && !c.product_name);

  const displayedConversations = (viewMode === 'sokoni' ? sokoniConversations : regularConversations).filter(c => {
    const isBuyer = Number(c.buyer) === Number(userId);
    const otherUser = isBuyer ? c.seller_username : c.buyer_username;
    const product = c.product_name || '';
    return otherUser.toLowerCase().includes(searchQuery.toLowerCase()) || 
           product.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const sokoniUnreadCount = sokoniConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const latestSokoniTimestamp = sokoniConversations.reduce((latest, c) => {
    if (!c.last_message) return latest;
    const msgTime = new Date(c.last_message.created_at).getTime();
    return msgTime > latest ? msgTime : latest;
  }, 0);

  // Group messages by day
  const groupedMessages = currentMessages.reduce((groups: { [key: string]: Message[] }, msg) => {
    const date = new Date(msg.created_at).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  const formatDayHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🙏'];

  if (contextLoading && conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('loading_chats', 'Loading your chats...')}</p>
        </div>
      </div>
    );
  }

  // Mobile layout condition
  const isMobileThreadActive = !!id;

  return (
    <div className="h-[calc(100vh-4.5rem)] md:h-[calc(100vh-6.5rem)] flex flex-col">
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* --- 1. Conversations Sidebar --- */}
        <div className={`w-full md:w-80 lg:w-96 flex flex-col md:border-r md:border-gray-200/60 dark:md:border-neutral-800/60 ${isMobileThreadActive ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 md:px-5 pt-4 pb-3 flex flex-col gap-3">
            {viewMode === 'main' ? (
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                  <MessageSquare className="text-brand-500" size={20} /> {t('chats')}
                </h1>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setViewMode('main')}
                  className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
                <h1 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                  Sokoni Leo
                </h1>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600" size={14} />
              <input
                type="text"
                placeholder={t('search_messenger', 'Search Messenger...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200/60 dark:border-neutral-800/50 rounded-full bg-gray-100/70 dark:bg-neutral-900/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/30 transition-all outline-none"
              />
            </div>
          </div>

          {/* Conversations Scroll List */}
          <div className="flex-1 overflow-y-auto px-2 md:px-3 space-y-0.5">
            {displayedConversations.length === 0 && viewMode === 'sokoni' ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">No Sokoni Leo chats found</p>
              </div>
            ) : displayedConversations.length === 0 && viewMode === 'main' && searchQuery ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">No chats found</p>
              </div>
            ) : null}

            {viewMode === 'main' && !searchQuery && (
              <div
                onClick={() => setViewMode('sokoni')}
                className="flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-neutral-900/50"
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-900 dark:bg-black border border-gray-800 dark:border-neutral-800 overflow-hidden shadow-sm">
                    <img src="/logo.png" alt="Sokoni Leo Logo" className="w-8 h-8 object-contain" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-1.5">
                    <span className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1 truncate">
                      Sokoni Leo
                    </span>
                    {latestSokoniTimestamp > 0 && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {formatRelativeTime(new Date(latestSokoniTimestamp).toISOString())}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center gap-1.5 mt-0.5">
                    <p className={`text-xs truncate flex-1 ${sokoniUnreadCount > 0 ? 'text-gray-900 dark:text-white font-extrabold' : 'text-gray-500 dark:text-gray-400'}`}>
                      {sokoniUnreadCount > 0 ? `${sokoniUnreadCount} new messages` : 'No new messages'}
                    </p>
                    {sokoniUnreadCount > 0 && (
                      <span className="shrink-0 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-sm animate-pulse">
                        {sokoniUnreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {displayedConversations.map(conv => {
                const isBuyer = Number(conv.buyer) === Number(userId);
                const otherUsername = isBuyer ? conv.seller_username : conv.buyer_username;
                const isVerified = isBuyer ? conv.seller_verified : conv.buyer_verified;
                const userTier = isBuyer ? conv.seller_tier : conv.buyer_tier;
                const isActive = id && parseInt(id) === conv.id;
                const initials = otherUsername.substring(0, 2).toUpperCase();

                return (
                  <div
                    key={conv.id}
                    onClick={() => navigate(`/messages/${conv.id}`)}
                    className={`flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? 'bg-brand-50 dark:bg-brand-950/20 text-brand-600' 
                        : 'hover:bg-gray-50 dark:hover:bg-neutral-900/50'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0" onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/${otherUsername}`);
                    }}>
                      {viewMode === 'sokoni' && conv.product_image ? (
                        <img 
                          src={conv.product_image} 
                          alt="Product"
                          className="w-12 h-12 rounded-full object-cover shadow-sm border border-gray-200 dark:border-neutral-700"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br ${getGradient(otherUsername)} shadow-sm hover:opacity-80 transition-opacity`}>
                          {initials}
                        </div>
                      )}
                      {/* Premium visual: small active green indicator dot */}
                      {conv.is_online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface-muted dark:border-surface-dark" />
                      )}
                    </div>

                    {/* Chat details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1.5">
                        <span 
                          className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1 truncate hover:underline hover:text-brand-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/${otherUsername}`);
                          }}
                        >
                          {viewMode === 'sokoni' ? `${otherUsername} · ${conv.product_name || 'Product'}` : otherUsername}
                          {isVerified && viewMode !== 'sokoni' && (
                            <VerifiedBadge tier={userTier} isVerified={isVerified} className="shrink-0 w-3.5 h-3.5" />
                          )}
                        </span>
                        {conv.last_message && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {formatRelativeTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>

                      {conv.product_name && viewMode !== 'sokoni' && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {conv.product_image && (
                            <img
                              src={conv.product_image}
                              alt={conv.product_name}
                              className="w-4 h-4 rounded object-cover border border-gray-150 dark:border-neutral-800 shrink-0"
                            />
                          )}
                          <p className="text-[10px] font-bold text-brand-500 truncate">
                            Re: {conv.product_name}
                          </p>
                        </div>
                      )}

                      <div className="flex justify-between items-center gap-1.5 mt-0.5">
                        {typingStatus[conv.id] ? (
                          <p className="text-xs text-brand-500 font-bold truncate flex-1 animate-pulse">
                            typing...
                          </p>
                        ) : (
                          <p className={`text-xs truncate flex-1 ${
                            conv.unread_count > 0 
                              ? 'text-gray-900 dark:text-white font-extrabold' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {conv.last_message ? conv.last_message.content : 'No messages yet'}
                          </p>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="shrink-0 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-sm animate-pulse">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
              }
          </div>
        </div>

        {/* --- 2. Chat Thread Area --- */}
        <div className={`flex-1 flex flex-col ${!isMobileThreadActive ? 'hidden md:flex' : 'flex'}`}>
          {!id ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <EmptyState
                icon={MessageSquare}
                title={t('conversations_title', 'Your Conversations')}
                description={t('select_contact_desc', 'Select a contact from the side menu to begin chatting.')}
              />
            </div>
          ) : (
            /* Active Thread */
            <>
              {/* Thread Header */}
              <div className="px-4 md:px-5 py-3 border-b border-gray-200/60 dark:border-neutral-800/50 flex items-center justify-between shrink-0 z-10 backdrop-blur-xl bg-white/60 dark:bg-black/30">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Mobile Back Button */}
                  <button 
                    onClick={() => navigate('/messages')} 
                    className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  {/* Contact Avatar */}
                  {activeConv && (
                    <div 
                      className="relative shrink-0 cursor-pointer"
                      onClick={() => navigate(`/${Number(activeConv.buyer) === Number(userId) ? activeConv.seller_username : activeConv.buyer_username}`)}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br ${getGradient(Number(activeConv.buyer) === Number(userId) ? activeConv.seller_username : activeConv.buyer_username)} hover:opacity-80 transition-opacity`}>
                        {(Number(activeConv.buyer) === Number(userId) ? activeConv.seller_username : activeConv.buyer_username).substring(0, 2).toUpperCase()}
                      </div>
                      {activeConv.is_online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white/80 dark:border-neutral-900/80" />
                      )}
                    </div>
                  )}

                  {/* Header Titles */}
                  <div className="min-w-0">
                    <span 
                      className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1 cursor-pointer hover:underline hover:text-brand-500 transition-colors"
                      onClick={() => activeConv && navigate(`/${Number(activeConv.buyer) === Number(userId) ? activeConv.seller_username : activeConv.buyer_username}`)}
                    >
                      {activeConv ? (Number(activeConv.buyer) === Number(userId) ? activeConv.seller_username : activeConv.buyer_username) : 'Chat'}
                      {activeConv && Number(activeConv.buyer) === Number(userId) && (
                        <VerifiedBadge tier={activeConv.seller_tier} isVerified={activeConv.seller_verified} className="w-3.5 h-3.5" />
                      )}
                    </span>
                    {activeConv && typingStatus[parseInt(id || '')] ? (
                      <p className="text-[10px] text-brand-500 font-semibold flex items-center gap-1 leading-none mt-0.5 animate-pulse">
                        typing...
                      </p>
                    ) : activeConv && activeConv.is_online ? (
                      <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 leading-none mt-0.5">
                        Active now
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 leading-none mt-0.5">
                        {activeConv?.last_seen ? `Last seen ${formatRelativeTime(activeConv.last_seen)}` : 'Offline'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-1 text-gray-400">
                  {/* Mock buttons removed to prevent non-functional placeholders */}
                </div>
              </div>


              {/* Product Reference Banner */}
              {activeConv && activeConv.product_name && (
                <div className="px-4 md:px-5 py-2 border-b border-gray-200/60 dark:border-neutral-800/50 flex items-center justify-between gap-3 text-xs shrink-0 font-medium bg-brand-50/30 dark:bg-brand-950/5">
                  <span className="text-gray-600 dark:text-gray-300">
                    Regarding: <strong className="text-brand-600 dark:text-brand-400">{activeConv.product_name}</strong>
                  </span>
                  {activeConv.product && (
                    <button 
                      onClick={() => navigate(`/product/${activeConv.product}`)}
                      className="text-brand-500 hover:underline font-bold text-[11px]"
                    >
                      View item
                    </button>
                  )}
                </div>
              )}

              {/* Chat Messages Log Scroll */}
              <div 
                className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-6 relative" 
                ref={scrollRef}
                onScroll={handleScroll}
              >
                <AnimatePresence initial={false}>
                  {Object.keys(groupedMessages).length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center text-xs text-gray-400">
                      No messages in this conversation yet. Send a message to start!
                    </motion.div>
                  )}

                  {Object.keys(groupedMessages).map(dateStr => (
                    <div key={dateStr} className="space-y-4">
                      {/* Day divider */}
                      <motion.div className="flex justify-center my-4">
                        <span className="px-3 py-1 bg-gray-200/55 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 text-[10px] font-bold rounded-full tracking-wide">
                          {formatDayHeader(dateStr)}
                        </span>
                      </motion.div>

                      {/* Messages in day */}
                      {groupedMessages[dateStr].map((msg, index) => {
                        const isMe = Number(msg.sender) === Number(userId);
                        const showAvatar = !isMe;
                        
                        // Display precise date on hover
                        const messageTime = new Date(msg.created_at).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        });

                        return (
                          <div key={msg.id} className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {/* Sender Avatar */}
                            {showAvatar && (
                              <div 
                                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-[11px] bg-gradient-to-br ${getGradient(msg.sender_username)} cursor-pointer hover:opacity-80 transition-opacity`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/${msg.sender_username}`);
                                }}
                              >
                                {msg.sender_username.substring(0, 2).toUpperCase()}
                              </div>
                            )}

                            {/* Bubble Container */}
                            <motion.div 
                              initial={{ opacity: 0, y: 15, scale: 0.5 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ 
                                opacity: { duration: 0.2 },
                                default: { type: "spring", bounce: 0.4, duration: 0.5 }
                              }}
                              style={{ transformOrigin: isMe ? "bottom right" : "bottom left" }}
                              className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                            >
                              {/* Message Bubble wrapper with tooltip-like time reveal */}
                              <div className="group relative">
                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed transition-all whitespace-pre-wrap break-words ${
                                  isMe
                                    ? 'bg-brand-500 text-white rounded-br-sm shadow-sm'
                                    : 'bg-white/80 dark:bg-white/[0.06] border border-gray-200/50 dark:border-white/[0.06] text-gray-900 dark:text-white rounded-bl-sm'
                                }`}>
                                  {msg.content}
                                </div>

                                {/* Hover timestamp */}
                                <span className={`absolute top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap ${
                                  isMe ? '-left-14' : '-right-14'
                                }`}>
                                  {messageTime}
                                </span>
                              </div>

                              {/* Unread / status indicators below own messages */}
                              {isMe && index === groupedMessages[dateStr].length - 1 && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                                  {msg.id < 0 ? (
                                    <span className="animate-pulse">Sending...</span>
                                  ) : (
                                    <>
                                      <span>Sent</span>
                                      {msg.is_read ? (
                                        <CheckCheck size={12} className="text-brand-500" />
                                      ) : msg.is_delivered ? (
                                        <CheckCheck size={12} className="text-gray-400" />
                                      ) : (
                                        <Check size={12} className="text-gray-400" />
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                {/* Animated Typing Indicator */}
                  {(typingStatus[parseInt(id || '')]) && (
                    <div className="flex items-end gap-2.5">
                    {activeConv && (
                      <div 
                        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-[11px] bg-gradient-to-br ${getGradient(activeConv.buyer === userId ? activeConv.seller_username : activeConv.buyer_username)} cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/${activeConv.buyer === userId ? activeConv.seller_username : activeConv.buyer_username}`);
                        }}
                      >
                        {(activeConv.buyer === userId ? activeConv.seller_username : activeConv.buyer_username).substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <motion.div 
                      initial={{ opacity: 0, y: 15, scale: 0.5 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ 
                        opacity: { duration: 0.2 },
                        default: { type: "spring", bounce: 0.4, duration: 0.5 }
                      }}
                      style={{ transformOrigin: "bottom left" }}
                      className="bg-white/80 dark:bg-white/[0.06] border border-gray-200/50 dark:border-white/[0.06] px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5 shrink-0"
                    >
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </motion.div>
                    </div>
                  )}
                </AnimatePresence>
                <div ref={messageEndRef} />
              </div>
              
              {/* New message indicator pill */}
              {isScrolledUp && newMessagesCount > 0 && (
                <div className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 z-20">
                  <button 
                    onClick={() => {
                      scrollToBottom('smooth');
                      setNewMessagesCount(0);
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 text-white rounded-full shadow-lg text-[11px] font-bold hover:bg-brand-600 transition-colors animate-bounce"
                  >
                    {newMessagesCount} new message{newMessagesCount > 1 ? 's' : ''} 
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                  </button>
                </div>
              )}

              {/* Chat Input Console */}
              <div className="px-3 md:px-4 py-3 border-t border-gray-200/60 dark:border-neutral-800/50 flex flex-col gap-2 shrink-0 z-10 backdrop-blur-xl bg-white/60 dark:bg-black/30">
                {/* Emoji Quickbar */}
                {showEmojiPicker && (
                  <div className="flex items-center gap-2 p-1.5 bg-gray-100/60 dark:bg-neutral-900/40 rounded-full border border-gray-200/50 dark:border-neutral-800/40 overflow-x-auto">
                    {quickEmojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => sendEmoji(emoji)}
                        className="text-lg hover:scale-125 hover:-translate-y-0.5 active:scale-95 transition-transform p-1 rounded-btn hover:bg-gray-150 dark:hover:bg-neutral-800"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 relative w-full">
                  {/* Input form */}
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => handleInputChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                      placeholder={t('type_a_message')}
                      className="w-full pr-10 pl-4 py-2.5 text-sm border border-gray-200/60 dark:border-neutral-800/50 rounded-full bg-gray-100/50 dark:bg-neutral-900/40 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/30 transition-all outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600"
                    />
                    <button 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`absolute right-3.5 p-1 rounded-full text-gray-400 hover:text-brand-500 transition-colors ${showEmojiPicker ? 'text-brand-500' : ''}`}
                    >
                      <Smile size={16} />
                    </button>
                  </div>

                  {/* Send Button */}
                  <Button 
                    onClick={handleSend} 
                    disabled={!newMessage.trim()}
                    size="icon"
                    className="shrink-0"
                  >
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
