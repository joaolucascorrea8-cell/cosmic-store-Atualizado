"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProfileFormProps = {
  userId: string;
  email: string;
  initialNickname: string;
  initialAvatarUrl: string | null;
  provider: string;
  initialOnboardingCompleted: boolean;
};

const NICKNAME_PATTERN = /^[A-Za-z0-9_.-]{3,24}$/;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ProfileForm({
  userId,
  email,
  initialNickname,
  initialAvatarUrl,
  provider,
  initialOnboardingCompleted,
}: ProfileFormProps) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(initialAvatarUrl);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isFirstSetup = !initialOnboardingCompleted;

  function chooseAvatar(file: File | null) {
    setError("");
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("A imagem pode ter no máximo 2 MB.");
      return;
    }
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanNickname = nickname.trim();
    if (!NICKNAME_PATTERN.test(cleanNickname)) {
      setError("Use de 3 a 24 caracteres: letras, números, ponto, hífen ou underline.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    let nextAvatarUrl = avatarUrl;

    try {
      if (avatarFile) {
        const extension = avatarFile.type === "image/png"
          ? "png"
          : avatarFile.type === "image/webp"
            ? "webp"
            : "jpg";
        const avatarPath = `${userId}/avatar.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(avatarPath, avatarFile, {
            cacheControl: "3600",
            contentType: avatarFile.type,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
        nextAvatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        nickname: cleanNickname,
        avatar_url: nextAvatarUrl,
        onboarding_completed: true,
      });

      if (profileError) {
        if (profileError.code === "23505") {
          throw new Error("Esse nickname já está sendo usado. Escolha outro.");
        }
        throw profileError;
      }

      setAvatarUrl(nextAvatarUrl);
      setAvatarFile(null);
      setPreviewUrl(nextAvatarUrl);

      if (isFirstSetup) {
        router.replace("/");
        router.refresh();
        return;
      }

      setMessage("Perfil atualizado com sucesso.");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  const initial = nickname.trim().charAt(0).toUpperCase() || "C";

  return (
    <form onSubmit={saveProfile} className="mt-8 space-y-6">
      {isFirstSetup && (
        <section className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
          <div className="flex gap-3">
            <span className="text-2xl" aria-hidden="true">🌌</span>
            <div>
              <h2 className="font-black text-violet-100">Finalize seu perfil</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-300">
                Sua conta já está pronta. Escolha seu nickname e, se quiser, uma foto. Depois de salvar você será levado para o início da Cosmic Store.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-black">Foto do perfil</h2>
        <p className="mt-1 text-sm text-zinc-400">JPG, PNG ou WebP de até 2 MB. A foto é opcional.</p>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          {previewUrl ? (
            <div
              role="img"
              aria-label="Avatar atual"
              className="h-20 w-20 shrink-0 rounded-2xl border border-violet-400/30 bg-cover bg-center"
              style={{ backgroundImage: `url(${JSON.stringify(previewUrl).slice(1, -1)})` }}
            />
          ) : (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-violet-600 text-2xl font-black">
              {initial}
            </div>
          )}
          <label className="w-fit cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10">
            Escolher imagem
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => chooseAvatar(event.target.files?.[0] ?? null)}
              disabled={saving}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-black">Informações públicas</h2>
        <div className="mt-5">
          <label htmlFor="nickname" className="text-sm font-bold text-zinc-300">Nickname</label>
          <input
            id="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            minLength={3}
            maxLength={24}
            required
            disabled={saving}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0d0b12] px-4 py-3 outline-none focus:border-violet-500"
          />
          <p className="mt-2 text-xs text-zinc-500">Será exibido no chat e nas avaliações. Seu e-mail nunca ficará público.</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="text-sm font-bold text-zinc-300">E-mail</span>
            <div className="mt-2 truncate rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-zinc-400">{email}</div>
          </div>
          <div>
            <span className="text-sm font-bold text-zinc-300">Entrada principal</span>
            <div className="mt-2 rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm capitalize text-zinc-400">{provider}</div>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-violet-600 px-6 py-3 font-black hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Salvando..." : isFirstSetup ? "Começar na Cosmic Store" : "Salvar perfil"}
      </button>
    </form>
  );
}
