"use client";
import { useActionState, useState } from "react";
import { saveAccountDelivery, type AccountFormState } from "./actions";
import type { AccountCredentials } from "@/lib/robux-accounts/credentials-crypto";
export default function AccountDeliveryForm({
  orderId,
  initial,
  delivered,
}: {
  orderId: string;
  initial: (AccountCredentials & { updated_at: string }) | null;
  delivered: boolean;
}) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    saveAccountDelivery,
    { error: null },
  );
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={action} autoComplete="off" className="mt-4 space-y-4">
      <input type="hidden" name="order_id" value={orderId} />
      <input
        type="hidden"
        name="updated_at"
        value={initial?.updated_at ?? ""}
      />
      <label className="block text-sm text-zinc-300">
        Usuário da conta Roblox
        <input
          name="username"
          required
          maxLength={100}
          autoComplete="off"
          defaultValue={initial?.username ?? ""}
          className="admin-input mt-2"
          placeholder="Nome de usuário para login"
        />
      </label>
      <div>
        <label
          className="block text-sm text-zinc-300"
          htmlFor="account-delivery-password"
        >
          Senha da conta
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="account-delivery-password"
            name="password"
            required
            maxLength={500}
            autoComplete="new-password"
            type={showPassword ? "text" : "password"}
            defaultValue={initial?.password ?? ""}
            className="admin-input min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="admin-small-button shrink-0"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
      <label className="block text-sm text-zinc-300">
        Instruções para o cliente{" "}
        <span className="text-xs text-zinc-500">(opcional)</span>
        <textarea
          name="instructions"
          maxLength={3000}
          rows={3}
          defaultValue={initial?.instructions ?? ""}
          className="admin-input mt-2"
          placeholder="Orientações de primeiro acesso e segurança."
        />
      </label>
      <p className="text-xs leading-5 text-zinc-500">
        {delivered
          ? "O cliente já pode consultar esta entrega. As alterações serão exibidas ao salvar."
          : "Salve os dados e depois marque o pedido como entregue para liberar o acesso ao cliente."}{" "}
        A senha fica protegida no banco e não é enviada por e-mail.
      </p>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-300">
          {state.success}
        </p>
      )}
      <button disabled={pending} className="btn-primary w-full">
        {pending
          ? "Salvando…"
          : initial
            ? "Atualizar dados da conta"
            : "Salvar dados da conta"}
      </button>
    </form>
  );
}
