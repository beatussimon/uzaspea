import React, { useState, useRef, useEffect } from 'react';
import { Search, X, MessageSquare, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useMessages } from '../../context/MessageContext';
import VerifiedBadge from '../VerifiedBadge';

export const MessengerListWidget: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = Number(user?.user_id || (user as any)?.id || parseInt(localStorage.getItem('user_id') || '0'));

  const {
    conversations,
    openChatWindow,
    toggleMessengerList,
    isMessengerListOpen,
    setIsMessengerListOpen,
  } = useMessages();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'main' | 'sokoni'>('main');
  const widgetRef = useRef<HTMLDivElement>(null);

  // Close messenger list when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (isMessengerListOpen && widgetRef.current) {
        if (!widgetRef.current.contains(e.target as Node)) {
          const isNavbarMsgBtn = (e.target as HTMLElement).closest('[aria-label="View messages"]');
          if (!isNavbarMsgBtn) {
            setIsMessengerListOpen(false);
          }
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMessengerListOpen, setIsMessengerListOpen]);

  if (!isMessengerListOpen) return null;

  const sokoniConversations = conversations.filter(c => !!c.product || !!c.product_name);
  const regularConversations = conversations.filter(c => !c.product && !c.product_name);

  const displayedConversations = (viewMode === 'sokoni' ? sokoniConversations : regularConversations).filter(c => {
    const isBuyer = Number(c.buyer) === userId;
    const otherUser = isBuyer ? c.seller_username : c.buyer_username;
    const product = c.product_name || '';
    return otherUser.toLowerCase().includes(searchQuery.toLowerCase()) || 
           product.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const sokoniUnreadCount = sokoniConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

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

  return (
    <div 
      ref={widgetRef}
      className="fixed bottom-0 right-6 z-[200] w-[360px] h-[500px] bg-white dark:bg-black border border-gray-200/90 dark:border-neutral-800 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-surface-muted/90 dark:bg-neutral-900/90 border-b border-gray-200/60 dark:border-neutral-800/60 flex items-center justify-between shrink-0 select-none">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 font-heading">
          <MessageSquare size={16} className="text-brand-500" />
          Messages
        </h3>

        <button 
          onClick={toggleMessengerList}
          className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200/60 dark:border-neutral-800/60 bg-gray-50/50 dark:bg-neutral-900/50 p-1 gap-1 shrink-0">
        <button
          onClick={() => setViewMode('main')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
            viewMode === 'main'
              ? 'bg-white dark:bg-black text-brand-500 dark:text-brand-500 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Direct Messages
        </button>
        <button
          onClick={() => setViewMode('sokoni')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            viewMode === 'sokoni'
              ? 'bg-white dark:bg-black text-brand-500 dark:text-brand-500 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <ShoppingBag size={13} />
          Sokoni Leo
          {sokoniUnreadCount > 0 && (
            <span className="bg-brand-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">
              {sokoniUnreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2.5 border-b border-gray-200/60 dark:border-neutral-800/60 bg-surface-muted/30 dark:bg-neutral-950/30 shrink-0">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('search_messages', 'Search messages or contacts...')}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200/60 dark:border-neutral-800/50 rounded-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/30 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-neutral-900">
        {displayedConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400 dark:text-neutral-500 text-xs">
            No conversations found
          </div>
        ) : (
          displayedConversations.map(c => {
            const isBuyer = Number(c.buyer) === userId;
            const otherUser = isBuyer ? c.seller_username : c.buyer_username;
            const isVerified = isBuyer ? c.seller_verified : c.buyer_verified;
            const tier = isBuyer ? c.seller_tier : c.buyer_tier;
            const hasUnread = (c.unread_count || 0) > 0;
            const timeStr = c.last_message?.created_at || c.updated_at;
            const lastMsgText = typeof c.last_message === 'string' 
              ? c.last_message 
              : (c.last_message?.content || 'Start conversation...');

            return (
              <div
                key={c.id}
                onClick={() => {
                  openChatWindow(c.id);
                  toggleMessengerList();
                }}
                className={`p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-neutral-900/60 cursor-pointer transition-colors ${
                  hasUnread ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs  ${getGradient(otherUser)} shadow-sm`}>
                    {otherUser.substring(0, 2).toUpperCase()}
                  </div>
                  {c.is_online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-black" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-xs truncate ${hasUnread ? 'font-black text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'}`}>
                        {otherUser}
                      </span>
                      <VerifiedBadge isVerified={isVerified} tier={tier} className="w-3.5 h-3.5" />
                    </div>
                    {timeStr && (
                      <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                        {new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {c.product_name && (
                    <p className="text-[10px] text-brand-500 dark:text-brand-500 font-bold truncate">
                      Item: {c.product_name}
                    </p>
                  )}

                  <p className={`text-xs truncate mt-0.5 ${hasUnread ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {lastMsgText}
                  </p>
                </div>

                {hasUnread && (
                  <span className="w-4 h-4 bg-brand-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shrink-0">
                    {c.unread_count}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
