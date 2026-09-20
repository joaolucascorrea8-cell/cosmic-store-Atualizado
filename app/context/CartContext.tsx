"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";

export type CartProduct = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
};

export type CartItem = CartProduct & { quantity: number };

type CartContextType = {
  items: CartItem[];
  addToCart: (product: CartProduct) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Servidor e navegador começam com o mesmo estado para evitar erro de hidratação.
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const saved = localStorage.getItem("cosmic-cart");

      if (saved) {
        try {
          const parsed = JSON.parse(saved) as (CartItem | CartProduct)[];
          setItems(
            parsed.map((item) => ({
              ...item,
              quantity: "quantity" in item ? item.quantity : 1,
            }))
          );
        } catch {
          localStorage.removeItem("cosmic-cart");
        }
      }

      setCartLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;

    localStorage.setItem(
      "cosmic-cart",
      JSON.stringify(items)
    );
  }, [cartLoaded, items]);


  function addToCart(product: CartProduct) {
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
  }

  function updateQuantity(id: string, quantity: number) {
    if (quantity <= 0) return removeFromCart(id);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }

  function clearCart() {
    setItems([]);
  }


  function removeFromCart(id: string) {
    setItems((current) =>
      current.filter(
        (item) => item.id !== id
      )
    );
  }


  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems: items.reduce((total, item) => total + item.quantity, 0),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}


export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart precisa estar dentro de CartProvider"
    );
  }

  return context;
}
