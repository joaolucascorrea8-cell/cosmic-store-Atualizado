"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "expired" || error === "invalid") {
      setMessage("Esse link de recuperação é inválido ou expirou. Solicite um novo abaixo.");
    }
  }, []);

  async function sendRecovery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setMessage("Não foi possível enviar o link agora. Aguarde um momento e tente novamente.");
      } else {
        setSent(true);
        setMessage("Se existir uma conta com esse e-mail, enviaremos um link para criar uma nova senha. Confira também Spam e Promoções.");
      }
    } catch {
      setMessage("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080812] px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-purple-500/20 bg-[#111122] p-8 shadow-2xl">
        <h1 className="mb-3 text-2xl font-black text-purple-400">Esqueceu sua senha?</h1>
        <p className="mb-6 leading-6 text-gray-400">Informe seu e-mail para receber um link seguro de recuperação.</p>

        <form onSubmit={sendRecovery}>
          <input type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={loading} className="mb-4 w-full rounded-xl border border-gray-700 bg-[#080812] p-3 outline-none transition focus:border-purple-500" />
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-purple-600 p-3 font-semibold transition hover:bg-purple-500 disabled:opacity-50">
            {loading ? "Enviando..." : sent ? "Enviar novamente" : "Enviar link de recuperação"}
          </button>
        </form>

        {message && <p className={`mt-4 rounded-xl border p-3 text-sm ${sent ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-200" : "border-amber-400/15 bg-amber-400/10 text-amber-100"}`}>{message}</p>}

        <Link href="/login" className="mt-6 block text-center text-sm font-bold text-purple-400 hover:underline">Voltar para o login</Link>
      </div>
    </main>
  );
}
