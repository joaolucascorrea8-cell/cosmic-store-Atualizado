"use client";
import { useEffect, useState } from "react";
import type { ProductContext } from "@/lib/product-context";
export function useProductContexts(ids: string[]) {
  const key = [...new Set(ids)].sort().join(",");
  const [state, setState] = useState<{ key: string; contexts: Record<string, ProductContext>; error: boolean }>({ key: "", contexts: {}, error: false });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void fetch(`/api/catalog-context?ids=${encodeURIComponent(key)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setState({ key, contexts: data.contexts, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ key, contexts: {}, error: true }); });
    return () => controller.abort();
  }, [key]);
  return { contexts: state.key === key ? state.contexts : {}, loading: Boolean(key && state.key !== key), error: state.key === key && state.error };
}
