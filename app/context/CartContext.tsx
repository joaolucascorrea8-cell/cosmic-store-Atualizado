"use client";
import {
  useEffect,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  cartKey,
  mergeRepurchase,
  maxQuantity,
  sanitizeCart,
  type CartItem as StoredItem,
} from "@/lib/cart";
export type CartProduct = {
  id: string;
  kind?: "product" | "combo";
  name: string;
  slug?: string;
  price: number;
  image_url: string | null;
  max_quantity?: number;
  stock?: number;
  unlimited_stock?: boolean;
};
export type CartItem = StoredItem & { max_quantity?: number };
type CartContextType = {
  items: CartItem[];
  cartLoaded: boolean;
  addToCart: (product: CartProduct) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  addItemsToCart: (incoming: CartItem[]) => number;
  totalItems: number;
};
const CartContext = createContext<CartContextType | null>(null);
function decode(value: string | null) {
  try {
    return sanitizeCart(JSON.parse(value ?? "[]"));
  } catch {
    return [];
  }
}
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]),
    [cartLoaded, setCartLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setItems(decode(localStorage.getItem("cosmic-cart")));
      } catch {}
      setCartLoaded(true);
    });
    const sync = (e: StorageEvent) => {
      if (e.key === "cosmic-cart") setItems(decode(e.newValue));
    };
    window.addEventListener("storage", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    if (cartLoaded) {
      try {
        localStorage.setItem("cosmic-cart", JSON.stringify(items));
      } catch {}
    }
  }, [cartLoaded, items]);
  function addToCart(input: CartProduct) {
    const product = {
      ...input,
      kind: input.kind ?? "product",
      stock: input.stock ?? input.max_quantity ?? 99,
      unlimited_stock:
        input.unlimited_stock ?? input.max_quantity === undefined,
    } as StoredItem;
    const maximum = maxQuantity(product);
    if (!cartLoaded || !maximum) return;
    setItems((current) => {
      const key = cartKey(product),
        existing = current.find((item) => cartKey(item) === key);
      if (existing)
        return current.map((item) =>
          cartKey(item) === key
            ? { ...product, quantity: Math.min(maximum, item.quantity + 1) }
            : item,
        );
      return current.length >= 40
        ? current
        : [...current, { ...product, quantity: 1 }];
    });
  }
  function removeFromCart(key: string) {
    setItems((current) => current.filter((item) => cartKey(item) !== key));
  }
  function updateQuantity(key: string, quantity: number) {
    if (!Number.isFinite(quantity)) return;
    if (quantity <= 0) {
      removeFromCart(key);
      return;
    }
    setItems((current) =>
      current
        .map((item) =>
          cartKey(item) === key
            ? {
                ...item,
                quantity: Math.min(Math.floor(quantity), maxQuantity(item)),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }
  return (
    <CartContext.Provider
      value={{
        items,
        cartLoaded,
        addToCart,
        addItemsToCart: (incoming) => {
          if (!cartLoaded) return 0;
          const result = mergeRepurchase(items, incoming);
          setItems(result.items);
          return result.added;
        },
        removeFromCart,
        updateQuantity,
        clearCart: () => setItems([]),
        totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart precisa estar dentro de CartProvider");
  return value;
}
