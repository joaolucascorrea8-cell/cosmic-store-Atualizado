export type ServiceDay = {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
};
export type ServiceSettings = {
  delivery_hours: number;
  schedule_enabled: boolean;
  schedule: ServiceDay[];
  notice: string;
  updated_at?: string;
};
export const dayNames = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
export const defaultSchedule: ServiceDay[] = dayNames.map((_, day) => ({
  day,
  enabled: day > 0 && day < 6,
  start: "09:00",
  end: "18:00",
}));
export function readDeliveryHours(value: unknown): number | null | "invalid" {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return /^\d{1,3}$/.test(text) && Number(text) >= 1 && Number(text) <= 720
    ? Number(text)
    : "invalid";
}
export function validSchedule(value: unknown): value is ServiceDay[] {
  if (!Array.isArray(value) || value.length !== 7) return false;
  const seen = new Set<number>();
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !Number.isInteger(entry.day) ||
      entry.day < 0 ||
      entry.day > 6 ||
      seen.has(entry.day) ||
      typeof entry.enabled !== "boolean"
    )
      return false;
    if (
      ![entry.start, entry.end].every(
        (v) => typeof v === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v),
      ) ||
      entry.start >= entry.end
    )
      return false;
    seen.add(entry.day);
  }
  return true;
}
export function serviceStatus(schedule: ServiceDay[], now: Date) {
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: string) =>
    local.find((p) => p.type === name)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    part("weekday"),
  );
  const time = `${part("hour")}:${part("minute")}`;
  const today = schedule.find((s) => s.day === day);
  if (today?.enabled && today.start <= time && time < today.end)
    return { open: true, text: `Equipe em atendimento até ${today.end}` };
  for (let offset = 0; offset < 8; offset++) {
    const next = schedule.find((s) => s.day === (day + offset) % 7);
    if (next?.enabled && (offset > 0 || next.start > time))
      return {
        open: false,
        text: `Atendimento ${offset === 0 ? "hoje" : offset === 1 ? "amanhã" : dayNames[next.day].toLowerCase()} às ${next.start}`,
      };
  }
  return { open: false, text: "Atendimento temporariamente pausado" };
}
export function deliveryText(hours: number) {
  return `Prazo estimado: até ${hours} ${hours === 1 ? "hora" : "horas"} após a confirmação do pagamento.`;
}
