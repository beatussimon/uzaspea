import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface CartItem {
  productId: string | number;
  name: string;
  price: number;
  stock: number;
  quantity: number;
  image: string;
  slug: string;
  seller_id?: number;
  seller_username?: string;
  category?: string;
  weight_kg?: number;
  size?: string;
  requires_quote?: boolean;
}

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  totalPrice: number;
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: string | number) => void;
  updateQuantity: (productId: string | number, quantity: number) => void;
  clearCart: () => void;
  clearCartByMerchant: (merchant: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const getStorageKey = useCallback(() => {
    const userId = user?.user_id || localStorage.getItem('user_id');
    return userId ? `sokonimax_cart_${userId}` : 'sokonimax_cart';
  }, [user]);

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const userId = localStorage.getItem('user_id');
      const key = userId ? `sokonimax_cart_${userId}` : 'sokonimax_cart';
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });

  // Re-hydrate cart if user changes
  useEffect(() => {
    const key = getStorageKey();
    try {
      const data = localStorage.getItem(key);
      setItems(data ? JSON.parse(data) : []);
    } catch {
      setItems([]);
    }
  }, [user, getStorageKey]);

  useEffect(() => {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(items));
  }, [items, getStorageKey]);

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = useCallback((product: any, quantity = 1) => {
    if (!isAuthenticated && !localStorage.getItem('access_token')) {
      const returnUrl = window.location.pathname + window.location.search;
      sessionStorage.setItem('loginRedirect', returnUrl);
      sessionStorage.setItem('pendingCartItem', JSON.stringify({ product, quantity }));
      toast.error("Please sign in to add items to your cart");
      navigate(`/login?next=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setItems((prev) => {
      const currentUsername = user?.username || localStorage.getItem('username');
      if (currentUsername && product.seller_username?.toLowerCase() === currentUsername.toLowerCase()) {
        toast.error("You cannot add your own product to the cart");
        return prev;
      }

      const existing = prev.find((i) => i.productId === product.id);
      const firstImage = product.images?.[0]?.image || '';

      if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty > product.stock) {
          toast.error(`Only ${product.stock} available in stock`);
          return prev;
        }
        toast.success(`Updated ${product.name} quantity`);
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: newQty } : i
        );
      }

      if (quantity > product.stock) {
        toast.error(`Only ${product.stock} available in stock`);
        return prev;
      }

      toast.success(`${product.name} added to cart`);
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: parseFloat(product.price),
          stock: product.stock,
          quantity,
          image: firstImage,
          slug: product.slug,
          seller_id: product.seller || product.seller_id,
          seller_username: product.seller_username,
          category: product.category_name,
          weight_kg: product.weight_kg ? parseFloat(product.weight_kg) : 1.0,
          size: product.size || 'small',
          requires_quote: product.requires_quote || false,
        },
      ];
    });
  }, [isAuthenticated, user, navigate]);

  const removeFromCart = useCallback((productId: string | number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (item) toast.success(`${item.name} removed from cart`);
      return prev.filter((i) => i.productId !== productId);
    });
  }, []);

  const updateQuantity = useCallback((productId: string | number, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.productId !== productId);
      }
      return prev.map((i) => {
        if (i.productId === productId) {
          if (quantity > i.stock) {
            toast.error(`Only ${i.stock} available`);
            return { ...i, quantity: i.stock };
          }
          return { ...i, quantity };
        }
        return i;
      });
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    const key = getStorageKey();
    localStorage.removeItem(key);
  }, [getStorageKey]);

  const clearCartByMerchant = useCallback((merchant: string) => {
    setItems((prev) => {
      const remaining = prev.filter((i) => (i.seller_username || 'Unknown Store') !== merchant);
      const key = getStorageKey();
      localStorage.setItem(key, JSON.stringify(remaining));
      return remaining;
    });
  }, [getStorageKey]);

  const contextValue = useMemo(() => ({
    items, cartCount, totalPrice, addToCart, removeFromCart, updateQuantity, clearCart, clearCartByMerchant
  }), [items, cartCount, totalPrice, addToCart, removeFromCart, updateQuantity, clearCart, clearCartByMerchant]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
