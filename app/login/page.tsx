"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";


export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setSuccess("");
  }

  async function loginDiscord() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"));
      const { error: discordError } = await createClient().auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          scopes: "identify email guilds.join",
        },
      });
      if (discordError) {
        setError(discordError.message);
        setLoading(false);
      }
    } catch {
      setError("Não foi possível conectar ao Discord.");
      setLoading(false);
    }
  }

  async function submitEmail() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      if (mode === "register") {
        const cleanNickname = nickname.trim();
        if (!/^[A-Za-z0-9_.-]{3,24}$/.test(cleanNickname)) {
          setError("Use de 3 a 24 caracteres no nickname: letras, números, ponto, hífen ou underline.");
          return;
        }
        if (password.length < 6) {
          setError("A senha precisa ter pelo menos 6 caracteres.");
          return;
        }
        const { data, error: registerError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nickname: cleanNickname },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/conta`,
          },
        });
        if (registerError) {
          setError(registerError.message.includes("already registered") ? "Este e-mail já possui uma conta. Tente entrar." : registerError.message);
          return;
        }
        if (!data.session) {
          setSuccess("Cadastro realizado. Confira seu e-mail para confirmar a conta.");
          return;
        }
        router.push("/conta");
        router.refresh();
        return;
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        setError("E-mail ou senha inválidos.");
        return;
      }
      router.push(safeInternalPath(new URLSearchParams(window.location.search).get("next")));
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080812] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-purple-500/20 bg-[#111122] p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-3xl font-bold text-purple-400">Cosmic Store</h1>
        <p className="mb-6 text-center text-gray-400">{mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</p>
        <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
          <button type="button" onClick={() => changeMode("login")} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "login" ? "bg-purple-600 text-white" : "text-gray-400"}`}>Entrar</button>
          <button type="button" onClick={() => changeMode("register")} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "register" ? "bg-purple-600 text-white" : "text-gray-400"}`}>Criar conta</button>
        </div>
        <button type="button" onClick={() => void loginDiscord()} disabled={loading} className="w-full rounded-lg bg-[#5865F2] p-3 font-semibold hover:bg-[#4752C4] disabled:opacity-50">
          {loading ? "Conectando..." : `${mode === "login" ? "Entrar" : "Cadastrar"} com Discord`}
        </button>
        <div className="my-6 flex items-center gap-3" aria-hidden="true"><div className="h-px flex-1 bg-gray-700" /><span className="text-sm text-gray-500">OU</span><div className="h-px flex-1 bg-gray-700" /></div>
        <form onSubmit={(event) => { event.preventDefault(); void submitEmail(); }}>
          {mode === "register" && <label className="mb-3 block text-sm font-bold text-gray-300">Nickname<input type="text" placeholder="Escolha seu nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={3} maxLength={24} required autoComplete="nickname" disabled={loading} className="mt-2 w-full rounded-lg border border-gray-700 bg-[#080812] p-3" /></label>}
          <label className="mb-3 block text-sm font-bold text-gray-300">E-mail<input type="email" placeholder="Seu e-mail" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" disabled={loading} className="mt-2 w-full rounded-lg border border-gray-700 bg-[#080812] p-3" /></label>
          <label className="mb-4 block text-sm font-bold text-gray-300">Senha<input type="password" placeholder="Sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} className="mt-2 w-full rounded-lg border border-gray-700 bg-[#080812] p-3" /></label>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-purple-600 p-3 font-semibold hover:bg-purple-700 disabled:opacity-50">{loading ? "Aguarde..." : mode === "login" ? "Entrar com e-mail" : "Criar conta com e-mail"}</button>
        </form>
        {error && <p role="alert" className="mt-4 text-center text-sm text-red-400">{error}</p>}
        {success && <p role="status" className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-sm text-emerald-300">{success}</p>}
      </div>
    </main>
  );
}
