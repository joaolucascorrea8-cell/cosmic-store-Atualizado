"use server";

import { requireAdmin } from "@/lib/require-admin";

type CampaignState = { error: string | null; success: string | null };

export async function sendCampaign(): Promise<CampaignState> {
  await requireAdmin();
  return { error: "A divulgação de combos foi descontinuada.", success: null };
}
