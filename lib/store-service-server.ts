import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import {
  defaultSchedule,
  validSchedule,
  type ServiceSettings,
} from "./store-service";
export const getStoreService = cache(
  async (): Promise<ServiceSettings | null> => {
    const client = await createClient();
    const { data, error } = await client
      .from("store_service_settings")
      .select("delivery_hours,schedule_enabled,schedule,notice,updated_at")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return null;
    return {
      ...data,
      schedule: validSchedule(data.schedule) ? data.schedule : defaultSchedule,
    };
  },
);

export const getRequestTime = cache(async () => Date.now());
