"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";

type AuthMode = "login" | "register";
type EmbeddedBrowser = "TikTok" | "Instagram" | "Facebook" | "navegador interno" | null;

const RESEND_SECONDS = 60;

function detectEmbeddedBrowser(userAgent: string): EmbeddedBrowser {
  if (/TikTok|musical_ly|BytedanceWebview/i.test(userAgent)) return "TikTok";
  if (/Instagram/i.test(userAgent)) return "Instagram";
  if (/FBAN|FBAV/i.test(userAgent)) return "Facebook";
  if (/;\s*wv\)|\bwv\b/i.test(userAgent)) return "navegador interno";
  return null;
}

function maskEmail(value: string) {
  const [local = "", domain = ""] = value.split("@");
  if (!domain) return value;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${local.length > visible.length ? "***" : ""}@${domain}`;
}

function inboxUrl(value: string) {
  const domain = value.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  if (domain === "gmail.com" || domain === "googlemail.com") return "https://mail.google.com/";
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return "https://outlook.live.com/mail/";
  if (domain === "yahoo.com" || domain.startsWith("yahoo.")) return "https://mail.yahoo.com/";
  return null;
}

function authErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return String((error as { code?: string }).code ?? "");
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [embeddedBrowser, setEmbeddedBrowser] = useState<EmbeddedBrowser>(null);
  const [showBrowserNotice, setShowBrowserNotice] = useState(false);
  const [copied, setCopied] = useState(false);

  const pendingInboxUrl = useMemo(() => pendingEmail ? inboxUrl(pendingEmail) : null, [pendingEmail]);

  useEffect(() => {
    setEmbeddedBrowser(detectEmbeddedBrowser(navigator.userAgent));

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError === "confirm_expired") {
      setMode("register");
      setError("Esse link de confirmação é inválido ou expirou. Você pode solicitar um novo e-mail de confirmação.");
    } else if (authError === "discord_cancelled") {
      setError("O login com Discord foi cancelado. Tente novamente quando quiser.");
    } else if (authError === "discord_callback") {
      setError("Não foi possível concluir o login com Discord. Abra a loja no Chrome, Opera ou navegador padrão e tente novamente.");
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  function nextPath() {
    if (typeof window === "undefined") return "/";
    return safeInternalPath(new URLSearchParams(window.location.search).get("next"));
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPendingEmail(null);
  }

  function externalLoginUrl() {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const usableConfigured = configured && /^https?:\/\//i.test(configured) && !/localhost|127\.0\.0\.1/i.test(configured);
    const base = usableConfigured ? configured! : window.location.origin;
    const next = nextPath();
    return `${base.replace(/\/$/, "")}/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
  }

  async function copyStoreLink() {
    const link = externalLoginUrl();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = document.createElement("textarea");
      input.value = link;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  function openExternalBrowser() {
    const link = externalLoginUrl();
    const userAgent = navigator.userAgent;
    if (/Android/i.test(userAgent)) {
      try {
        const url = new URL(link);
        const scheme = url.protocol.replace(":", "");
        window.location.href = `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${scheme};action=android.intent.action.VIEW;end`;
        return;
      } catch {
        // Cai no fallback abaixo.
      }
    }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function loginDiscord() {
    if (embeddedBrowser) {
      setShowBrowserNotice(true);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const next = nextPath();
      const { error: discordError } = await createClient().auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          scopes: "identify email guilds.join",
        },
      });
      if (discordError) {
        setError("Não foi possível iniciar o login com Discord. Tente novamente.");
        setLoading(false);
      }
    } catch {
      setError("Não foi possível conectar ao Discord. Tente novamente.");
      setLoading(false);
    }
  }

  async function resendConfirmation(targetEmail = pendingEmail ?? email) {
    const normalizedEmail = targetEmail.trim().toLowerCase();
    if (!normalizedEmail || resendCooldown > 0) return;

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/conta`,
        },
      });

      if (resendError) {
        const code = authErrorCode(resendError);
        if (code === "over_email_send_rate_limit") {
          setError("Você pediu outro e-mail há pouco tempo. Aguarde alguns segundos e tente novamente.");
        } else {
          setError("Não foi possível reenviar agora. Confira o endereço e tente novamente em instantes.");
        }
        return;
      }

      setPendingEmail(normalizedEmail);
      setResendCooldown(RESEND_SECONDS);
      setSuccess("Novo e-mail de confirmação enviado.");
    } catch {
      setError("Não foi possível reenviar o e-mail. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function checkConfirmationAndLogin() {
    if (!pendingEmail || !password) {
      setError("Volte para Entrar e informe sua senha para acessar a conta.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { error: loginError } = await createClient().auth.signInWithPassword({
        email: pendingEmail,
        password,
      });

      if (loginError) {
        if (authErrorCode(loginError) === "email_not_confirmed") {
          setError("Seu e-mail ainda não foi confirmado. Abra a mensagem da Cosmic Store e toque em confirmar conta.");
        } else {
          setError("Ainda não foi possível entrar. Se você já confirmou, volte para Entrar e tente novamente.");
        }
        return;
      }

      router.replace(nextPath() === "/" ? "/conta" : nextPath());
      router.refresh();
    } catch {
      setError("Não foi possível verificar a confirmação agora.");
    } finally {
      setLoading(false);
    }
  }

  async function submitEmail() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();

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
          email: normalizedEmail,
          password,
          options: {
            data: { nickname: cleanNickname },
            emailRedirectTo: `${window.location.origin}/conta`,
          },
        });

        if (registerError) {
          const code = authErrorCode(registerError);
          if (code === "email_exists" || code === "user_already_exists" || registerError.message.includes("already registered")) {
            setError("Este e-mail já possui uma conta. Troque para Entrar ou use Entrar com Discord se a conta foi criada pelo Discord.");
          } else {
            setError("Não foi possível criar a conta agora. Confira os dados e tente novamente.");
          }
          return;
        }

        if (!data.session) {
          setPendingEmail(normalizedEmail);
          setResendCooldown(RESEND_SECONDS);
          return;
        }

        router.replace(nextPath() === "/" ? "/conta" : nextPath());
        router.refresh();
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (loginError) {
        const code = authErrorCode(loginError);
        if (code === "email_not_confirmed") {
          setPendingEmail(normalizedEmail);
          setError("");
          return;
        }
        if (code === "invalid_credentials") {
          setError("E-mail ou senha inválidos. Se sua conta foi criada pelo Discord, use o botão Entrar com Discord.");
          return;
        }
        setError("Não foi possível entrar agora. Tente novamente em instantes.");
        return;
      }

      router.replace(nextPath());
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (pendingEmail) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#080812] px-4 py-8 text-white">
        <div className="w-full max-w-md rounded-3xl border border-purple-500/20 bg-[#111122] p-6 shadow-2xl sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-2xl">✉️</div>
          <h1 className="mt-5 text-center text-2xl font-black sm:text-3xl">Falta só confirmar seu e-mail</h1>
          <p className="mt-3 text-center text-sm leading-6 text-zinc-400">
            Enviamos um link de confirmação para <strong className="text-zinc-200">{maskEmail(pendingEmail)}</strong>.
            Abra a mensagem da Cosmic Store e toque em <strong className="text-zinc-200">Confirmar minha conta</strong>.
          </p>

          <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4 text-sm text-amber-100/90">
            Não encontrou? Confira também as pastas <strong>Spam</strong> e <strong>Promoções</strong>.
          </div>

          <div className="mt-5 grid gap-2">
            {pendingInboxUrl && (
              <a href={pendingInboxUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-purple-600 px-4 py-3 text-center text-sm font-black transition hover:bg-purple-500">
                Abrir {pendingEmail.endsWith("@gmail.com") ? "Gmail" : "meu e-mail"} ↗
              </a>
            )}
            <button type="button" onClick={() => void checkConfirmationAndLogin()} disabled={loading} className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/15 disabled:opacity-50">
              {loading ? "Verificando..." : "Já confirmei — entrar agora"}
            </button>
            <button type="button" onClick={() => void resendConfirmation()} disabled={loading || resendCooldown > 0} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
              {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar e-mail de confirmação"}
            </button>
            <button type="button" onClick={() => { setPendingEmail(null); setMode("register"); setError(""); setSuccess(""); }} className="px-4 py-2 text-sm font-bold text-violet-300 hover:text-violet-200">
              Digitou o e-mail errado? Usar outro e-mail
            </button>
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/15 bg-red-400/10 p-3 text-center text-sm text-red-300">{error}</p>}
          {success && <p role="status" className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/10 p-3 text-center text-sm text-emerald-300">{success}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080812] px-4 py-8 text-white">
      <div className="w-full max-w-md rounded-3xl border border-purple-500/20 bg-[#111122] p-6 shadow-2xl sm:p-8">
        <h1 className="mb-2 text-center text-3xl font-black text-purple-400">Cosmic Store</h1>
        <p className="mb-6 text-center text-gray-400">{mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</p>

        {embeddedBrowser && (
          <button type="button" onClick={() => setShowBrowserNotice(true)} className="mb-5 w-full rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-left text-xs leading-5 text-amber-100 transition hover:bg-amber-400/15">
            <strong>Você está no navegador interno do {embeddedBrowser}.</strong><br />
            Para entrar com Discord sem erros, abra a loja no Chrome, Opera ou navegador padrão. <span className="font-black underline">Ver como</span>
          </button>
        )}

        <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
          <button type="button" onClick={() => changeMode("login")} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "login" ? "bg-purple-600 text-white" : "text-gray-400"}`}>Entrar</button>
          <button type="button" onClick={() => changeMode("register")} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "register" ? "bg-purple-600 text-white" : "text-gray-400"}`}>Criar conta</button>
        </div>

        <button type="button" onClick={() => void loginDiscord()} disabled={loading} className="w-full rounded-xl bg-[#5865F2] p-3 font-semibold transition hover:bg-[#4752C4] disabled:opacity-50">
          {loading ? "Conectando..." : `${mode === "login" ? "Entrar" : "Cadastrar"} com Discord`}
        </button>
        <p className="mt-2 text-center text-[11px] leading-4 text-zinc-500">
          Pelo Discord, se sua conta ainda não existir ela é criada automaticamente.
        </p>

        <div className="my-6 flex items-center gap-3" aria-hidden="true"><div className="h-px flex-1 bg-gray-700" /><span className="text-sm text-gray-500">OU</span><div className="h-px flex-1 bg-gray-700" /></div>

        <form onSubmit={(event) => { event.preventDefault(); void submitEmail(); }}>
          {mode === "register" && <label className="mb-3 block text-sm font-bold text-gray-300">Nickname<input type="text" placeholder="Escolha seu nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={3} maxLength={24} required autoComplete="nickname" disabled={loading} className="mt-2 w-full rounded-xl border border-gray-700 bg-[#080812] p-3 outline-none transition focus:border-purple-500" /></label>}
          <label className="mb-3 block text-sm font-bold text-gray-300">E-mail<input type="email" placeholder="Seu e-mail" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" disabled={loading} className="mt-2 w-full rounded-xl border border-gray-700 bg-[#080812] p-3 outline-none transition focus:border-purple-500" /></label>
          <label className="mb-4 block text-sm font-bold text-gray-300">Senha<input type="password" placeholder="Sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} className="mt-2 w-full rounded-xl border border-gray-700 bg-[#080812] p-3 outline-none transition focus:border-purple-500" /></label>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-purple-600 p-3 font-semibold transition hover:bg-purple-700 disabled:opacity-50">{loading ? "Aguarde..." : mode === "login" ? "Entrar com e-mail" : "Criar conta com e-mail"}</button>
        </form>

        {mode === "login" && (
          <Link href="/forgot-password" className="mt-4 block text-center text-sm font-bold text-violet-300 hover:text-violet-200 hover:underline">
            Esqueceu sua senha?
          </Link>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/15 bg-red-400/10 p-3 text-center text-sm text-red-300">{error}</p>}
        {success && <p role="status" className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-sm text-emerald-300">{success}</p>}
      </div>

      {showBrowserNotice && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="browser-notice-title">
          <div className="w-full max-w-md rounded-3xl border border-violet-400/20 bg-[#12101a] p-6 shadow-2xl">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-2xl">🌌</div>
            <h2 id="browser-notice-title" className="mt-4 text-2xl font-black">Abra a Cosmic Store no seu navegador</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              O navegador interno do {embeddedBrowser ?? "aplicativo"} pode impedir o login com Discord e alguns redirecionamentos de confirmação.
              Abra a loja no <strong className="text-white">Chrome, Opera ou no seu navegador padrão</strong> para continuar.
            </p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={openExternalBrowser} className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-black transition hover:bg-purple-500">Abrir no navegador ↗</button>
              <button type="button" onClick={() => void copyStoreLink()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/10">{copied ? "✓ Link copiado" : "Copiar link da loja"}</button>
              <button type="button" onClick={() => setShowBrowserNotice(false)} className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white">Voltar</button>
            </div>
            <p className="mt-3 text-center text-[11px] leading-4 text-zinc-500">Se o botão ainda abrir dentro do aplicativo, copie o link e cole manualmente no seu navegador.</p>
          </div>
        </div>
      )}
    </main>
  );
}
