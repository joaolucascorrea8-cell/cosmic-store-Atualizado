"use client";
import { useFormStatus } from "react-dom";
export default function PendingButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>{pending ? "Salvando…" : children}</button>;
}
