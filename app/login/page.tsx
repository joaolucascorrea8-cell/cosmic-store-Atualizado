"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";

type AuthMode = "login" | "register";
import { GOOGLE_LOGIN_ENABLED } from "@/lib/features";

type SocialProvider = "google" | "discord";
type EmbeddedBrowser =
  "TikTok" | "Instagram" | "Facebook" | "navegador interno" | null;

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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.39a4.61 4.61 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.97-4.33 2.97-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.62.39 3.16 1.04 4.55l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 shrink-0 fill-current"
    >
      <path d="M19.7 5.34A18.4 18.4 0 0 0 15.1 3.9l-.56 1.13a17.1 17.1 0 0 0-5.08 0L8.9 3.9a18.4 18.4 0 0 0-4.6 1.44C1.38 9.7.6 13.96 1 18.17a18.5 18.5 0 0 0 5.63 2.84l1.36-1.86a11.7 11.7 0 0 1-2.14-1.02l.52-.4c4.13 1.9 8.6 1.9 12.68 0l.52.4c-.68.4-1.4.75-2.14 1.02l1.36 1.86a18.5 18.5 0 0 0 5.63-2.84c.47-4.89-.8-9.1-4.72-12.83ZM8.68 15.6c-1.24 0-2.26-1.14-2.26-2.54 0-1.4 1-2.55 2.26-2.55 1.27 0 2.28 1.15 2.26 2.55 0 1.4-1 2.54-2.26 2.54Zm6.64 0c-1.24 0-2.26-1.14-2.26-2.54 0-1.4 1-2.55 2.26-2.55 1.27 0 2.28 1.15 2.26 2.55 0 1.4-.99 2.54-2.26 2.54Z" />
    </svg>
  );
}

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
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(
    null,
  );
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [embeddedBrowser, setEmbeddedBrowser] = useState<EmbeddedBrowser>(null);
  const [showBrowserNotice, setShowBrowserNotice] = useState(false);
  const [copied, setCopied] = useState(false);

  const emailSuggestion = useMemo(() => suggestedEmail(email), [email]);
  const busy = loading || socialLoading !== null;

  useEffect(() => {
    queueMicrotask(() => {
      setEmbeddedBrowser(detectEmbeddedBrowser(navigator.userAgent));

      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      if (authError === "confirm_expired") {
        setError(
          "Esse link não é mais válido. Se era uma recuperação de senha, solicite um novo link.",
        );
      } else if (
        authError === "oauth_cancelled" ||
        authError === "discord_cancelled"
      ) {
        setError("O acesso foi cancelado. Tente novamente quando quiser.");
      } else if (
        authError === "oauth_callback" ||
        authError === "discord_callback"
      ) {
        setError(
          "Não foi possível concluir o acesso. Abra a loja no Chrome, Opera ou navegador padrão e tente novamente.",
        );
      }
    });
  }, []);

  function nextPath() {
    if (typeof window === "undefined") return "/";
    return safeInternalPath(
      new URLSearchParams(window.location.search).get("next"),
    );
  }

  function onboardingPath() {
    const next = nextPath();
    return `/conta?next=${encodeURIComponent(next)}`;
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setCapsLock(false);
  }

  function externalLoginUrl() {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const usableConfigured =
      configured &&
      /^https?:\/\//i.test(configured) &&
      !/localhost|127\.0\.0\.1/i.test(configured);
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
    if (/Android/i.test(navigator.userAgent)) {
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

  async function socialLogin(provider: SocialProvider) {
    if (embeddedBrowser) {
      setShowBrowserNotice(true);
      return;
    }

    setSocialLoading(provider);
    setError("");
    try {
      const next = nextPath();
      const options =
        provider === "discord"
          ? {
              redirectTo: `${window.location.origin}/auth/callback?provider=discord&next=${encodeURIComponent(next)}`,
              scopes: "identify email guilds.join",
            }
          : {
              redirectTo: `${window.location.origin}/auth/callback?provider=google&next=${encodeURIComponent(next)}`,
            };

      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider,
        options,
      });
      if (oauthError) {
        setError(
          `Não foi possível iniciar o acesso com ${provider === "google" ? "Google" : "Discord"}. Tente novamente.`,
        );
        setSocialLoading(null);
      }
    } catch {
      setError(
        `Não foi possível conectar ao ${provider === "google" ? "Google" : "Discord"}. Tente novamente.`,
      );
      setSocialLoading(null);
    }
  }

  async function submitEmail() {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "register") {
        const normalizedConfirmation = confirmEmail.trim().toLowerCase();

        if (normalizedEmail !== normalizedConfirmation) {
          setError(
            "Os dois campos de e-mail precisam ser iguais. Confira antes de criar a conta.",
          );
          return;
        }
        if (emailSuggestion) {
          setError(
            `Confira o domínio do e-mail. Você quis dizer ${emailSuggestion}?`,
          );
          return;
        }
        if (password.length < 6) {
          setError("A senha precisa ter pelo menos 6 caracteres.");
          return;
        }

        const { data, error: registerError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });

        if (registerError) {
          const code = authErrorCode(registerError);
          if (
            code === "email_exists" ||
            code === "user_already_exists" ||
            registerError.message.toLowerCase().includes("already registered")
          ) {
            setError(
              "Este e-mail já possui uma conta. Troque para Entrar ou use Google/Discord se cadastrou por uma dessas opções.",
            );
          } else {
            setError(
              "Não foi possível criar a conta agora. Confira os dados e tente novamente.",
            );
          }
          return;
        }

        if (!data.session) {
          setError(
            "A conta foi criada, mas a entrada automática ainda está bloqueada pela confirmação de e-mail no Supabase. Desative Confirm email para usar o cadastro direto.",
          );
          return;
        }

        router.replace(onboardingPath());
        router.refresh();
        return;
      }

      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (loginError) {
        const code = authErrorCode(loginError);
        if (code === "email_not_confirmed") {
          setError(
            "Esta é uma conta antiga ainda marcada como e-mail não confirmado. Peça ajuda à equipe para liberar a conta.",
          );
          return;
        }
        if (code === "invalid_credentials") {
          setError(
            "E-mail ou senha inválidos. Se sua conta foi criada com Google ou Discord, use o botão correspondente.",
          );
          return;
        }
        setError(
          "Não foi possível entrar agora. Tente novamente em instantes.",
        );
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", loginData.user.id)
        .maybeSingle();

      router.replace(
        profile?.onboarding_completed === true ? nextPath() : onboardingPath(),
      );
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
    <main
      id="conteudo-principal"
      tabIndex={-1}
      className="relative min-h-dvh overflow-hidden bg-[#080812] px-4 py-7 text-white sm:px-6 lg:grid lg:place-items-center lg:py-10"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden="true"
      >
        <div className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-violet-700/10 blur-3xl" />
        <div className="absolute bottom-[8%] right-[6%] h-64 w-64 rounded-full bg-fuchsia-700/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0f0d18]/95 shadow-[0_30px_90px_rgba(0,0,0,.48)] lg:grid-cols-[.92fr_1.08fr]">
        <aside className="relative hidden min-h-[620px] overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_25%_20%,rgba(139,92,246,.25),transparent_34%),linear-gradient(145deg,#151020,#0b0910)] p-9 lg:flex lg:flex-col">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xl font-black tracking-tight"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-violet-300/20 bg-violet-500/15 text-violet-200">
                ✦
              </span>
              Cosmic Store
            </Link>
            <h2 className="mt-14 max-w-sm text-4xl font-black leading-[1.08] tracking-[-.045em]">
              Entre, acompanhe seu pedido e receba tudo em um só lugar.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-zinc-300/80">
              Acesso rápido para suas compras, comprovantes, suporte e entregas
              dentro do jogo.
            </p>
          </div>

          <div className="mt-14 grid gap-2.5">
            {[
              [
                "01",
                "Compra rápida",
                "Escolha o produto e finalize sem etapas desnecessárias.",
              ],
              [
                "02",
                "Pedido acompanhado",
                "Veja pagamento, preparação e entrega pela sua conta.",
              ],
              [
                "03",
                "Suporte no pedido",
                "Converse com a equipe sem sair da Cosmic Store.",
              ],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="flex gap-3.5 rounded-2xl border border-white/[.08] bg-white/[.04] px-4 py-3.5 backdrop-blur-sm"
              >
                <span className="text-xs font-black text-violet-300">
                  {number}
                </span>
                <div>
                  <strong className="text-sm">{title}</strong>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[600px] items-center p-5 sm:p-8 lg:p-11">
          <div className="mx-auto w-full max-w-md">
            <div className="text-center lg:text-left">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-violet-300 lg:hidden"
              >
                <span>✦</span> Cosmic Store
              </Link>
              <p className="mt-5 text-xs font-black uppercase tracking-[.22em] text-violet-400">
                Sua conta
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">
                {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-300/80">
                {mode === "login"
                  ? "Entre para continuar suas compras e acompanhar pedidos."
                  : "Use Discord ou crie sua conta por e-mail em poucos segundos."}
              </p>
            </div>

            {embeddedBrowser && (
              <button
                type="button"
                onClick={() => setShowBrowserNotice(true)}
                className="mt-5 w-full rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-left text-xs leading-5 text-amber-100 transition hover:bg-amber-400/15"
              >
                <strong>
                  Navegador interno do {embeddedBrowser} detectado.
                </strong>
                <br />
                Google e Discord podem falhar aqui.{" "}
                <span className="font-black underline">
                  Abrir no navegador correto
                </span>
              </button>
            )}

            <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-black/25 p-1">
              <button
                type="button"
                onClick={() => changeMode("login")}
                className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === "login" ? "bg-violet-600 text-white shadow-lg shadow-violet-950/30" : "text-zinc-400 hover:text-white"}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => changeMode("register")}
                className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === "register" ? "bg-violet-600 text-white shadow-lg shadow-violet-950/30" : "text-zinc-400 hover:text-white"}`}
              >
                Criar conta
              </button>
            </div>

            <div
              className={`mt-5 grid gap-2.5 ${GOOGLE_LOGIN_ENABLED ? "sm:grid-cols-2" : ""}`}
            >
              {GOOGLE_LOGIN_ENABLED && (
                <button
                  type="button"
                  onClick={() => void socialLogin("google")}
                  disabled={busy}
                  className="group flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white px-4 py-3 text-sm font-extrabold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <GoogleIcon />
                  <span>
                    {socialLoading === "google"
                      ? "Conectando..."
                      : "Continuar com Google"}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void socialLogin("discord")}
                disabled={busy}
                className="flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-[#6772f3]/40 bg-[#5865F2]/12 px-4 py-3 text-sm font-extrabold text-[#aeb5ff] transition hover:bg-[#5865F2]/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
              >
                <DiscordIcon />
                <span>
                  {socialLoading === "discord"
                    ? "Conectando..."
                    : "Continuar com Discord"}
                </span>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] leading-4 text-zinc-600">
              Se a conta ainda não existir, ela é criada automaticamente.
            </p>

            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] font-bold uppercase tracking-[.18em] text-zinc-600">
                ou com e-mail
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitEmail();
              }}
            >
              <label className="mb-3 block text-sm font-bold text-zinc-300">
                E-mail
                <input
                  type="email"
                  inputMode="email"
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  disabled={busy}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#080812] px-4 py-3 outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                />
              </label>

              {emailSuggestion && (
                <button
                  type="button"
                  onClick={applySuggestedEmail}
                  className="-mt-1 mb-3 w-full rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-left text-xs text-amber-100 hover:bg-amber-400/15"
                >
                  Parece que há um erro no e-mail. Usar{" "}
                  <strong>{emailSuggestion}</strong>?
                </button>
              )}

              {mode === "register" && (
                <label className="mb-3 block text-sm font-bold text-zinc-300">
                  Confirmar e-mail
                  <input
                    type="email"
                    inputMode="email"
                    spellCheck={false}
                    autoCapitalize="none"
                    placeholder="Digite o e-mail novamente"
                    value={confirmEmail}
                    onChange={(event) => setConfirmEmail(event.target.value)}
                    required
                    autoComplete="off"
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#080812] px-4 py-3 outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                  />
                </label>
              )}

              <label className="mb-4 block text-sm font-bold text-zinc-300">
                <span className="flex items-center justify-between gap-3">
                  <span>{mode === "login" ? "Senha" : "Criar senha"}</span>
                  {mode === "login" && (
                    <Link
                      href="/forgot-password"
                      className="text-xs font-bold text-violet-300 transition hover:text-violet-200 hover:underline"
                    >
                      Esqueceu sua senha?
                    </Link>
                  )}
                </span>
                <div className="relative mt-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "login" ? "Sua senha" : "Crie uma senha"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) =>
                      setCapsLock(event.getModifierState("CapsLock"))
                    }
                    onKeyUp={(event) =>
                      setCapsLock(event.getModifierState("CapsLock"))
                    }
                    required
                    minLength={6}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    disabled={busy}
                    aria-describedby={mode === "register" ? "password-help" : undefined}
                    className="w-full rounded-xl border border-white/10 bg-[#080812] px-4 py-3 pr-20 outline-none transition placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-2 my-auto h-9 rounded-lg px-2.5 text-xs font-black text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                {mode === "register" && (
                  <span id="password-help" className="mt-2 block text-xs font-medium text-zinc-400">
                    Use pelo menos 6 caracteres.
                  </span>
                )}
              </label>

              {capsLock && (
                <p className="-mt-2 mb-4 text-xs font-bold text-amber-300">
                  Caps Lock está ativado.
                </p>
              )}

              {mode === "register" && (
                <p className="mb-4 text-xs leading-5 text-zinc-400">
                  Confira seu e-mail. Ele será usado para recuperar a conta e
                  receber atualizações dos pedidos. O nickname é escolhido no
                  próximo passo.
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-black transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading
                  ? "Aguarde..."
                  : mode === "login"
                    ? "Entrar"
                    : "Criar conta"}
              </button>
            </form>

            <Link
              href="/ajuda"
              className="mt-4 block text-center text-xs font-bold text-zinc-400 transition hover:text-violet-300"
            >
              Precisa de ajuda para entrar? →
            </Link>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-400/15 bg-red-400/10 p-3 text-center text-sm leading-5 text-red-300"
              >
                {error}
              </p>
            )}
          </div>
        </section>
      </div>

      {showBrowserNotice && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="browser-notice-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-violet-400/20 bg-[#12101a] p-6 shadow-2xl">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-2xl">
              🌌
            </div>
            <h2 id="browser-notice-title" className="mt-4 text-2xl font-black">
              Abra a Cosmic Store no seu navegador
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              O navegador interno do {embeddedBrowser ?? "aplicativo"} pode
              impedir o login com Google, Discord e alguns redirecionamentos.
              Abra a loja no{" "}
              <strong className="text-white">
                Chrome, Opera ou navegador padrão
              </strong>{" "}
              para continuar.
            </p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={openExternalBrowser}
                className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black transition hover:bg-violet-500"
              >
                Abrir no navegador ↗
              </button>
              <button
                type="button"
                onClick={() => void copyStoreLink()}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/10"
              >
                {copied ? "✓ Link copiado" : "Copiar link da loja"}
              </button>
              <button
                type="button"
                onClick={() => setShowBrowserNotice(false)}
                className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white"
              >
                Voltar
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] leading-4 text-zinc-500">
              Se o botão ainda abrir dentro do aplicativo, copie o link e cole
              manualmente no navegador.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
