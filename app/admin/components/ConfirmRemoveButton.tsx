"use client";
import { useFormStatus } from "react-dom";
export default function ConfirmRemoveButton({ name, disabled = false }: { name: string; disabled?: boolean }) {
  const {pending} = useFormStatus();
  return <button type="submit" disabled={disabled||pending} onClick={event=>{if(!window.confirm(`Excluir ${name}? Esta ação não pode ser desfeita.`))event.preventDefault();}} className="rounded-lg border border-red-500/25 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30">{pending?"Excluindo…":"Excluir"}</button>;
}
