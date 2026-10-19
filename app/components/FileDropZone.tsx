"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function FileDropZone({
  file,
  onChange,
  disabled = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      queueMicrotask(() => setPreview(""));
      return;
    }
    const url = URL.createObjectURL(file);
    queueMicrotask(() => setPreview(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function select(value: File | undefined) {
    if (!value || disabled) return;
    if (!ALLOWED_TYPES.includes(value.type)) {
      onChange(null);
      setError("Esse formato não é compatível. Envie JPG, PNG ou PDF.");
      return;
    }
    if (value.size === 0 || value.size > MAX_FILE_BYTES) {
      onChange(null);
      setError("O arquivo precisa ter até 5 MB. Escolha uma imagem menor.");
      return;
    }
    setError("");
    onChange(value);
  }

  function handleInputChange(inputElement: HTMLInputElement) {
    select(inputElement.files?.[0]);
    inputElement.value = "";
  }

  return (
    <div>
      <input
        id={id}
        ref={input}
        type="file"
        className="sr-only"
        disabled={disabled}
        accept="image/jpeg,image/png,application/pdf"
        onChange={(event) => handleInputChange(event.currentTarget)}
      />
      <input
        ref={cameraInput}
        type="file"
        className="sr-only"
        disabled={disabled}
        accept="image/jpeg,image/png"
        capture="environment"
        onChange={(event) => handleInputChange(event.currentTarget)}
      />
      <div
        className={`rounded-2xl border border-dashed p-4 transition sm:p-5 ${drag ? "border-violet-400 bg-violet-500/10" : "border-white/15 bg-black/10"} ${disabled ? "opacity-60" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          select(event.dataTransfer.files[0]);
        }}
        onPaste={(event) => {
          const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
          const pasted = imageItem?.getAsFile();
          if (pasted) {
            event.preventDefault();
            select(pasted);
          }
        }}
      >
        {preview ? (
          <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
            <Image
              src={preview}
              unoptimized
              width={640}
              height={480}
              alt="Prévia do comprovante selecionado"
              className="mx-auto max-h-56 w-auto rounded-lg object-contain"
            />
          </div>
        ) : (
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
            <Icon name="upload" className="h-6 w-6" />
          </div>
        )}
        <p className="break-all text-center text-sm font-bold text-white">
          {file?.name ?? "Como você quer enviar o comprovante?"}
        </p>
        <p className="mt-2 text-center text-xs leading-5 text-zinc-400">
          Escolha uma imagem salva, tire uma foto pelo celular ou selecione um PDF.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => input.current?.click()}
            className="min-h-11 rounded-xl border border-white/15 bg-white/[.04] px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed"
          >
            {file ? "Trocar arquivo" : "Escolher arquivo"}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraInput.current?.click()}
            className="min-h-11 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 text-sm font-bold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed"
          >
            Tirar foto com câmera
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-zinc-500">
          JPG, PNG ou PDF · até 5 MB. Você confere a imagem antes de enviar.
        </p>
      </div>
      {file && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange(null);
            setError("");
          }}
          className="mt-3 min-h-9 text-xs font-bold text-zinc-400 underline decoration-white/20 underline-offset-4 hover:text-white"
        >
          Remover arquivo selecionado
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
