import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  MessageSquare, Send, ArrowLeft, Search, Smile, 
  CheckCheck, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import VerifiedBadge from '../components/VerifiedBadge';
import { useMessages, Message } from '../context/MessageContext';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';

const MessagesPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = parseInt(localStorage.getItem('user_id') || '0');

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
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTypingSimulated, setIsTypingSimulated] = useState(false);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const lastConvIdRef = useRef<string | undefined>(undefined);
  const typingTimeoutRef = useRef<number | null>(null);
  const [isLocallyTyping, setIsLocallyTyping] = useState(false);

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
    }, 2000);
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
      
      // Simulate a small typing effect when entering a chat for visual premium flair
      setIsTypingSimulated(true);
      const timer = setTimeout(() => setIsTypingSimulated(false), 1500);
      return () => clearTimeout(timer);
    } else {
      setActiveConversationId(null);
    }
  }, [id, setActiveConversationId, fetchMessages]);

  // Handle direct message URL parameters like ?user=username
  useEffect(() => {
    if (!id && !contextLoading) {
      const targetUser = searchParams.get('user');
      if (targetUser) {
        const existing = conversations.find(c => 
          c.buyer_username === targetUser || c.seller_username === targetUser
        );
        if (existing) {
          navigate(`/messages/${existing.id}`, { replace: true });
        } else {
          // Fetch target profile first to start conversation
          api.get(`/api/profiles/${targetUser}/`)
            .then(res => {
              const targetUserId = res.data.user_id;
              if (targetUserId) {
                return api.post('/api/conversations/', { seller: targetUserId });
              }
              throw new Error('User ID not found');
            })
            .then(res => {
              navigate(`/messages/${res.data.id}`, { replace: true });
            })
            .catch(() => toast.error(`Could not start conversation with ${targetUser}`));
        }
      }
    }
  }, [id, conversations, searchParams, navigate, contextLoading]);

  const activeConv = conversations.find(c => c.id === parseInt(id || ''));

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messageEndRef.current?.scrollIntoView({ behavior });
  };

  const currentMessages = id ? (messages[parseInt(id)] || []) : [];

  useEffect(() => {
    if (currentMessages.length > 0) {
      if (id !== lastConvIdRef.current) {
        scrollToBottom('auto');
        lastConvIdRef.current = id;
      } else {
        scrollToBottom('smooth');
      }
    }
  }, [currentMessages, id]);

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

  const filteredConversations = conversations.filter(c => {
    const otherUser = c.buyer === userId ? c.seller_username : c.buyer_username;
    const product = c.product_name || '';
    return otherUser.toLowerCase().includes(searchQuery.toLowerCase()) || 
           product.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
    <div className="container-page py-4 md:py-6 h-[calc(100vh-4.5rem)] md:h-[calc(100vh-6.5rem)] flex flex-col">
      <div className="flex-1 flex bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-neutral-900 rounded-card overflow-hidden shadow-xl min-h-0 relative">
        
        {/* --- 1. Conversations Sidebar --- */}
        <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-gray-100 dark:border-neutral-900 ${isMobileThreadActive ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                <MessageSquare className="text-brand-500" size={20} /> {t('chats')}
              </h1>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600" size={14} />
              <input
                type="text"
                placeholder={t('search_messenger', 'Search Messenger...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border-none rounded-btn bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white placeholder:text-gray-500 focus:ring-2 focus:ring-brand-500/25 transition-all outline-none"
              />
            </div>
          </div>

          {/* Conversations Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-neutral-950 px-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">No chats found</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const otherUsername = conv.buyer === userId ? conv.seller_username : conv.buyer_username;
                const isVerified = conv.buyer === userId ? conv.seller_verified : false;
                const userTier = conv.buyer === userId ? conv.seller_tier : 'free';
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
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br ${getGradient(otherUsername)} shadow-sm`}>
                        {initials}
                      </div>
                      {/* Premium visual: small active green indicator dot */}
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0d0d0d]" />
                    </div>

                    {/* Chat details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1.5">
                        <span className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1 truncate">
                          {otherUsername}
                          {conv.buyer === userId && (
                            <VerifiedBadge tier={userTier} isVerified={isVerified} className="shrink-0 w-3.5 h-3.5" />
                          )}
                        </span>
                        {conv.last_message && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {formatRelativeTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>

                      {conv.product_name && (
                        <p className="text-[10px] font-bold text-brand-500 truncate mt-0.5">
                          Re: {conv.product_name}
                        </p>
                      )}

                      <div className="flex justify-between items-center gap-1.5 mt-0.5">
                        <p className={`text-xs truncate flex-1 ${
                          conv.unread_count > 0 
                            ? 'text-gray-900 dark:text-white font-extrabold' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {conv.last_message ? conv.last_message.content : 'No messages yet'}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="shrink-0 px-2 py-0.5 bg-brand-500 text-white text-[10px] font-bold rounded-full shadow-sm animate-pulse">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* --- 2. Chat Thread Area --- */}
        <div className={`flex-1 flex flex-col bg-gray-50/50 dark:bg-neutral-950/20 ${!isMobileThreadActive ? 'hidden md:flex' : 'flex'}`}>
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
              <div className="p-4 bg-white dark:bg-[#111] border-b border-surface-border dark:border-surface-dark-border flex items-center justify-between shrink-0 shadow-sm z-10">
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
                    <div className="relative shrink-0">
                      <div className={`w-10.5 h-10.5 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br ${getGradient(activeConv.buyer === userId ? activeConv.seller_username : activeConv.buyer_username)}`}>
                        {(activeConv.buyer === userId ? activeConv.seller_username : activeConv.buyer_username).substring(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0d0d0d]" />
                    </div>
                  )}

                  {/* Header Titles */}
                  <div className="min-w-0">
                    <span className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1">
                      {activeConv ? (activeConv.buyer === userId ? activeConv.seller_username : activeConv.buyer_username) : 'Chat'}
                      {activeConv && activeConv.buyer === userId && (
                        <VerifiedBadge tier={activeConv.seller_tier} isVerified={activeConv.seller_verified} className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 leading-none mt-0.5">
                      Active now
                    </p>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-1 text-gray-400">
                  {/* Mock buttons removed to prevent non-functional placeholders */}
                </div>
              </div>


              {/* Product Reference Banner */}
              {activeConv && activeConv.product_name && (
                <div className="bg-brand-50/50 dark:bg-brand-950/10 px-4 py-2 border-b border-brand-500/10 flex items-center justify-between gap-3 text-xs shrink-0 font-medium">
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
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {Object.keys(groupedMessages).map(dateStr => (
                  <div key={dateStr} className="space-y-4">
                    {/* Day divider */}
                    <div className="flex justify-center my-4">
                      <span className="px-3 py-1 bg-gray-200/55 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 text-[10px] font-bold rounded-full tracking-wide">
                        {formatDayHeader(dateStr)}
                      </span>
                    </div>

                    {/* Messages in day */}
                    {groupedMessages[dateStr].map((msg, index) => {
                      const isMe = msg.sender === userId;
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
                            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-[11px] bg-gradient-to-br ${getGradient(msg.sender_username)}`}>
                              {msg.sender_username.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          {/* Bubble Container */}
                          <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {/* Message Bubble wrapper with tooltip-like time reveal */}
                            <div className="group relative">
                              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed transition-all shadow-sm ${
                                isMe
                                  ? 'bg-brand-500 text-white rounded-br-sm'
                                  : 'bg-white dark:bg-[#121212] border border-gray-100 dark:border-neutral-900 text-gray-900 dark:text-white rounded-bl-sm'
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
                                    {msg.is_read ? <CheckCheck size={11} className="text-brand-500" /> : <Check size={11} />}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Animated Typing Indicator */}
                {(isTypingSimulated || typingStatus[parseInt(id || '')]) && (
                  <div className="flex items-end gap-2.5">
                    {activeConv && (
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-[11px] bg-gradient-to-br ${getGradient(activeConv.buyer === userId ? activeConv.seller_username : activeConv.buyer_username)}`}>
                        {(activeConv.buyer === userId ? activeConv.seller_username : activeConv.buyer_username).substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-neutral-900 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messageEndRef} />
              </div>

              {/* Chat Input Console */}
              <div className="p-3 bg-white dark:bg-[#111] border-t border-surface-border dark:border-surface-dark-border flex flex-col gap-2 shrink-0 z-10">
                {/* Emoji Quickbar */}
                {showEmojiPicker && (
                  <div className="flex items-center gap-2 p-1.5 bg-surface-muted dark:bg-[#0A0A0A] rounded-btn border border-surface-border dark:border-surface-dark-border overflow-x-auto shadow-inner">
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
                      className="w-full pr-10 pl-4 py-2.5 text-sm border border-surface-border dark:border-surface-dark-border rounded-btn bg-surface-muted dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/25 transition-all outline-none"
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
