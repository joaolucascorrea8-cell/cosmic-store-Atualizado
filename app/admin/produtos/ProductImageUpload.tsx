"use client";

import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  useRef,
  useState,
} from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

type ProductImageUploadProps = {
  defaultValue?: string | null;
  inputId?: string;
};

export default function ProductImageUpload({
  defaultValue = "",
  inputId = "product_image_url",
}: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadImage(file: File) {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Use uma imagem PNG, JPG, JPEG ou WEBP.");
      return;
    }

    if (file.size === 0 || file.size > MAX_SIZE) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setUploading(true);

    try {
      const body = new FormData();
      body.append("image", file);

      const response = await fetch("/api/admin/product-images", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Não foi possível enviar a imagem.");
      }

      setImageUrl(result.url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível enviar a imagem."
      );
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void uploadImage(file);
    event.target.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    const file = imageItem?.getAsFile();

    if (!file) {
      setError(
        "Nenhuma imagem foi encontrada. Copie a imagem, clique nesta área e pressione Ctrl + V."
      );
      return;
    }

    event.preventDefault();
    void uploadImage(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadImage(file);
  }

  return (
    <div>
      <input type="hidden" id={inputId} name="image_url" value={imageUrl} />
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileInput}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Enviar imagem do produto"
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !uploading) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onPaste={handlePaste}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center outline-none transition focus:border-purple-400 ${
          dragging
            ? "border-purple-400 bg-purple-500/10"
            : "border-purple-500/30 bg-[#080812] hover:border-purple-400/70"
        }`}
      >
        {imageUrl ? (
          <div className="space-y-4">
            <div className="relative mx-auto aspect-square w-full max-w-56 overflow-hidden rounded-xl border border-purple-500/20 bg-black/20">
              {/* A URL é criada pelo bucket público do próprio Supabase. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Prévia da imagem do produto"
                className="h-full w-full object-contain"
              />
            </div>
            <p className="text-sm text-purple-200">
              {uploading ? "Enviando imagem..." : "Clique para substituir a imagem"}
            </p>
          </div>
        ) : (
          <div className="py-6">
            <p className="font-semibold text-purple-200">
              {uploading ? "Enviando imagem..." : "Clique, arraste ou cole uma imagem"}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Para colar: copie a imagem, clique aqui e pressione Ctrl + V.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm text-purple-200 transition hover:bg-purple-500/10 disabled:opacity-50"
        >
          {imageUrl ? "Trocar imagem" : "Selecionar imagem"}
        </button>

        {imageUrl && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              setImageUrl("");
              setError(null);
            }}
            className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            Remover imagem
          </button>
        )}

        <span className="text-xs text-gray-500">
          PNG, JPG, JPEG ou WEBP • máximo de 5 MB
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
