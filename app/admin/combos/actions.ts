"use server";

import { requireAdmin } from "@/lib/require-admin";

export type ComboState = { error: string | null };

// Keep old action imports harmless when updating an existing checkout.
export async function saveCombo(): Promise<ComboState> {
  await requireAdmin();
  return { error: "A função de combos foi descontinuada." };
}

export async function promoteCombo() {
  await requireAdmin();
  throw new Error("A função de combos foi descontinuada.");
}

export async function toggleCombo() {
  await requireAdmin();
  throw new Error("A função de combos foi descontinuada.");
}
