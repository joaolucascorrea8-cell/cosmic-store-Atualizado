"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function sendRecovery(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { error } =
  await supabase.auth.resetPasswordForEmail(email, {
   redirectTo: `${window.location.origin}/reset-password`,
  });

     if (error) {
  setMessage(
    `Erro do Supabase: ${error.message} (código: ${error.code ?? "não informado"})`
  );
} else {
  setMessage(
    "Se existir uma conta com esse e-mail, " +
    "você receberá um link de recuperação."
  );
}
    } catch {
      setMessage(
        "Erro de conexão. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080812] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-purple-500/20 bg-[#111122] p-8">
        <h1 className="mb-3 text-2xl font-bold text-purple-400">
          Esqueceu sua senha?
        </h1>

        <p className="mb-6 text-gray-400">
          Informe seu e-mail para receber um link
          de recuperação.
        </p>

        <form onSubmit={sendRecovery}>
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
            className="mb-4 w-full rounded-lg border border-gray-700 bg-[#080812] p-3"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-purple-600 p-3 font-semibold disabled:opacity-50"
          >
            {loading
              ? "Enviando..."
              : "Enviar link de recuperação"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-gray-300">
            {message}
          </p>
        )}

        <Link
          href="/login"
          className="mt-6 block text-center text-sm text-purple-400 hover:underline"
        >
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
