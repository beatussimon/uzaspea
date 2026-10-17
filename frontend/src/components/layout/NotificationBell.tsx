import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api';
import { timeAgo } from '../../utils/timeAgo';

interface NotificationBellProps {
  className?: string;
  activeClassName?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className, activeClassName }) => {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const isAuthenticated = !!localStorage.getItem('access_token');
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkNotifications = async (silent = false) => {
      try {
        const res = await api.get('/api/notifications/');
        const list = res.data.results || res.data || [];
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => b.id - a.id);
          const newest = sorted[0];
          const storedLastId = localStorage.getItem('last_notified_notification_id');
          
          if (storedLastId) {
            const lastId = parseInt(storedLastId, 10);
            const newUnreads = sorted.filter(n => n.id > lastId && !n.is_read && n.notification_type !== 'new_message');
            
            newUnreads.reverse().forEach(n => {
              if (Notification.permission === 'granted') {
                try {
                  new Notification(n.title, { body: n.message });
                } catch (e) {
                  console.error('Failed to trigger native notification:', e);
                }
              }
            });
          }
          localStorage.setItem('last_notified_notification_id', String(newest.id));
        }

        const countRes = await api.get('/api/notifications/unread_count/');
        setCount(countRes.data.count);
      } catch (err: any) {
        if (err.response?.status === 401) {
          // Silent ignore for 401
        } else if (!silent) {
          console.error('Error fetching notifications:', err);
        }
      }
    };

    checkNotifications();
    const interval = setInterval(() => checkNotifications(true), 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Fix the click bug using useRef and contains()
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const r = await api.get('/api/notifications/');
      const list = r.data.results || r.data || [];
      setNotifications(list);
      if (list.length > 0) {
        const sorted = [...list].sort((a, b) => b.id - a.id);
        localStorage.setItem('last_notified_notification_id', String(sorted[0].id));
      }
    } catch (e) {}
  };

  const openPanel = () => {
    setOpen((prev) => {
      if (!prev) {
        fetchNotifications();
      }
      return !prev;
    });
  };

  const markAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post('/api/notifications/mark_all_read/');
      setCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {}
  };

  const clearAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete('/api/notifications/clear_all/');
      setCount(0);
      setNotifications([]);
    } catch (e) {}
  };

  if (!isAuthenticated) return null;

  // Group notifications
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, any[]> = {
    'Today': [],
    'Yesterday': [],
    'Earlier': []
  };

  notifications.forEach(n => {
    const date = new Date(n.created_at);
    if (date >= today) {
      groups['Today'].push(n);
    } else if (date >= yesterday) {
      groups['Yesterday'].push(n);
    } else {
      groups['Earlier'].push(n);
    }
  });

  const resolveDestination = (n: any): string => {
    let target = (n.link || '').trim();

    // Check for order ID in title, message, or link
    const orderMatch = (n.title + ' ' + n.message).match(/(?:order\s*#?|#)\s*(\d+)/i);
    const orderId = orderMatch ? orderMatch[1] : null;

    if (target) {
      if (orderId) {
        if (target === '/dashboard/orders' || target === '/dashboard/orders/') {
          return `/dashboard/orders?highlight=${orderId}`;
        }
        if (target === '/orders' || target === '/orders/') {
          return `/orders?highlight=${orderId}`;
        }
      }
      return target;
    }

    if (orderId) {
      const isSellerContext = /new order|customer|placed a new order|accepted invoice|counter-offer|incoming/i.test(
        n.title + ' ' + n.message
      );
      return isSellerContext 
        ? `/dashboard/orders?highlight=${orderId}` 
        : `/orders?highlight=${orderId}`;
    }

    switch (n.notification_type) {
      case 'new_message':
        return '/messages';
      case 'new_review':
      case 'review_approved':
        return '/dashboard/products';
      case 'subscription_approved':
      case 'subscription_rejected':
        return '/upgrade';
      case 'site_visit_approved':
        return '/upgrade';
      case 'site_visit_rejected':
        return '/help';
      default:
        return '';
    }
  };

  const handleNotificationClick = async (n: any) => {
    setOpen(false);

    // Mark as read immediately in local state
    if (!n.is_read) {
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
      setCount(prev => Math.max(0, prev - 1));
      try {
        await api.patch(`/api/notifications/${n.id}/`, { is_read: true });
      } catch {
        try {
          await api.post(`/api/notifications/${n.id}/mark_read/`);
        } catch {}
      }
    }

    const dest = resolveDestination(n);
    if (!dest) return;

    if (dest.startsWith('http://') || dest.startsWith('https://')) {
      window.location.href = dest;
    } else {
      navigate(dest);
    }
  };

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        onClick={openPanel} 
        className={open && activeClassName ? activeClassName : (className || `relative btn-ghost p-2 rounded-full transition-colors ${
          open 
            ? ' text-brand-500  dark:text-brand-500' 
            : 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-600 dark:text-gray-300'
        }`)}
      >
        <Bell size={20} className={open ? 'fill-current' : ''} />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-brand-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-black">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 top-12 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] z-50"
          >
            <div ref={panelRef} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <h3 className="font-bold text-base text-gray-900 dark:text-white">Notifications</h3>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={markAllRead} 
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors tooltip tooltip-bottom" 
                    data-tip="Mark all read"
                    aria-label="Mark all read"
                  >
                    <Check size={16} />
                  </button>
                  <button 
                    onClick={clearAll} 
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors tooltip tooltip-bottom" 
                    data-tip="Clear all"
                    aria-label="Clear all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 p-2 pt-0">
                {notifications.length === 0 ? (
                  <div className="p-8 flex flex-col items-center justify-center text-center">
                    <Bell size={32} className="text-gray-300 dark:text-neutral-700 mb-3" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">All caught up!</p>
                    <p className="text-xs text-gray-500 mt-1">You have no new notifications.</p>
                  </div>
                ) : (
                  ['Today', 'Yesterday', 'Earlier'].map((groupName) => {
                    const group = groups[groupName];
                    if (group.length === 0) return null;

                    return (
                      <div key={groupName} className="mb-3 last:mb-0">
                        <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                          {groupName}
                        </div>
                        <div className="space-y-1">
                          {group.map(n => (
                            <div 
                              key={n.id} 
                              className="group relative p-2.5 rounded-xl cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                              onClick={() => handleNotificationClick(n)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm leading-snug ${
                                    !n.is_read 
                                      ? 'font-bold text-gray-900 dark:text-white' 
                                      : 'font-medium text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {n.title}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
                                    {n.message}
                                  </p>
                                  <p className="text-[10px] font-medium text-gray-400 dark:text-neutral-500 mt-1.5">
                                    {timeAgo(n.created_at)}
                                  </p>
                                </div>
                                {!n.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
