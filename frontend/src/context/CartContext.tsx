import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

interface CartItem {
  productId: number;
  name: string;
  price: number;
  stock: number;
  quantity: number;
  image: string;
  slug: string;
}

interface CartContextType {
  items: CartItem[];
  cartCount: number;
  totalPrice: number;
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// FIX: C-12 — sessionStorage is cleared on tab close; use localStorage for cart persistence
function loadCart(): CartItem[] {
  try {
    const data = localStorage.getItem('uzaspea_cart');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem('uzaspea_cart', JSON.stringify(items));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = useCallback((product: any, quantity = 1) => {
    setItems((prev) => {
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
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (item) toast.success(`${item.name} removed from cart`);
      return prev.filter((i) => i.productId !== productId);
    });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
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
    localStorage.removeItem('uzaspea_cart');  // FIX: C-12
  }, []);

  return (
    <CartContext.Provider
      value={{ items, cartCount, totalPrice, addToCart, removeFromCart, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
