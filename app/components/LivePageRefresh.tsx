"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { livePageConfig } from "@/lib/live-pages";

function isEditing() {
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.matches("input,textarea,select,[contenteditable='true']")
  )
    return true;
  if (
    document.querySelector("[data-live-dirty='true'],[data-live-busy='true']")
  )
    return true;
  // Protect uncontrolled admin forms too, including unsaved filter text.
  for (const form of document.querySelectorAll("main form")) {
    for (const field of form.querySelectorAll("input,textarea,select")) {
      if (field instanceof HTMLInputElement) {
        if (
          field.type === "hidden" ||
          field.type === "submit" ||
          field.type === "button"
        )
          continue;
        if (
          field.type === "file"
            ? Boolean(field.files?.length)
            : ["checkbox", "radio"].includes(field.type)
              ? field.checked !== field.defaultChecked
              : field.value !== field.defaultValue
        )
          return true;
      } else if (
        field instanceof HTMLTextAreaElement &&
        field.value !== field.defaultValue
      )
        return true;
      else if (
        field instanceof HTMLSelectElement &&
        Array.from(field.options).some(
          (option) => option.selected !== option.defaultSelected,
        ) &&
        field.dataset.liveFilter !== "true"
      ) {
        const defaults = Array.from(field.options).filter(
          (option) => option.defaultSelected,
        );
        if (defaults.length || field.selectedIndex !== 0) return true;
      }
    }
  }
  return false;
}

export default function LivePageRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deferred, setDeferred] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setDeferred(false));
    const config = livePageConfig(pathname);
    if (!config) return;
    const client = createClient();
    let disposed = false;
    let queued = false;
    let checking = false;
    let versions = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRefresh = Date.now();
    const flush = () => {
      if (
        disposed ||
        !queued ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      )
        return;
      if (isEditing()) {
        setDeferred(true);
        return;
      }
      queued = false;
      setDeferred(false);
      lastRefresh = Date.now();
      startTransition(() => router.refresh());
    };
    const schedule = () => {
      queued = true;
      clearTimeout(timer);
      timer = setTimeout(flush, 700);
    };
    const check = async () => {
      if (
        disposed ||
        checking ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      )
        return;
      if (!config.scopes.length) {
        schedule();
        return;
      }
      checking = true;
      try {
        const { data, error } = await client
          .from("store_live_updates")
          .select("scope,version")
          .in("scope", config.scopes)
          .order("scope");
        if (disposed) return;
        const next = JSON.stringify(data);
        // Time-based combos also expire without a database mutation.
        if (
          error ||
          !data?.length ||
          (versions && next !== versions) ||
          Date.now() - lastRefresh >= 60000
        )
          schedule();
        if (!error && data?.length) versions = next;
      } catch {
        if (!disposed) schedule();
      } finally {
        checking = false;
      }
    };
    let channel = client.channel(`live-page-${pathname}`);
    if (config.scopes.length)
      channel = channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "store_live_updates" },
        (event) => {
          if (
            config.scopes.includes(
              String((event.new as { scope?: string }).scope),
            )
          )
            schedule();
        },
      );
    for (const table of config.tables)
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        schedule,
      );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") void check();
    });
    void check();
    const interval = setInterval(() => {
      if (queued) flush();
      void check();
    }, config.pollMs);
    const sync = () => {
      if (document.visibilityState === "visible") {
        schedule();
        void check();
      }
    };
    const afterInteraction = () => {
      if (queued) {
        clearTimeout(timer);
        timer = setTimeout(flush, 1000);
      }
    };
    const mutations = new MutationObserver(afterInteraction);
    mutations.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-live-dirty", "data-live-busy"],
    });
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("focusout", afterInteraction);
    document.addEventListener("reset", afterInteraction);
    document.addEventListener("submit", afterInteraction);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(interval);
      mutations.disconnect();
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("focusout", afterInteraction);
      document.removeEventListener("reset", afterInteraction);
      document.removeEventListener("submit", afterInteraction);
      void client.removeChannel(channel);
    };
  }, [pathname, router, startTransition]);
  const enabled = livePageConfig(pathname);
  return enabled && deferred ? (
    <p
      role="status"
      className="pointer-events-none fixed bottom-24 left-1/2 z-40 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-violet-500/20 bg-[#17131f]/95 px-4 py-2 text-center text-xs text-violet-200 shadow-lg"
    >
      Há novidades. A página atualiza quando você terminar a edição.
    </p>
  ) : null;
}
