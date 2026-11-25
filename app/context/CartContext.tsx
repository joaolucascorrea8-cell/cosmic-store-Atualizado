"use client";
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  cartSignature,
  reconcileCart,
  type CartCatalog,
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
  cartOwner: string | null;
  consumeCart: (signature: string) => void;
  refreshProducts: (catalog: CartCatalog) => void;
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
  const [cartOwner, setOwner] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const ownerRef = useRef<string | null>(null);
  const cartLoaded = cartOwner !== null;
  useEffect(() => {
    const key = (owner: string) => `cosmic-cart-v2:${owner}`;
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      const owner = session?.user.id ?? "guest";
      if (ownerRef.current === owner) return;
      let restored: CartItem[] = [];
      try {
        restored = decode(localStorage.getItem(key(owner)));
        if (session) {
          const guest = decode(localStorage.getItem(key("guest")));
          if (guest.length) {
            restored = mergeRepurchase(restored, guest).items;
            localStorage.setItem(key(owner), JSON.stringify(restored));
            localStorage.removeItem(key("guest"));
          }
        }
      } catch {}
      ownerRef.current = owner;
      setOwner(owner);
      setItems(restored);
    });
    const sync = (event: StorageEvent) => {
      if (ownerRef.current && event.key === key(ownerRef.current)) setItems(decode(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    if (cartOwner && ownerRef.current === cartOwner) {
      try { localStorage.setItem(`cosmic-cart-v2:${cartOwner}`, JSON.stringify(items)); } catch {}
    }
  }, [cartOwner, items]);
  const refreshProducts = useCallback((catalog: CartCatalog) => {
    if (ownerRef.current === cartOwner) setItems(current => reconcileCart(current, catalog));
  }, [cartOwner]);
  function consumeCart(signature: string) {
    if (ownerRef.current === cartOwner)
      setItems(current => cartSignature(current) === signature ? [] : current);
  }
  function addToCart(input: CartProduct) {
    if (input.kind !== undefined && input.kind !== "product") return;
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
        cartOwner,
        consumeCart,
        refreshProducts,
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
