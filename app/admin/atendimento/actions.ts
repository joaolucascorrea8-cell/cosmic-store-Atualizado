"use server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { readDeliveryHours, validSchedule } from "@/lib/store-service";
import { revalidatePath } from "next/cache";
export type ServiceState = { error?: string; success?: string };
export async function saveServiceSettings(
  _state: ServiceState,
  form: FormData,
): Promise<ServiceState> {
  await requireAdmin();
  const hours = readDeliveryHours(form.get("delivery_hours"));
  const notice = String(form.get("notice") ?? "").trim();
  const schedule = Array.from({ length: 7 }, (_, day) => ({
    day,
    enabled: form.get(`day_${day}`) === "on",
    start: String(form.get(`start_${day}`) ?? ""),
    end: String(form.get(`end_${day}`) ?? ""),
  }));
  if (!hours || hours === "invalid")
    return { error: "Informe um prazo de 1 a 720 horas." };
  if (!validSchedule(schedule))
    return {
      error:
        "Confira os horários. O início deve ser anterior ao fim no mesmo dia.",
    };
  if (notice.length > 300)
    return { error: "O aviso pode ter até 300 caracteres." };
  const { data, error } = await createAdminClient()
    .from("store_service_settings")
    .update({
      delivery_hours: hours,
      schedule_enabled: form.get("schedule_enabled") === "on",
      schedule,
      notice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .eq("updated_at", String(form.get("updated_at") ?? ""))
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[atendimento]", error);
    return { error: "Não foi possível salvar as configurações." };
  }
  if (!data)
    return {
      error:
        "As configurações mudaram em outra tela. Atualize antes de salvar.",
    };
  revalidatePath("/", "layout");
  return {
    success:
      "Horários e prazo atualizados. Pedidos anteriores mantêm o prazo original.",
  };
}
