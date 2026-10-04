"use client";
import { useFormStatus } from "react-dom";
export default function PendingButton({
  children,
  className = "",
  confirm,
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      data-live-busy={pending}
      aria-disabled={pending || disabled}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={`${className} disabled:cursor-wait disabled:opacity-60`}
    >
      {pending ? "Salvando…" : children}
    </button>
  );
}
