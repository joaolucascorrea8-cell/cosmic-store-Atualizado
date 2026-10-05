import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { RobuxPricingSettings } from "@/lib/robux-pricing";

export type RobuxSettings = RobuxPricingSettings & {
  enabled: boolean;
  tutorialUrl: string;
  pendingDaysMin: number;
  pendingDaysMax: number;
  updatedAt: string | null;
};

export const DEFAULT_ROBUX_SETTINGS: RobuxSettings = {
  enabled: true,
  minCosmicK: 34,
  marginPerThousand: 9,
  maxSupplierK: 30,
  minMarginPerThousand: 7,
  tutorialUrl: "",
  pendingDaysMin: 3,
  pendingDaysMax: 7,
  updatedAt: null,
};

export async function getRobuxSettings(): Promise<RobuxSettings> {
  try {
    const { data, error } = await createAdminClient()
      .from("robux_settings")
      .select(
        "enabled,min_cosmic_k,margin_per_thousand,max_supplier_k,min_margin_per_thousand,tutorial_url,pending_days_min,pending_days_max,updated_at",
      )
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return DEFAULT_ROBUX_SETTINGS;
    return {
      enabled: Boolean(data.enabled),
      minCosmicK: Number(data.min_cosmic_k),
      marginPerThousand: Number(data.margin_per_thousand),
      maxSupplierK: Number(data.max_supplier_k),
      minMarginPerThousand: Number(data.min_margin_per_thousand),
      tutorialUrl: String(data.tutorial_url ?? "").trim(),
      pendingDaysMin: Number(data.pending_days_min),
      pendingDaysMax: Number(data.pending_days_max),
      updatedAt: data.updated_at ?? null,
    };
  } catch {
    return DEFAULT_ROBUX_SETTINGS;
  }
}
