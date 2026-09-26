"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";

type AuthMode = "login" | "register";
type EmbeddedBrowser = "TikTok" | "Instagram" | "Facebook" | "navegador interno" | null;

const EMAIL_DOMAIN_FIXES: Record<string, string> = {
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmai.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "yahoo.con": "yahoo.com",
};

function detectEmbeddedBrowser(userAgent: string): EmbeddedBrowser {
  if (/TikTok|musical_ly|BytedanceWebview/i.test(userAgent)) return "TikTok";
  if (/Instagram/i.test(userAgent)) return "Instagram";
  if (/FBAN|FBAV/i.test(userAgent)) return "Facebook";
  if (/;\s*wv\)|\bwv\b/i.test(userAgent)) return "navegador interno";
  return null;
}

function authErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return String((error as { code?: string }).code ?? "");
}

function suggestedEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return null;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const fixed = EMAIL_DOMAIN_FIXES[domain];
  return fixed ? `${local}@${fixed}` : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [embeddedBrowser, setEmbeddedBrowser] = useState<EmbeddedBrowser>(null);
  const [showBrowserNotice, setShowBrowserNotice] = useState(false);
  const [copied, setCopied] = useState(false);

  const emailSuggestion = useMemo(() => suggestedEmail(email), [email]);

  useEffect(() => {
    setEmbeddedBrowser(detectEmbeddedBrowser(navigator.userAgent));

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError === "confirm_expired") {
      setError("Esse link não é mais válido. Se era uma recuperação de senha, solicite um novo link.");
    } else if (authError === "discord_cancelled") {
      setError("O login com Discord foi cancelado. Tente novamente quando quiser.");
    } else if (authError === "discord_callback") {
      setError("Não foi possível concluir o login com Discord. Abra a loja no Chrome, Opera ou navegador padrão e tente novamente.");
    }
  }, []);

  function nextPath() {
    if (typeof window === "undefined") return "/";
    return safeInternalPath(new URLSearchParams(window.location.search).get("next"));
  }

  function onboardingPath() {
    const next = nextPath();
    return `/conta?next=${encodeURIComponent(next)}`;
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setCapsLock(false);
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

  async function submitEmail() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "register") {
        const cleanNickname = nickname.trim();
        const normalizedConfirmation = confirmEmail.trim().toLowerCase();

        if (!/^[A-Za-z0-9_.-]{3,24}$/.test(cleanNickname)) {
          setError("Use de 3 a 24 caracteres no nickname: letras, números, ponto, hífen ou underline.");
          return;
        }
        if (normalizedEmail !== normalizedConfirmation) {
          setError("Os dois campos de e-mail precisam ser iguais. Confira antes de criar a conta.");
          return;
        }
        if (emailSuggestion) {
          setError(`Confira o domínio do e-mail. Você quis dizer ${emailSuggestion}?`);
          return;
        }
        if (password.length < 6) {
          setError("A senha precisa ter pelo menos 6 caracteres.");
          return;
        }

        const { data, error: registerError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { nickname: cleanNickname } },
        });

        if (registerError) {
          const code = authErrorCode(registerError);
          if (code === "email_exists" || code === "user_already_exists" || registerError.message.toLowerCase().includes("already registered")) {
            setError("Este e-mail já possui uma conta. Troque para Entrar ou use Entrar com Discord se a conta foi criada pelo Discord.");
          } else {
            setError("Não foi possível criar a conta agora. Confira os dados e tente novamente.");
          }
          return;
        }

        if (!data.session) {
          setError("A conta foi criada, mas a entrada automática ainda está bloqueada pela configuração de confirmação de e-mail. Use o Discord por enquanto ou tente novamente depois que a configuração da loja for atualizada.");
          return;
        }

        router.replace(onboardingPath());
        router.refresh();
        return;
      }

      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (loginError) {
        const code = authErrorCode(loginError);
        if (code === "email_not_confirmed") {
          setError("Esta é uma conta antiga que ainda está marcada como e-mail não confirmado. Tente entrar com Discord ou peça ajuda à equipe para liberar a conta.");
          return;
        }
        if (code === "invalid_credentials") {
          setError("E-mail ou senha inválidos. Se sua conta foi criada pelo Discord, use o botão Entrar com Discord.");
          return;
        }
        setError("Não foi possível entrar agora. Tente novamente em instantes.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", loginData.user.id)
        .maybeSingle();

      router.replace(profile?.onboarding_completed === true ? nextPath() : onboardingPath());
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function applySuggestedEmail() {
    if (!emailSuggestion) return;
    setEmail(emailSuggestion);
    if (mode === "register") setConfirmEmail(emailSuggestion);
    setError("");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080812] px-4 py-8 text-white">
      <div className="w-full max-w-md rounded-3xl border border-purple-500/20 bg-[#111122] p-6 shadow-2xl sm:p-8">
        <h1 className="mb-2 text-center text-3xl font-black text-purple-400">Cosmic Store</h1>
        <p className="mb-6 text-center text-gray-400">{mode === "login" ? "Entre na sua conta" : "Crie sua conta e entre na hora"}</p>

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
        <p className="mt-2 text-center text-[11px] leading-4 text-zinc-500">Pelo Discord, se sua conta ainda não existir ela é criada automaticamente.</p>

        <div className="my-6 flex items-center gap-3" aria-hidden="true"><div className="h-px flex-1 bg-gray-700" /><span className="text-sm text-gray-500">OU</span><div className="h-px flex-1 bg-gray-700" /></div>

        <form onSubmit={(event) => { event.preventDefault(); void submitEmail(); }}>
          {mode === "register" && (
            <label className="mb-3 block text-sm font-bold text-gray-300">Nickname
              <input type="text" placeholder="Escolha seu nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={3} maxLength={24} required autoComplete="nickname" disabled={loading} className="mt-2 w-full rounded-xl border border-gray-700 bg-[#080812] p-3 outline-none transition focus:border-purple-500" />
            </label>
          )}

          <label className="mb-3 block text-sm font-bold text-gray-300">E-mail
            <input type="email" inputMode="email" spellCheck={false} autoCapitalize="none" placeholder="Seu e-mail" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" disabled={loading} className="mt-2 w-full rounded-xl border border-gray-700 bg-[#080812] p-3 outline-none transition focus:border-purple-500" />
          </label>

          {emailSuggestion && (
            <button type="button" onClick={applySuggestedEmail} className="-mt-1 mb-3 w-full rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-left text-xs text-amber-100 hover:bg-amber-400/15">
              Parece que há um erro no e-mail. Usar <strong>{emailSuggestion}</strong>?
            </button>
          )}

          {mode === "register" && (
            <label className="mb-3 block text-sm font-bold text-gray-300">Confirmar e-mail
              <input type="email" inputMode="email" spellCheck={false} autoCapitalize="none" placeholder="Digite o e-mail novamente" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} required autoComplete="off" disabled={loading} className="mt-2 w-full rounded-xl border border-gray-700 bg-[#080812] p-3 outline-none transition focus:border-purple-500" />
            </label>
          )}

          <label className="mb-4 block text-sm font-bold text-gray-300">Senha
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                disabled={loading}
                className="w-full rounded-xl border border-gray-700 bg-[#080812] p-3 pr-16 outline-none transition focus:border-purple-500"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-2 my-auto h-9 rounded-lg px-2 text-xs font-bold text-zinc-400 hover:bg-white/5 hover:text-white" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </label>

          {capsLock && <p className="-mt-2 mb-4 text-xs font-bold text-amber-300">Caps Lock está ativado.</p>}

          {mode === "register" && (
            <p className="mb-4 rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs leading-5 text-zinc-400">
              Confira o e-mail antes de continuar. Ele será usado para recuperar sua conta e receber atualizações dos pedidos. O cadastro entra direto, sem exigir clique em e-mail de confirmação.
            </p>
          )}

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-purple-600 p-3 font-semibold transition hover:bg-purple-700 disabled:opacity-50">{loading ? "Aguarde..." : mode === "login" ? "Entrar com e-mail" : "Criar conta e entrar"}</button>
        </form>

        {mode === "login" && (
          <Link href="/forgot-password" className="mt-4 block text-center text-sm font-bold text-violet-300 hover:text-violet-200 hover:underline">Esqueceu sua senha?</Link>
        )}

        <Link href="/ajuda" className="mt-3 block text-center text-xs font-bold text-zinc-500 hover:text-violet-300">Precisa de ajuda para entrar? →</Link>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/15 bg-red-400/10 p-3 text-center text-sm text-red-300">{error}</p>}
        {success && <p role="status" className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-sm text-emerald-300">{success}</p>}
      </div>

      {showBrowserNotice && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="browser-notice-title">
          <div className="w-full max-w-md rounded-3xl border border-violet-400/20 bg-[#12101a] p-6 shadow-2xl">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-2xl">🌌</div>
            <h2 id="browser-notice-title" className="mt-4 text-2xl font-black">Abra a Cosmic Store no seu navegador</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              O navegador interno do {embeddedBrowser ?? "aplicativo"} pode impedir o login com Discord e alguns redirecionamentos. Abra a loja no <strong className="text-white">Chrome, Opera ou no seu navegador padrão</strong> para continuar.
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
