"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { allRows } from "@/lib/query-pages";
type Preference = { product_id: string; favorite: boolean; restock: boolean };
type State = {
  userId: string | null;
  loaded: boolean;
  values: Record<string, Preference>;
  change: (
    id: string,
    kind: "favorite" | "restock",
    enabled: boolean,
  ) => Promise<string | null>;
};
const Context = createContext<State | null>(null);
export function ProductPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [client] = useState(createClient);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [values, setValues] = useState<Record<string, Preference>>({});
  const generation = useRef(0);
  const identity = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    void client.auth.getUser().then(({ data }) => {
      if (active) {
        identity.current = data.user?.id ?? null;
        setUserId(data.user?.id ?? null);
        if (!data.user) setLoaded(true);
      }
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        identity.current = session?.user.id ?? null;
        setUserId(session?.user.id ?? null);
        if (!session) {
          generation.current++;
          setValues({});
          setLoaded(true);
        }
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function sync() {
      const request = ++generation.current;
      const result = await allRows(
        client
          .from("customer_product_preferences")
          .select("product_id,favorite,restock")
          .eq("user_id", userId!)
          .order("product_id"),
      );
      if (!active || request !== generation.current) return;
      if (!result.error)
        setValues(
          Object.fromEntries((result.data ?? []).map((p) => [p.product_id, p])),
        );
      setLoaded(true);
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!document.hidden) void sync();
      }, 250);
    }
    queueMicrotask(() => {
      if (active) {
        setValues({});
        setLoaded(false);
        void sync();
      }
    });
    const channel = client
      .channel(`preferences:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_product_preferences",
          filter: `user_id=eq.${userId}`,
        },
        schedule,
      )
      .subscribe();
    window.addEventListener("focus", schedule);
    window.addEventListener("online", schedule);
    return () => {
      active = false;
      clearTimeout(timer);
      void client.removeChannel(channel);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("online", schedule);
    };
  }, [client, userId]);
  async function change(
    id: string,
    kind: "favorite" | "restock",
    enabled: boolean,
  ) {
    generation.current++;
    const currentUser = identity.current;
    const { data, error } = await client.rpc("set_product_preference", {
      p_product_id: id,
      p_kind: kind,
      p_enabled: enabled,
    });
    if (error)
      return error.code === "P0001"
        ? error.message
        : "Não foi possível salvar. Tente novamente.";
    generation.current++;
    if (currentUser === identity.current)
      setValues((current) => ({
        ...current,
        [id]: {
          product_id: id,
          favorite: data.favorite,
          restock: data.restock,
        },
      }));
    return null;
  }
  return (
    <Context.Provider value={{ userId, loaded, values, change }}>
      {children}
    </Context.Provider>
  );
}
export function useProductPreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("ProductPreferencesProvider ausente");
  return value;
}
