 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
  const supabase = createClient();
  let active = true;

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (!active) return;

    if (event === "PASSWORD_RECOVERY") {
      setAuthorized(true);
      setMessage("");
      setChecking(false);
    }
  });

  void supabase.auth.getSession().then(({ data }) => {
    if (!active) return;
    const hasSession = Boolean(data.session);
    setAuthorized(hasSession);
    setChecking(false);
    if (!hasSession) {
      setMessage("Abra esta página pelo link de recuperação enviado ao seu e-mail.");
    }
  });

  return () => {
    active = false;
    subscription.unsubscribe();
  };
}, []);

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas não são iguais.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage("Não foi possível alterar a senha: " + error.message);
    } else {
      setSuccess(true);
      setMessage("Senha alterada com sucesso!");
      await supabase.auth.signOut();
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080812] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-purple-500/20 bg-[#111122] p-8">
        <h1 className="mb-3 text-2xl font-bold text-purple-400">
          Recuperar senha
        </h1>

        {checking ? (
          <p className="text-gray-400">
            Verificando o link de recuperação...
          </p>
        ) : success ? (
          <div>
            <p className="mb-5 text-green-400">{message}</p>

            <Link
              href="/login"
              className="block rounded-lg bg-purple-600 p-3 text-center font-semibold"
            >
              Ir para o login
            </Link>
          </div>
        ) : authorized ? (
          <form onSubmit={changePassword}>
            <p className="mb-5 text-gray-400">
              Digite sua nova senha.
            </p>

            <input
              type="password"
              placeholder="Nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
              className="mb-3 w-full rounded-lg border border-gray-700 bg-[#080812] p-3"
            />

            <input
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={loading}
              className="mb-4 w-full rounded-lg border border-gray-700 bg-[#080812] p-3"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-600 p-3 font-semibold disabled:opacity-50"
            >
              {loading ? "Alterando..." : "Alterar senha"}
            </button>

            {message && (
              <p className="mt-4 text-sm text-red-400">{message}</p>
            )}
          </form>
        ) : (
          <p className="text-red-400">{message}</p>
        )}
      </div>
    </main>
  );
}
