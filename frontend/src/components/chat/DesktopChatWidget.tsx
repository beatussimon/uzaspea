import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Send, ArrowLeft, Search, Smile, 
  CheckCheck, Check, Minus, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useMessages, Message } from '../../context/MessageContext';
import VerifiedBadge from '../VerifiedBadge';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';

export const DesktopChatWidget: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.user_id || (user as any)?.id || parseInt(localStorage.getItem('user_id') || '0');

  const {
    conversations,
    messages,
    fetchMessages,
    sendMessage,
    loading: contextLoading,
    typingStatus,
    sendTypingStatus,
    isDesktopPopupOpen,
    desktopActiveConvId,
    setDesktopActiveConvId,
    isDesktopMinimized,
    closeDesktopChat,
    openDesktopChat,
    toggleDesktopMinimize,
    desktopPrefillMessage,
    setDesktopPrefillMessage,
    openConvIds,
    closeThreadBubble,
  } = useMessages();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'main' | 'sokoni'>('main');
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [isLocallyTyping, setIsLocallyTyping] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  // Outside click listener: minimizes popup to floating bubble when clicking elsewhere on the page
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (isDesktopPopupOpen && !isDesktopMinimized && widgetRef.current) {
        if (!widgetRef.current.contains(e.target as Node)) {
          const isNavbarMsgBtn = (e.target as HTMLElement).closest('[aria-label="View messages"]');
          if (!isNavbarMsgBtn) {
            toggleDesktopMinimize();
          }
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDesktopPopupOpen, isDesktopMinimized, toggleDesktopMinimize]);

  // Handle prefill message
  useEffect(() => {
    if (desktopPrefillMessage) {
      setNewMessage(desktopPrefillMessage);
      setDesktopPrefillMessage('');
    }
  }, [desktopPrefillMessage, setDesktopPrefillMessage]);

  // Fetch messages when desktop active conversation changes
  useEffect(() => {
    if (desktopActiveConvId) {
      fetchMessages(desktopActiveConvId);
      setIsLocallyTyping(false);
    }
  }, [desktopActiveConvId, fetchMessages]);

  const activeConv = conversations.find(c => c.id === desktopActiveConvId);

  const handleInputChange = (val: string) => {
    setNewMessage(val);
    if (!desktopActiveConvId) return;

    if (val.trim() === '') {
      if (isLocallyTyping) {
        setIsLocallyTyping(false);
        sendTypingStatus(desktopActiveConvId, false);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }

    if (!isLocallyTyping) {
      setIsLocallyTyping(true);
      sendTypingStatus(desktopActiveConvId, true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsLocallyTyping(false);
      sendTypingStatus(desktopActiveConvId, false);
    }, 4000);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messageEndRef.current?.scrollIntoView({ behavior });
  };

  const currentMessages = desktopActiveConvId ? (messages[desktopActiveConvId] || []) : [];
  const currentTypingStatus = desktopActiveConvId ? typingStatus[desktopActiveConvId] : false;

  const prevMessagesLengthRef = useRef(currentMessages.length);
  useEffect(() => {
    if (currentMessages.length > prevMessagesLengthRef.current) {
      const addedCount = currentMessages.length - prevMessagesLengthRef.current;
      const lastMsg = currentMessages[currentMessages.length - 1];
      const isMyMsg = lastMsg && Number(lastMsg.sender) === Number(userId);

      if (isMyMsg) {
        scrollToBottom('smooth');
      } else if (isScrolledUp) {
        // User is scrolling UP reading history -> DO NOT AUTO-SCROLL DOWN!
        setNewMessagesCount(prev => prev + addedCount);
      } else {
        scrollToBottom('smooth');
      }
    }
    prevMessagesLengthRef.current = currentMessages.length;
  }, [currentMessages, isScrolledUp, userId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isUp = scrollHeight - scrollTop > clientHeight + 40;
    setIsScrolledUp(isUp);
    if (!isUp) setNewMessagesCount(0);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !desktopActiveConvId) return;
    const msgContent = newMessage;
    setNewMessage('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsLocallyTyping(false);
    sendTypingStatus(desktopActiveConvId, false);

    try {
      await sendMessage(desktopActiveConvId, msgContent);
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
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

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
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🙏'];

  if (!isDesktopPopupOpen) return null;

  const otherUsername = activeConv 
    ? (Number(activeConv.buyer) === Number(userId) ? activeConv.seller_username : activeConv.buyer_username)
    : '';

  const totalUnreadCount = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Person-specific open threads
  const activeOpenConversations = conversations.filter(c => openConvIds.includes(c.id));

  return (
    <div className="fixed bottom-0 right-6 z-50 hidden md:flex items-end gap-3 pointer-events-none">
      {/* --- Person-Specific Minimized Floating Bubbles Stack --- */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {activeOpenConversations.map(conv => {
          const isBuyer = Number(conv.buyer) === Number(userId);
          const personName = isBuyer ? conv.seller_username : conv.buyer_username;
          const isSelected = desktopActiveConvId === conv.id && !isDesktopMinimized;

          if (isSelected) return null; // Don't show bubble for currently expanded active window

          return (
            <motion.div
              key={conv.id}
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              onClick={() => openDesktopChat(conv.id)}
              className="group relative mb-2 p-1 bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-neutral-800 rounded-full shadow-card-hover flex items-center cursor-pointer hover:scale-105 transition-all border-brand-500/20"
              title={`Chat with ${personName}`}
            >
              <div className="relative shrink-0">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${getGradient(personName)} shadow-md`}>
                  {personName.substring(0, 2).toUpperCase()}
                </div>
                {conv.is_online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-black" />
                )}
                {conv.unread_count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-pulse shadow-md border-2 border-white dark:border-black">
                    {conv.unread_count > 99 ? '99' : conv.unread_count}
                  </span>
                )}
              </div>

              {/* Close Button on Bubble Hover */}
              <button 
                onClick={(e) => { e.stopPropagation(); closeThreadBubble(conv.id); }}
                className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 p-0.5 bg-gray-800 text-white rounded-full hover:bg-red-500 transition-all shadow-md"
                title="Close bubble"
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* --- Main Desktop Window / Default Minimized Bubble --- */}
      <div className="pointer-events-auto">
        <AnimatePresence mode="wait">
          {isDesktopMinimized ? (
            /* Default Minimized Floating Bubble */
            <motion.div
              key="minimized"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              onClick={toggleDesktopMinimize}
              className="group mb-2 px-3.5 py-2 bg-white/95 dark:bg-black/95 border border-gray-200 dark:border-neutral-800 rounded-full shadow-card-hover flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all active:scale-95 border-brand-500/20"
            >
              <div className="relative shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${getGradient(otherUsername || 'User')} shadow-sm`}>
                  {otherUsername ? otherUsername.substring(0, 2).toUpperCase() : <MessageSquare size={14} />}
                </div>
                {activeConv?.is_online && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-black" />
                )}
                {totalUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center animate-pulse shadow-sm">
                    {totalUnreadCount > 99 ? '99' : totalUnreadCount}
                  </span>
                )}
              </div>

              <span className="font-bold text-xs text-gray-900 dark:text-white truncate max-w-[120px]">
                {activeConv ? otherUsername : 'Messages'}
              </span>

              <button 
                onClick={(e) => { e.stopPropagation(); closeDesktopChat(); }}
                className="p-1 rounded-full text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors ml-1"
                title="Close chat"
              >
                <X size={13} />
              </button>
            </motion.div>
          ) : isDesktopPopupOpen ? (
          /* --- Expanded Pop-up Window --- */
          <motion.div
            key="expanded"
            ref={widgetRef}
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="w-[380px] h-[540px] bg-white dark:bg-black border border-gray-200/90 dark:border-neutral-800 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-surface-muted/80 dark:bg-neutral-900/80 border-b border-gray-200/60 dark:border-neutral-800/60 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2.5 min-w-0">
                {desktopActiveConvId && (
                  <button 
                    onClick={() => setDesktopActiveConvId(null)}
                    className="p-1 -ml-1 rounded-full hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-600 dark:text-gray-300 transition-colors"
                    title="Back to conversations"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                
                {desktopActiveConvId && activeConv ? (
                  <div 
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/${otherUsername}`)}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${getGradient(otherUsername)}`}>
                        {otherUsername.substring(0, 2).toUpperCase()}
                      </div>
                      {activeConv.is_online && (
                        <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white dark:border-black" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-xs text-gray-900 dark:text-white truncate hover:underline">
                          {otherUsername}
                        </span>
                        <VerifiedBadge tier={activeConv.seller_tier} isVerified={activeConv.seller_verified} className="w-3 h-3 shrink-0" />
                      </div>
                      <p className="text-[10px] text-gray-400 font-semibold truncate">
                        {typingStatus[desktopActiveConvId] ? (
                          <span className="text-brand-500 animate-pulse">typing...</span>
                        ) : activeConv.is_online ? (
                          <span className="text-emerald-500">Active now</span>
                        ) : (
                          'Offline'
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="text-brand-500" size={18} />
                    <h3 className="font-extrabold text-sm text-gray-900 dark:text-white tracking-tight">
                      {viewMode === 'main' ? t('chats', 'Messages') : 'Sokoni Leo'}
                    </h3>
                  </div>
                )}
              </div>

              {/* Header Window Actions */}
              <div className="flex items-center gap-1 text-gray-400">
                <button 
                  onClick={toggleDesktopMinimize}
                  className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Minimize"
                >
                  <Minus size={14} />
                </button>
                <button 
                  onClick={closeDesktopChat}
                  className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* --- Body Content --- */}
            {!desktopActiveConvId ? (
              /* --- Conversations List View --- */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-gray-100 dark:border-neutral-900">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600" size={14} />
                    <input
                      type="text"
                      placeholder={t('search_messenger', 'Search Messenger...')}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 text-xs border border-gray-200/60 dark:border-neutral-800/50 rounded-full bg-gray-100/70 dark:bg-neutral-900/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/30 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
                  {contextLoading && conversations.length === 0 ? (
                    <div className="py-12 flex justify-center">
                      <Spinner size="sm" />
                    </div>
                  ) : displayedConversations.length === 0 ? (
                    <div className="py-12 text-center text-xs text-gray-400">
                      No conversations found
                    </div>
                  ) : null}

                  {viewMode === 'main' && !searchQuery && (
                    <div
                      onClick={() => setViewMode('sokoni')}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black border border-neutral-800 shrink-0">
                        <img src="/logo.png" alt="Sokoni" className="w-6 h-6 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold text-xs text-gray-900 dark:text-white">Sokoni Leo</span>
                          {sokoniUnreadCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full">
                              {sokoniUnreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">Product inquiries & offers</p>
                      </div>
                    </div>
                  )}

                  {displayedConversations.map(conv => {
                    const isBuyer = Number(conv.buyer) === Number(userId);
                    const otherUser = isBuyer ? conv.seller_username : conv.buyer_username;
                    const initials = otherUser.substring(0, 2).toUpperCase();

                    return (
                      <div
                        key={conv.id}
                        onClick={() => setDesktopActiveConvId(conv.id)}
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors"
                      >
                        <div className="relative shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${getGradient(otherUser)}`}>
                            {initials}
                          </div>
                          {conv.is_online && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-black" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                              {otherUser}
                            </span>
                            {conv.last_message && (
                              <span className="text-[9px] text-gray-400 shrink-0">
                                {formatRelativeTime(conv.last_message.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center gap-1 mt-0.5">
                            <p className={`text-[11px] truncate flex-1 ${conv.unread_count > 0 ? 'text-gray-900 dark:text-white font-extrabold' : 'text-gray-500 dark:text-gray-400'}`}>
                              {conv.last_message ? conv.last_message.content : 'No messages yet'}
                            </p>
                            {conv.unread_count > 0 && (
                              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full shrink-0">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* --- Active Chat Thread View --- */
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Product Reference Banner */}
                {activeConv?.product_name && (
                  <div className="px-3 py-1.5 bg-brand-50/40 dark:bg-brand-950/10 border-b border-gray-100 dark:border-neutral-900 flex items-center justify-between text-[11px] shrink-0 font-medium">
                    <span className="text-gray-600 dark:text-gray-300 truncate">
                      Re: <strong className="text-brand-500">{activeConv.product_name}</strong>
                    </span>
                    {activeConv.product && (
                      <button 
                        onClick={() => navigate(`/product/${activeConv.product}`)}
                        className="text-brand-500 hover:underline font-bold text-[10px] shrink-0 ml-2"
                      >
                        View
                      </button>
                    )}
                  </div>
                )}

                {/* Messages Log */}
                <div 
                  className="flex-1 overflow-y-auto px-3 py-3 space-y-4 relative" 
                  ref={scrollRef}
                  onScroll={handleScroll}
                >
                  {Object.keys(groupedMessages).length === 0 && (
                    <div className="py-12 text-center text-xs text-gray-400">
                      No messages yet. Send a message to start!
                    </div>
                  )}

                  {Object.keys(groupedMessages).map(dateStr => (
                    <div key={dateStr} className="space-y-3">
                      <div className="flex justify-center my-2">
                        <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 text-[9px] font-bold rounded-full">
                          {formatDayHeader(dateStr)}
                        </span>
                      </div>

                      {groupedMessages[dateStr].map((msg, index) => {
                        const isMe = Number(msg.sender) === Number(userId);

                        return (
                          <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                                isMe 
                                  ? 'bg-brand-500 text-white rounded-br-sm shadow-sm' 
                                  : 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white rounded-bl-sm border border-gray-200/40 dark:border-neutral-800/40'
                              }`}>
                                {msg.content}
                              </div>

                              {isMe && index === groupedMessages[dateStr].length - 1 && (
                                <div className="mt-0.5 flex items-center gap-1 text-[9px] text-gray-400">
                                  {msg.id < 0 ? (
                                    <span>Sending...</span>
                                  ) : (
                                    <>
                                      <span>Sent</span>
                                      {msg.is_read ? (
                                        <CheckCheck size={10} className="text-brand-500" />
                                      ) : msg.is_delivered ? (
                                        <CheckCheck size={10} className="text-gray-400" />
                                      ) : (
                                        <Check size={10} className="text-gray-400" />
                                      )}
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

                  {currentTypingStatus && (
                    <div className="flex items-center gap-1.5 p-2 bg-gray-100 dark:bg-neutral-900 rounded-2xl w-14">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}

                  <div ref={messageEndRef} />
                </div>

                {/* New Messages Floating Pill */}
                {isScrolledUp && newMessagesCount > 0 && (
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
                    <button 
                      onClick={() => scrollToBottom('smooth')}
                      className="px-3 py-1 bg-brand-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-bounce"
                    >
                      {newMessagesCount} new message{newMessagesCount > 1 ? 's' : ''} ↓
                    </button>
                  </div>
                )}

                {/* Input Console */}
                <div className="p-2.5 border-t border-gray-200/60 dark:border-neutral-800/60 bg-surface-muted/60 dark:bg-neutral-950/60 flex flex-col gap-2 shrink-0">
                  {showEmojiPicker && (
                    <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-neutral-900 rounded-full overflow-x-auto">
                      {quickEmojis.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => sendEmoji(emoji)}
                          className="text-sm p-1 hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={e => handleInputChange(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          } else if (e.key === 'Escape') {
                            toggleDesktopMinimize();
                          }
                        }}
                        placeholder={t('type_a_message', 'Type a message...')}
                        className="w-full pr-8 pl-3 py-2 text-xs border border-gray-200/60 dark:border-neutral-800/50 rounded-full bg-gray-100/50 dark:bg-neutral-900/40 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/30 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                      />
                      <button 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`absolute right-2.5 text-gray-400 hover:text-brand-500 transition-colors ${showEmojiPicker ? 'text-brand-500' : ''}`}
                      >
                        <Smile size={15} />
                      </button>
                    </div>

                    <Button
                      onClick={handleSend}
                      disabled={!newMessage.trim()}
                      size="sm"
                      className="rounded-full w-8 h-8 !p-0 shrink-0"
                    >
                      <Send size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  </div>
  );
};

export default DesktopChatWidget;
