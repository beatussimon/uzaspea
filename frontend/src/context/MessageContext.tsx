import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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
          const res = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, { refresh });
          const newToken = res.data.access;
          localStorage.setItem('access_token', newToken);
          return newToken;
        }
      }
    }
  } catch (err) {
    console.error('Error checking/refreshing token for WebSocket:', err);
  }
  return token;
};


export interface Message {
  id: number;
  conversation: number;
  sender: number;
  sender_username: string;
  content: string;
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


  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const activeConvIdRef = useRef<number | null>(null);

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
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await api.get('/api/conversations/');
      const list = res.data.results || res.data || [];
      setConversations(list);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
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

  // Connect WebSocket
  const connectWS = useCallback(async () => {
    if (!isAuthenticated) return;
    const token = await getValidToken();
    if (!token) return;


    // Clean up existing
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    // Connect to ws/chat/
    const wsUrl = `${protocol}://${host}/ws/chat/?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Websocket connected
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'typing') {
          const convId = Number(data.conversation_id);
          const isTyping = data.is_typing === true || data.is_typing === 'true';
          const senderId = Number(data.sender_id);
          if (senderId !== user?.user_id) {
            setTypingStatus(prev => ({
              ...prev,
              [convId]: isTyping,
            }));
          }
          return;
        }

        if (data.type === 'chat_message') {

          const convId = Number(data.conversation_id);
          const msg: Message = data.message;
          const currentUserId = user?.user_id;

          // 1. Update messages cache if it exists or if it's the active conversation
          if (activeConvIdRef.current === convId) {
            setMessages(prev => {
              const currentMsgs = prev[convId] || [];
              if (currentMsgs.some(m => m.id === msg.id)) return prev;
              return {
                ...prev,
                [convId]: [...currentMsgs, msg],
              };
            });
            // Mark read since we are looking at it
            if (msg.sender !== currentUserId) {
              api.get(`/api/conversations/${convId}/messages/`).catch(() => {});

              // Also trigger native device notification if tab is in the background
              if (document.hidden && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
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
          } else {
            // Active conversation is NOT this one
            // Update messages cache anyway if it's already fetched
            setMessages(prev => {
              if (!prev[convId]) return prev;
              const currentMsgs = prev[convId];
              if (currentMsgs.some(m => m.id === msg.id)) return prev;
              return {
                ...prev,
                [convId]: [...currentMsgs, msg],
              };
            });

            // Trigger Facebook style notification toast if it's from someone else
            if (msg.sender !== currentUserId) {
              const toastId = `${Date.now()}-${Math.random()}`;
              const initials = msg.sender_username.substring(0, 2).toUpperCase();
              setToasts(prev => [
                ...prev.slice(-2), // Keep max 3 toasts stacked
                {
                  id: toastId,
                  conversationId: convId,
                  senderUsername: msg.sender_username,
                  content: msg.content,
                  avatarText: initials,
                },
              ]);

              // Also trigger native device notification if permitted
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  const notification = new Notification(`New message from ${msg.sender_username}`, {
                    body: msg.content,
                    icon: '/logo_dark.png',
                    tag: `chat-msg-${convId}`,
                  });
                  notification.onclick = () => {
                    window.focus();
                    window.location.href = `/messages/${convId}`;
                  };
                } catch (e) {
                  console.warn('Native notification failed:', e);
                }
              }
            }
          }

          // 2. Update conversations list
          setConversations(prev => {
            // Find if conversation exists in our list
            const existingIdx = prev.findIndex(c => c.id === convId);
            const isUnread = msg.sender !== currentUserId && activeConvIdRef.current !== convId;

            if (existingIdx > -1) {
              const updated = [...prev];
              const conv = updated[existingIdx];
              updated[existingIdx] = {
                ...conv,
                last_message: msg,
                unread_count: isUnread ? conv.unread_count + 1 : conv.unread_count,
                updated_at: new Date().toISOString(),
              };
              // Sort to top
              return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            } else {
              // Refresh full list because we might have a new conversation started by someone else
              loadConversations();
              return prev;
            }
          });
        }
      } catch (err) {
        console.error('Error handling websocket message:', err);
      }
    };

    ws.onclose = () => {
      // Avoid reconnect loop if logged out
      if (isAuthenticated) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectWS();
        }, 4000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [isAuthenticated, user, loadConversations]);

  useEffect(() => {
    if (isAuthenticated) {
      connectWS();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
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


  return (
    <MessageContext.Provider value={{
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
    }}>
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
