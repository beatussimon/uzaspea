import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, Smile, Minus, X, CheckCheck, Check, ShoppingBag 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useMessages, Message } from '../../context/MessageContext';
import VerifiedBadge from '../VerifiedBadge';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import api from '../../api';

interface FloatingChatWindowProps {
  convId: number;
  rightOffset: number;
}

export const FloatingChatWindow: React.FC<FloatingChatWindowProps> = ({ convId, rightOffset }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = Number(user?.user_id || (user as any)?.id || parseInt(localStorage.getItem('user_id') || '0'));

  const {
    conversations,
    setConversations,
    messages,
    fetchMessages,
    sendMessage,
    loading: contextLoading,
    typingStatus,
    sendTypingStatus,
    minimizeChatWindow,
    closeChatWindow,
    prefillMessages,
  } = useMessages();

  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [isLocallyTyping, setIsLocallyTyping] = useState(false);

  const [initialUnreadCount, setInitialUnreadCount] = useState<number | null>(null);
  const [unreadMessageIds, setUnreadMessageIds] = useState<Set<number>>(new Set());
  const [firstUnreadMsgId, setFirstUnreadMsgId] = useState<number | null>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const hasScrolledToInitialRef = useRef(false);

  useEffect(() => {
    if (convId) {
      fetchMessages(convId);
    }
  }, [convId, fetchMessages]);

  useEffect(() => {
    const conv = conversations.find(c => c.id === convId);
    if (conv && initialUnreadCount === null) {
      setInitialUnreadCount(conv.unread_count);
    }
    if (conv && conv.unread_count > 0) {
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
      api.post(`/api/conversations/${convId}/read/`).catch(() => {});
    }
  }, [convId, conversations, setConversations, initialUnreadCount]);

  useEffect(() => {
    if (prefillMessages[convId]) {
      setNewMessage(prefillMessages[convId]);
    }
  }, [convId, prefillMessages]);

  const activeConv = conversations.find(c => c.id === convId);
  const currentMessages = messages[convId] || [];
  const isOtherUserTyping = typingStatus[convId] || false;

  const otherUsername = activeConv 
    ? (Number(activeConv.buyer) === userId ? activeConv.seller_username : activeConv.buyer_username)
    : 'User';

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messageEndRef.current?.scrollIntoView({ behavior });
  };

  const prevMessagesLengthRef = useRef(currentMessages.length);
  useEffect(() => {
    if (currentMessages.length > 0 && !hasScrolledToInitialRef.current && initialUnreadCount !== null) {
      hasScrolledToInitialRef.current = true;
      let unreadIds = new Set<number>();
      let firstUnreadId: number | null = null;
      if (initialUnreadCount > 0) {
        let count = 0;
        for (let i = currentMessages.length - 1; i >= 0; i--) {
          const msg = currentMessages[i];
          if (Number(msg.sender) !== userId) {
            unreadIds.add(msg.id);
            firstUnreadId = msg.id;
            count++;
            if (count >= initialUnreadCount) break;
          }
        }
        setUnreadMessageIds(unreadIds);
        setFirstUnreadMsgId(firstUnreadId);
      }
      
      // Delay scrolling slightly to let DOM render
      setTimeout(() => {
        if (initialUnreadCount > 0 && firstUnreadRef.current) {
          firstUnreadRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
        } else {
          scrollToBottom('auto');
        }
      }, 100);
    } else if (hasScrolledToInitialRef.current && currentMessages.length > prevMessagesLengthRef.current) {
      const addedCount = currentMessages.length - prevMessagesLengthRef.current;
      const lastMsg = currentMessages[currentMessages.length - 1];
      const isMyMsg = lastMsg && Number(lastMsg.sender) === userId;

      if (isMyMsg) {
        scrollToBottom('smooth');
      } else if (isScrolledUp) {
        setNewMessagesCount(prev => prev + addedCount);
      } else {
        scrollToBottom('smooth');
      }
    }
    prevMessagesLengthRef.current = currentMessages.length;
  }, [currentMessages, isScrolledUp, userId, initialUnreadCount]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isUp = scrollHeight - scrollTop > clientHeight + 35;
    setIsScrolledUp(isUp);
    if (!isUp) setNewMessagesCount(0);
  };

  const handleInputChange = (val: string) => {
    setNewMessage(val);

    if (val.trim() === '') {
      if (isLocallyTyping) {
        setIsLocallyTyping(false);
        sendTypingStatus(convId, false);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }

    if (!isLocallyTyping) {
      setIsLocallyTyping(true);
      sendTypingStatus(convId, true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsLocallyTyping(false);
      sendTypingStatus(convId, false);
    }, 4000);
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const content = newMessage;
    setNewMessage('');
    setShowEmojiPicker(false);

    if (isLocallyTyping) {
      setIsLocallyTyping(false);
      sendTypingStatus(convId, false);
    }

    await sendMessage(convId, content);
    scrollToBottom('smooth');
  };

  const sendEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  const getGradient = (name: string) => {
    const gradients = [
      'from-amber-500 ',
      'bg-blue-500 ',
      'from-emerald-500 ',
      'bg-purple-500 ',
      'from-rose-500 ',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

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

  const quickEmojis = ['👍', '❤️', '😂', '😮', '🔥', '👏'];

  const isBuyer = Number(activeConv?.buyer) === userId;
  const isVerified = isBuyer ? activeConv?.seller_verified : activeConv?.buyer_verified;
  const tier = isBuyer ? activeConv?.seller_tier : activeConv?.buyer_tier;

  return (
    <div 
      className="fixed bottom-0 z-50 w-[330px] h-[450px] bg-white dark:bg-black border border-gray-200/90 dark:border-neutral-800 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl transition-all"
      style={{ right: `${rightOffset}px` }}
    >
      {/* --- Window Header --- */}
      <div className="px-3.5 py-2.5 bg-surface-muted/90 dark:bg-neutral-900/90 border-b border-gray-200/60 dark:border-neutral-800/60 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs  ${getGradient(otherUsername)} shadow-sm`}>
              {otherUsername.substring(0, 2).toUpperCase()}
            </div>
            {activeConv?.is_online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-black" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                {otherUsername}
              </span>
              <VerifiedBadge isVerified={isVerified} tier={tier} className="w-3.5 h-3.5" />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
              {isOtherUserTyping ? (
                <span className="text-brand-500 font-medium animate-pulse">typing...</span>
              ) : activeConv?.is_online ? (
                'Active now'
              ) : (
                'Offline'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => minimizeChatWindow(convId)}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => closeChatWindow(convId)}
            className="p-1 rounded-full text-gray-400 hover:text-red-500 dark:hover:text-red-500 hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* --- Optional Product Link Banner --- */}
      {activeConv?.product_name && (
        <div className="px-3 py-1.5 bg-amber-500/10 dark:bg-amber-500/20 border-b border-amber-500/20 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <ShoppingBag size={12} className="text-brand-500 shrink-0" />
            <span className="text-[11px] font-medium text-gray-800 dark:text-gray-200 truncate">
              Re: {activeConv.product_name}
            </span>
          </div>
          {activeConv.product && (
            <button
              onClick={() => navigate(`/product/${activeConv.product}`)}
              className="text-[10px] text-brand-500 dark:text-brand-500 font-bold hover:underline shrink-0 ml-2"
            >
              View
            </button>
          )}
        </div>
      )}

      {/* --- Messages History Area --- */}
      <div 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3 relative"
      >
        {contextLoading && currentMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : currentMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base  ${getGradient(otherUsername)} mb-2 shadow-md`}>
              {otherUsername.substring(0, 2).toUpperCase()}
            </div>
            <p className="text-xs font-bold text-gray-900 dark:text-white">Say Hello to {otherUsername}!</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Send a message to start the conversation.</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date} className="space-y-2">
              <div className="flex justify-center my-1">
                <span className="text-[10px] font-medium text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-900 px-2 py-0.5 rounded-full select-none">
                  {formatDayHeader(date)}
                </span>
              </div>

              {msgs.map((msg, index) => {
                const isMe = Number(msg.sender) === userId;
                const isUnread = unreadMessageIds.has(msg.id);
                const isFirstUnread = msg.id === firstUnreadMsgId;
                return (
                  <div
                    key={msg.id || index}
                    ref={isFirstUnread ? firstUnreadRef : null}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {isFirstUnread && (
                      <div className="w-full flex items-center justify-center my-3 relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-brand-500/30 dark:border-brand-500/20"></div></div>
                        <span className="relative bg-white dark:bg-black px-2 text-[10px] font-bold text-brand-500 dark:text-brand-500 uppercase tracking-wider select-none">New Messages</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                        isMe
                          ? ' bg-brand-500  text-white rounded-br-xs font-sans'
                          : isUnread
                            ? '  text-gray-900 dark:text-gray-100 border border-brand-500/50 dark:border-brand-500/30 rounded-bl-xs font-sans'
                            : 'bg-surface-muted dark:bg-neutral-900 text-gray-900 dark:text-gray-100 rounded-bl-xs border border-gray-200/50 dark:border-neutral-800/50 font-sans'
                      }`}
                    >
                      {msg.content}
                    </div>

                    <div className="flex items-center gap-1 mt-0.5 px-1 select-none">
                      <span className="text-[9px] text-gray-400 dark:text-gray-500">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && (
                        <span className="text-brand-500">
                          {msg.is_read ? <CheckCheck size={11} /> : <Check size={11} />}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        {/* --- Realtime Typing Indicator Animation --- */}
        {isOtherUserTyping && (
          <div className="flex items-center gap-1.5 p-2 bg-gray-100 dark:bg-neutral-900 rounded-2xl w-14 border border-gray-200/40 dark:border-neutral-800/40">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* --- New Messages Floating Pill --- */}
      {isScrolledUp && newMessagesCount > 0 && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20">
          <button 
            onClick={() => scrollToBottom('smooth')}
            className="px-3 py-1 bg-brand-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-bounce"
          >
            {newMessagesCount} new message{newMessagesCount > 1 ? 's' : ''} ↓
          </button>
        </div>
      )}

      {/* --- Input Console --- */}
      <div className="p-2 border-t border-gray-200/60 dark:border-neutral-800/60 bg-surface-muted/60 dark:bg-neutral-950/60 flex flex-col gap-1.5 shrink-0">
        {showEmojiPicker && (
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-neutral-900 rounded-full overflow-x-auto">
            {quickEmojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => sendEmoji(emoji)}
                className="text-xs p-1 hover:scale-125 transition-transform"
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
                  minimizeChatWindow(convId);
                }
              }}
              placeholder={t('type_a_message', 'Type a message...')}
              className="w-full pr-7 pl-3 py-1.5 text-xs border border-gray-200/60 dark:border-neutral-800/50 rounded-full bg-gray-100/50 dark:bg-neutral-900/40 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/30 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`absolute right-2 text-gray-400 hover:text-brand-500 transition-colors ${showEmojiPicker ? 'text-brand-500' : ''}`}
            >
              <Smile size={14} />
            </button>
          </div>

          <Button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            size="sm"
            className="rounded-full w-7 h-7 !p-0 shrink-0"
          >
            <Send size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
};
