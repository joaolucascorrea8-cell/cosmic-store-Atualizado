"use client";
import { useActionState, useEffect, useState } from "react";
import { createSupportTicket, type SupportState } from "./actions";
import { useRouter } from "next/navigation";
export default function SupportForm({ orderCode, deliveredAt }: { orderCode?: string; deliveredAt?: string }) {
  const key = orderCode ? `cosmic-support-account-${orderCode}` : "cosmic-support-draft-v1";
  const router = useRouter();
  const [state, action, pending] = useActionState<SupportState, FormData>(
    createSupportTicket,
    { error: null },
  );
  const [id, setId] = useState(""),
    [subject, setSubject] = useState(""),
    [category, setCategory] = useState("order"),
    [message, setMessage] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
        if (saved && typeof saved === "object") {
          setId(typeof saved.id === "string" ? saved.id : crypto.randomUUID());
          setSubject(typeof saved.subject === "string" ? saved.subject : "");
          setCategory(
            ["order", "payment", "account", "product", "other"].includes(
              saved.category,
            )
              ? saved.category
              : "order",
          );
          setMessage(typeof saved.message === "string" ? saved.message : "");
        } else {
          setId(crypto.randomUUID());
          if (orderCode) {
            setSubject(`Conta com Robux · ${orderCode}`);
            setCategory("order");
            setMessage(`Pedido: ${orderCode}${deliveredAt ? `\nEntrega liberada em: ${deliveredAt}` : ""}\n\nDescreva o problema ou seu pedido de reembolso:\n`);
          }
        }
      } catch {
        setId(crypto.randomUUID());
      }
      setLoaded(true);
    });
  }, [key, orderCode, deliveredAt]);
  useEffect(() => {
    if (loaded)
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({ id, subject, category, message }),
        );
      } catch {}
  }, [id, subject, category, message, loaded, key]);
  useEffect(() => {
    if (state.destination) {
      try {
        sessionStorage.removeItem(key);
      } catch {}
      router.push(state.destination);
      router.refresh();
    }
  }, [state.destination, router, key]);
  return (
    <form action={action} className="mt-5 space-y-4">
      {orderCode && <p className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-3 text-xs leading-6 text-zinc-400">Atendimento do pedido {orderCode}. Informe se o problema é senha inválida, saldo ausente ou Robux já gastos. Preserve o vídeo do primeiro acesso e informe se possui a gravação; a equipe orientará como enviá-la com segurança. Não inclua senhas nesta mensagem.</p>}
      <input type="hidden" name="request_id" value={id} />
      <div>
        <label htmlFor="support-subject" className="admin-label">
          Assunto
        </label>
        <input
          id="support-subject"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={3}
          maxLength={120}
          className="admin-input"
          placeholder="Ex.: Dúvida sobre meu pedido"
        />
      </div>
      <div>
        <label htmlFor="support-category" className="admin-label">
          Categoria
        </label>
        <select
          id="support-category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="admin-input"
        >
          <option value="order">Pedido</option>
          <option value="payment">Pagamento</option>
          <option value="account">Conta</option>
          <option value="product">Produto</option>
          <option value="other">Outro assunto</option>
        </select>
      </div>
      <div>
        <label htmlFor="support-message" className="admin-label">
          Como podemos ajudar?
        </label>
        <textarea
          id="support-message"
          name="message"
          required
          minLength={5}
          maxLength={1500}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="admin-input"
          placeholder="Conte o que aconteceu e informe o código do pedido, se houver."
        />
        <p className="mt-1 text-right text-xs text-zinc-500">
          {message.length}/1500
        </p>
      </div>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending || !id || Boolean(state.destination)}
          className="btn-primary flex-1"
        >
          {pending ? "Abrindo atendimento…" : "Abrir atendimento"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="btn-secondary"
          onClick={() => {
            setId(crypto.randomUUID());
            setSubject("");
            setCategory("order");
            setMessage("");
          }}
        >
          Novo assunto
        </button>
      </div>
    </form>
  );
}
