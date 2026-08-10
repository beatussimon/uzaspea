import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api, { API_BASE_URL, decodeJwtPayload } from '../api';
import { useAuth } from './AuthContext';
import axios from 'axios';

const getValidToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  try {
    const payload = decodeJwtPayload(token);
    if (payload && payload.exp) {
      // If token expires in less than 30 seconds, refresh it
      const isExpired = payload.exp * 1000 - Date.now() < 30000;
      if (isExpired) {
        const refresh = localStorage.getItem('refresh_token');
        if (refresh) {
          try {
            const res = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, { refresh });
            const newToken = res.data.access;
            localStorage.setItem('access_token', newToken);
            if (res.data.refresh) {
              localStorage.setItem('refresh_token', res.data.refresh);
            }
            return newToken;
          } catch (err) {
            console.error('WebSocket token refresh failed:', err);
            return null; // Stop WS from trying to connect with an expired token
          }
        }
      }
    }
  } catch (err) {
    console.error('Error checking token for WebSocket:', err);
  }
  return token;
};


export interface Message {
  id: number;
  conversation: number;
  sender: number;
  sender_username: string;
  content: string;
  is_delivered?: boolean;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  buyer: number;
  buyer_username: string;
  seller: number;
  seller_username: string;
  seller_verified?: boolean;
  seller_tier?: string;
  buyer_verified?: boolean;
  buyer_tier?: string;
  product?: number;
  product_name?: string;
  product_image?: string;
  last_message?: Message | null;
  unread_count: number;
  is_online?: boolean;
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatToastData {
  id: string;
  conversationId: number;
  senderUsername: string;
  content: string;
  avatarText: string;
}

interface MessageContextType {
  conversations: Conversation[];
  totalUnread: number;
  activeConversationId: number | null;
  setActiveConversationId: (id: number | null) => void;
  messages: { [convId: number]: Message[] };
  fetchMessages: (convId: number) => Promise<Message[]>;
  sendMessage: (convId: number, content: string) => Promise<void>;
  toasts: ChatToastData[];
  dismissToast: (id: string) => void;
  loading: boolean;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setMessages: React.Dispatch<React.SetStateAction<{ [convId: number]: Message[] }>>;
  typingStatus: { [convId: number]: boolean };
  sendTypingStatus: (convId: number, isTyping: boolean) => void;
  
  // Desktop Multi-Window Dock State & Helpers
  isMessengerListOpen: boolean;
  setIsMessengerListOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openChatWindows: number[];
  minimizedChatWindows: number[];
  prefillMessages: { [convId: number]: string };
  openChatWindow: (convId: number, prefillMessage?: string) => void;
  minimizeChatWindow: (convId: number) => void;
  closeChatWindow: (convId: number) => void;
  toggleMessengerList: () => void;

  // Legacy fallback compatibility
  isDesktopPopupOpen: boolean;
  setIsDesktopPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  desktopActiveConvId: number | null;
  setDesktopActiveConvId: React.Dispatch<React.SetStateAction<number | null>>;
  isDesktopMinimized: boolean;
  setIsDesktopMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  desktopPrefillMessage: string;
  setDesktopPrefillMessage: React.Dispatch<React.SetStateAction<string>>;
  openConvIds: number[];
  minimizedConvIds: number[];
  openDesktopChat: (convId?: number | null, prefill?: string) => void;
  closeDesktopChat: () => void;
  toggleDesktopChat: () => void;
  toggleDesktopMinimize: () => void;
  closeThreadBubble: (convId: number) => void;
  openThreadBubble: (convId: number) => void;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const MessageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<{ [convId: number]: Message[] }>({});
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ChatToastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingStatus, setTypingStatus] = useState<{ [convId: number]: boolean }>({});

  // Desktop Multi-Window Chat Dock State
  const [isMessengerListOpen, setIsMessengerListOpen] = useState(false);
  const [openChatWindows, setOpenChatWindows] = useState<number[]>([]);
  const [minimizedChatWindows, setMinimizedChatWindows] = useState<number[]>([]);
  const [prefillMessages, setPrefillMessages] = useState<{ [convId: number]: string }>({});

