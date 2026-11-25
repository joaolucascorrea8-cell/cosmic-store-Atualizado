"use client";
import { useEffect, useState } from "react";
import type { CartCatalog } from "@/lib/cart";
import type { ProductContext } from "@/lib/product-context";
export function useProductContexts(ids: string[], revision = 0) {
  const key = [...new Set(ids)].sort().join(",");
  const [state, setState] = useState<{ key: string; catalog?: CartCatalog; contexts: Record<string, ProductContext>; error: boolean }>({ key: "", contexts: {}, error: false });
  const requestKey = key + ":" + revision;
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void fetch(`/api/catalog-context?ids=${encodeURIComponent(key)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setState({ key: requestKey, catalog: data.catalog, contexts: data.contexts, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ key: requestKey, contexts: {}, error: true }); });
    return () => controller.abort();
  }, [key, requestKey]);
  return { catalog: state.key === requestKey ? state.catalog : undefined, contexts: state.key === requestKey ? state.contexts : {}, loading: Boolean(key && state.key !== requestKey), error: state.key === requestKey && state.error };
}
