"use client";
import { useEffect, useState } from "react";
import {
  dayNames,
  serviceStatus,
  type ServiceSettings,
} from "@/lib/store-service";
export default function ServiceHours({
  settings,
  initialTime,
}: {
  settings: ServiceSettings;
  initialTime: number;
}) {
  const [now, setNow] = useState(initialTime);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const status = serviceStatus(settings.schedule, new Date(now));
  if (!settings.schedule_enabled && !settings.notice) return null;
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[.025] p-4 text-xs leading-6 text-zinc-400">
      {settings.schedule_enabled && (
        <details>
          <summary className="cursor-pointer font-bold">
            <span
              className={status.open ? "text-emerald-300" : "text-amber-200"}
            >
              {status.text}
            </span>
            <span className="ml-2 text-zinc-500">Ver horários ⌄</span>
          </summary>
          <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {settings.schedule.map((d) => (
              <li key={d.day} className="flex justify-between gap-3">
                <span>{dayNames[d.day]}</span>
                <span>
                  {d.enabled ? `${d.start}–${d.end}` : "Sem atendimento"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-zinc-500">
            Horário de Brasília. Você pode comprar e enviar mensagens a qualquer
            hora.
          </p>
        </details>
      )}
      {settings.notice && (
        <p className="whitespace-pre-line">{settings.notice}</p>
      )}
    </div>
  );
}