  const openChatWindow = useCallback((convId: number, prefillMessage?: string) => {
    setOpenChatWindows(prev => {
      if (prev.includes(convId)) return prev;
      // Max 3 active windows on screen; oldest gets minimized if exceeds 3
      if (prev.length >= 3) {
        const oldest = prev[0];
        setMinimizedChatWindows(min => min.includes(oldest) ? min : [...min, oldest]);
      }
      return [...prev, convId];
    });
    setMinimizedChatWindows(prev => prev.filter(id => id !== convId));
    if (prefillMessage) {
      setPrefillMessages(prev => ({ ...prev, [convId]: prefillMessage }));
    }
  }, []);

  const minimizeChatWindow = useCallback((convId: number) => {
    setMinimizedChatWindows(prev => prev.includes(convId) ? prev : [...prev, convId]);
  }, []);

  const closeChatWindow = useCallback((convId: number) => {
    setOpenChatWindows(prev => prev.filter(id => id !== convId));
    setMinimizedChatWindows(prev => prev.filter(id => id !== convId));
    setPrefillMessages(prev => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });
  }, []);

  const toggleMessengerList = useCallback(() => {
    setIsMessengerListOpen(prev => !prev);
  }, []);

  // Legacy fallback compatibility
  const [isDesktopPopupOpen, setIsDesktopPopupOpen] = useState(false);
  const [desktopActiveConvId, setDesktopActiveConvId] = useState<number | null>(null);
  const [isDesktopMinimized, setIsDesktopMinimized] = useState(false);
  const [desktopPrefillMessage, setDesktopPrefillMessage] = useState('');
  const openConvIds: number[] = [];
  const minimizedConvIds: number[] = [];

  const openDesktopChat = useCallback((convId?: number | null, prefill?: string) => {
    if (convId !== undefined && convId !== null) {
      openChatWindow(convId, prefill);
    } else {
      setIsMessengerListOpen(true);
    }
  }, [openChatWindow]);

  const openThreadBubble = useCallback((convId: number) => {
    setOpenChatWindows(prev => prev.includes(convId) ? prev : [...prev, convId]);
    setMinimizedChatWindows(prev => prev.includes(convId) ? prev : [...prev, convId]);
  }, []);

  const closeThreadBubble = useCallback((convId: number) => {
    closeChatWindow(convId);
  }, [closeChatWindow]);

  const closeDesktopChat = useCallback(() => {
    setIsMessengerListOpen(false);
  }, []);

  const toggleDesktopChat = useCallback(() => {
    setIsMessengerListOpen(prev => !prev);
  }, []);

  const toggleDesktopMinimize = useCallback(() => {
    setIsDesktopMinimized(prev => !prev);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const activeConvIdRef = useRef<number | null>(null);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync ref with state so ws handler always knows the active conversation ID
  useEffect(() => {
    activeConvIdRef.current = activeConversationId;
    if (activeConversationId) {
      // Mark read locally and in db
      setConversations(prev =>
        prev.map(c => (c.id === activeConversationId ? { ...c, unread_count: 0 } : c))
      );
      api.get(`/api/conversations/${activeConversationId}/messages/`).then(r => {
        setMessages(prev => ({
          ...prev,
          [activeConversationId]: r.data.results || r.data,
        }));
      }).catch(() => {});
    }
  }, [activeConversationId]);

  // Load conversations initially
  const loadConversations = useCallback(async (silent = false) => {
    if (!isAuthenticated) return;
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/api/conversations/');
      const list = res.data.results || res.data || [];
      setConversations(list);
    } catch (e: any) {
      if (!silent && e?.response?.status !== 401) {
        console.error('Failed to load conversations:', e);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAuthenticated]);

// Helper for Web Push
const urlB64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

let pushSubscribeInFlight = false;
const subscribeToWebPush = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (pushSubscribeInFlight) return;
  pushSubscribeInFlight = true;
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    
    // Always fetch VAPID key to ensure we have the correct backend config
    const vapidRes = await api.get('/api/push/vapid-key/');
    const publicKey = vapidRes.data.public_key;
    if (!publicKey) return;

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey)
      });
    }
    
    // Post subscription to backend
    if (subscription) {
      const subJSON = subscription.toJSON();
      await api.post('/api/push/subscribe/', {
        endpoint: subJSON.endpoint,
        keys: subJSON.keys
      });
    }
  } catch (error: any) {
    // 500 can occur in dev (React Strict Mode double-invoke race) — not an actual error
    if (error?.response?.status !== 500) {
      console.error('Failed to subscribe to web push:', error);
    }
  } finally {
    pushSubscribeInFlight = false;
  }
};

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          subscribeToWebPush();
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              subscribeToWebPush();
            }
          }).catch(() => {});
        }
      }
    } else {
      setConversations([]);
      setMessages({});
      setActiveConversationId(null);
      setToasts([]);
      setLoading(false);
    }
  }, [isAuthenticated, loadConversations]);

  // Dismiss a toast
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Refs for instantaneous access in WebSocket callbacks
  const openChatWindowsRef = useRef<number[]>([]);
  const minimizedChatWindowsRef = useRef<number[]>([]);

  useEffect(() => {
    openChatWindowsRef.current = openChatWindows;
  }, [openChatWindows]);

  useEffect(() => {
    minimizedChatWindowsRef.current = minimizedChatWindows;
  }, [minimizedChatWindows]);

  // Connect WebSocket
  const connectWS = useCallback(async () => {
    if (!isAuthenticated) return;
    const token = await getValidToken();
    if (!token) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Do not tear down if already OPEN or CONNECTING
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        return;
      }
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const wsUrl = `${protocol}://${host}/ws/chat/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Websocket connected
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const currentUserId = Number(userRef.current?.user_id || (userRef.current as any)?.id || localStorage.getItem('user_id') || '0');

        if (data.type === 'typing') {
          const convId = Number(data.conversation_id);
          const isTyping = data.is_typing === true || data.is_typing === 'true';
          const senderId = Number(data.sender_id);
          if (senderId !== currentUserId) {
            setTypingStatus(prev => ({
              ...prev,
              [convId]: isTyping,
            }));
          }
          return;
        }

        if (data.type === 'chat_delivery_update') {
          const msgIds = data.message_ids || [];
          setMessages(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
              const convId = Number(key);
              next[convId] = next[convId].map(m => msgIds.includes(m.id) ? { ...m, is_delivered: true } : m);
            });
            return next;
          });
          return;
        }

        if (data.type === 'chat_read_update') {
          const msgIds = data.message_ids || [];
          const convId = Number(data.conversation_id);
          setMessages(prev => {
            if (!prev[convId]) return prev;
            return {
              ...prev,
              [convId]: prev[convId].map(m => msgIds.includes(m.id) ? { ...m, is_read: true, is_delivered: true } : m)
            };
          });
          return;
        }

        if (data.type === 'presence_update') {
          const userId = Number(data.user_id);
          const isOnline = data.is_online;
          const lastSeen = data.last_seen;
          
          setConversations(prev => prev.map(c => {
            if (c.buyer === userId || c.seller === userId) {
              return { ...c, is_online: isOnline, last_seen: lastSeen };
            }
            return c;
          }));
          return;
        }

        if (data.type === 'chat_message') {
          const convId = Number(data.conversation_id);
          const msg: Message = data.message;

          // Clear typing status for this conversation when message arrives
          setTypingStatus(prev => ({ ...prev, [convId]: false }));

          // 1. ALWAYS update messages state so real-time messages display instantly
          setMessages(prev => {
            const currentMsgs = prev[convId] || [];
            // Remove optimistic message if present, or avoid duplicates
            const cleaned = currentMsgs.filter(m => m.id !== msg.id && !(m.id < 0 && m.content === msg.content));
            return {
              ...prev,
              [convId]: [...cleaned, msg],
            };
          });

          const isThreadFocused = activeConvIdRef.current === convId || 
            (openChatWindowsRef.current.includes(convId) && !minimizedChatWindowsRef.current.includes(convId));

          // Send read receipt if we are actively viewing this conversation
          if (msg.sender !== currentUserId && isThreadFocused) {
            try {
              ws.send(JSON.stringify({
                type: 'read_receipt',
                conversation_id: convId,
                message_ids: [msg.id]
              }));
            } catch (e) {
              console.warn('Failed to send WS read receipt', e);
            }
            api.get(`/api/conversations/${convId}/messages/`).catch(() => {});
          }

          // Trigger toast & spawn bubble if received from someone else and NOT focused
          if (msg.sender !== currentUserId && !isThreadFocused) {
            setOpenChatWindows(prev => prev.includes(convId) ? prev : [...prev, convId]);
            setMinimizedChatWindows(prev => prev.includes(convId) ? prev : [...prev, convId]);

            const toastId = `${Date.now()}-${Math.random()}`;
            const initials = (msg.sender_username || 'Chat').substring(0, 2).toUpperCase();
            setToasts(prev => [
              ...prev.filter(t => t.conversationId !== convId),
              {
                id: toastId,
                conversationId: convId,
                senderUsername: msg.sender_username,
                content: msg.content,
                avatarText: initials,
              },
            ]);

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                const notification = new Notification(`New message from ${msg.sender_username}`, {
                  body: msg.content,
                  icon: '/logo_dark.png',
                  tag: `chat-msg-${convId}`,
                });
                notification.onclick = () => {
                  window.focus();
                };
              } catch (e) {
                console.warn('Native notification failed:', e);
              }
            }
          }

          // Always send delivery receipt if received and not the sender
          if (msg.sender !== currentUserId) {
            try {
              ws.send(JSON.stringify({
                type: 'delivery_receipt',
                conversation_id: convId,
                message_ids: [msg.id]
              }));
            } catch (e) {
              console.warn('Failed to send WS delivery receipt', e);
            }
          }

          // 2. Update conversations list
          setConversations(prev => {
            const existingIdx = prev.findIndex(c => c.id === convId);
            const isUnread = msg.sender !== currentUserId && !isThreadFocused;

            if (existingIdx > -1) {
              const updated = [...prev];
              const conv = updated[existingIdx];
              updated[existingIdx] = {
                ...conv,
                last_message: msg,
                unread_count: isUnread ? (conv.unread_count || 0) + 1 : (isThreadFocused ? 0 : conv.unread_count),
                updated_at: new Date().toISOString(),
              };
              return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            } else {
              loadConversations();
              return prev;
            }
          });
        }
      } catch (err) {
        console.error('Error handling websocket message:', err);
      }
    };

    ws.onclose = (e) => {
      // Avoid reconnect loop if logged out or normal closure
      if (isAuthenticated && e.code !== 1000) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectWS();
        }, 5000);
      }
    };

    ws.onerror = () => {
      // Let onclose handle reconnect
    };
  }, [isAuthenticated, loadConversations]);

  useEffect(() => {
    let pingInterval: number;
    let pollInterval: number;
    if (isAuthenticated) {
      connectWS();
      pingInterval = window.setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'presence_ping' }));
          } catch (e) {}
        }
      }, 30000); // Send ping every 30 seconds

      // Quietly poll conversations to keep online statuses perfectly accurate
      pollInterval = window.setInterval(() => {
        loadConversations(true);
      }, 30000);
    }
    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (pollInterval) clearInterval(pollInterval);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        try {
          wsRef.current.close(1000);
        } catch (e) {}
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, connectWS]);

  // Fetch messages thread
  const fetchMessages = useCallback(async (convId: number) => {
    try {
      const res = await api.get(`/api/conversations/${convId}/messages/`);
      const data = res.data.results || res.data || [];
      setMessages(prev => ({
        ...prev,
        [convId]: data,
      }));
      return data;
    } catch (e) {
      console.error(`Failed to fetch messages for conv ${convId}`, e);
      return [];
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (convId: number, content: string) => {
    // 1. Optimistic message object
    const currentUserId = user?.user_id || 0;
    const currentUsername = user?.username || '';
    const tempId = -Date.now();
    const tempMsg: Message = {
      id: tempId,
      conversation: convId,
      sender: currentUserId,
      sender_username: currentUsername,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    // Update messages cache optimistically
    setMessages(prev => {
      const list = prev[convId] || [];
      return {
        ...prev,
        [convId]: [...list, tempMsg],
      };
    });

    // Update conversation list item last_message optimistically
    setConversations(prev => {
      return prev.map(c => {
        if (c.id === convId) {
          return {
            ...c,
            last_message: tempMsg,
            updated_at: new Date().toISOString(),
          };
        }
        return c;
      }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    });

    // Try WS send first
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          conversation_id: convId,
          content,
        }));
        return;
      } catch (err) {
        console.warn('WS send failed, falling back to REST', err);
      }
    }

    // REST fallback
    try {
      const res = await api.post(`/api/conversations/${convId}/messages/`, { content });
      const realMsg: Message = res.data;
      setMessages(prev => {
        const list = (prev[convId] || []).filter(m => m.id !== tempId);
        return {
          ...prev,
          [convId]: [...list, realMsg],
        };
      });
    } catch (e) {
      // Remove optimistic message on failure
      setMessages(prev => ({
        ...prev,
        [convId]: (prev[convId] || []).filter(m => m.id !== tempId),
      }));
      throw e;
    }
  }, [user]);

  // Clean optimistic messages if websocket echoes them back
  useEffect(() => {
    Object.keys(messages).forEach(key => {
      const convId = Number(key);
      const list = messages[convId];
      if (list && list.some(m => m.id < 0)) {
        const realMsgs = list.filter(m => m.id > 0);
        const cleaned = list.filter(m => {
          if (m.id < 0) {
            const isDuplicate = realMsgs.some(rm =>
              rm.sender === m.sender &&
              rm.content === m.content &&
              Math.abs(new Date(rm.created_at).getTime() - new Date(m.created_at).getTime()) < 10000
            );
            if (isDuplicate) {
              return false;
            }
          }
          return true;
        });
        if (cleaned.length !== list.length) {
          setMessages(prev => ({
            ...prev,
            [convId]: cleaned,
          }));
        }
      }
    });
  }, [messages]);

  // Calculate total unread count across all conversations
  const totalUnread = conversations.reduce((acc, c) => acc + c.unread_count, 0);

  // Send typing status via WebSocket
  const sendTypingStatus = useCallback((convId: number, isTyping: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          conversation_id: convId,
          is_typing: isTyping,
        }));
      } catch (err) {
        console.warn('Failed to send typing status via WS', err);
      }
    }
  }, []);


  const contextValue = useMemo(() => ({
    conversations,
    totalUnread,
    activeConversationId,
    setActiveConversationId,
    messages,
    fetchMessages,
    sendMessage,
    toasts,
    dismissToast,
    loading,
    setConversations,
    setMessages,
    typingStatus,
    sendTypingStatus,

    // Desktop Multi-Window Dock State & Helpers
    isMessengerListOpen,
    setIsMessengerListOpen,
    openChatWindows,
    minimizedChatWindows,
    prefillMessages,
    openChatWindow,
    minimizeChatWindow,
    closeChatWindow,
    toggleMessengerList,

    // Legacy fallback compatibility
    isDesktopPopupOpen,
    setIsDesktopPopupOpen,
    desktopActiveConvId,
    setDesktopActiveConvId,
    isDesktopMinimized,
    setIsDesktopMinimized,
    desktopPrefillMessage,
    setDesktopPrefillMessage,
    openConvIds,
    minimizedConvIds,
    openDesktopChat,
    closeDesktopChat,
    toggleDesktopChat,
    toggleDesktopMinimize,
    openThreadBubble,
    closeThreadBubble,
  }), [
    conversations, totalUnread, activeConversationId, setActiveConversationId,
    messages, fetchMessages, sendMessage, toasts, dismissToast, loading,
    setConversations, setMessages, typingStatus, sendTypingStatus,
    isMessengerListOpen, setIsMessengerListOpen, openChatWindows, minimizedChatWindows, prefillMessages,
    openChatWindow, minimizeChatWindow, closeChatWindow, toggleMessengerList,
    isDesktopPopupOpen, setIsDesktopPopupOpen, desktopActiveConvId, setDesktopActiveConvId,
    isDesktopMinimized, setIsDesktopMinimized, desktopPrefillMessage, setDesktopPrefillMessage,
    openConvIds, minimizedConvIds, openDesktopChat, closeDesktopChat, toggleDesktopChat, toggleDesktopMinimize,
    openThreadBubble, closeThreadBubble,
  ]);

  return (
    <MessageContext.Provider value={contextValue}>
      {children}

    </MessageContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
};
