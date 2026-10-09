"use client";
import { useState } from "react";
import Link from "next/link";
import CopyButton from "@/app/components/CopyButton";
type Delivery = { username: string; password: string; instructions: string };
export default function AccountDelivery({ orderId }: { orderId: string }) {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function open() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/robux/accounts/delivery/${orderId}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Não foi possível abrir os dados.");
      setDelivery(data.delivery);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.04] p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
        Entrega da sua conta
      </p>
      <h2 className="mt-2 text-xl font-black">Seus dados de acesso</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Prepare a gravação antes de abrir os dados, entre na conta assim que
        possível e confira o saldo. Se houver senha inválida, saldo ausente ou
        Robux já gastos, relate o problema preferencialmente nos primeiros 10
        minutos após a liberação da entrega. Guarde o vídeo com segurança.
      </p>
      {!delivery ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void open()}
          className="btn-primary mt-4"
        >
          {busy ? "Abrindo…" : "Ver dados da conta"}
        </button>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-zinc-500">Usuário Roblox</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <strong className="break-all font-mono">
                {delivery.username}
              </strong>
              <CopyButton value={delivery.username} label="Copiar usuário" />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-zinc-500">Senha</p>
            <p className="mt-2 break-all font-mono">
              {showPassword ? delivery.password : "••••••••••••"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="admin-small-button"
              >
                {showPassword ? "Ocultar senha" : "Mostrar senha"}
              </button>
              <CopyButton value={delivery.password} label="Copiar senha" />
            </div>
          </div>
          {delivery.instructions && (
            <div>
              <h3 className="text-sm font-bold">Instruções da entrega</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">
                {delivery.instructions}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setDelivery(null);
              setShowPassword(false);
            }}
            className="text-xs text-zinc-400 underline"
          >
            Ocultar dados da conta
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-amber-200">
          {error}
        </p>
      )}
      <div className="mt-5 border-t border-white/10 pt-4">
        <Link
          href={`/suporte?pedido=${orderId}`}
          className="text-sm font-bold text-violet-300"
        >
          Relatar problema ou solicitar reembolso →
        </Link>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          O atendimento permanece disponível após 10 minutos. A orientação de
          vídeo não retira seus direitos legais.
        </p>
      </div>
    </section>
  );
}
