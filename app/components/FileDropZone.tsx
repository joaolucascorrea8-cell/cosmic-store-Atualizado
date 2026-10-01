"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";
export default function FileDropZone({
  file,
  onChange,
  disabled = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false);
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
    if (
      !["image/jpeg", "image/png", "application/pdf"].includes(value.type) ||
      value.size === 0 ||
      value.size > 5 * 1024 * 1024
    ) {
      setError("Envie um JPG, PNG ou PDF de até 5 MB.");
      return;
    }
    setError("");
    onChange(value);
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
        onChange={(e) => {
          select(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Escolher comprovante"
        aria-disabled={disabled}
        className={`file-dropzone ${drag ? "file-dropzone-active" : ""}`}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          select(e.dataTransfer.files[0]);
        }}
        onPaste={(e) => {
          const value = Array.from(e.clipboardData.items)
            .find((i) => i.type.startsWith("image/"))
            ?.getAsFile();
          if (value) {
            e.preventDefault();
            select(value);
          }
        }}
      >
        {preview ? (
          <Image
            src={preview}
            unoptimized
            width={240}
            height={180}
            alt="Prévia do comprovante"
            className="mx-auto mb-3 max-h-40 w-auto rounded-lg object-contain"
          />
        ) : (
          <Icon
            name="upload"
            className="mx-auto mb-3 h-7 w-7 text-violet-300"
          />
        )}
        <strong className="block break-all text-sm">
          {file?.name ?? "Escolha, arraste ou cole o comprovante"}
        </strong>
        <span className="mt-2 block text-xs text-zinc-400">
          JPG, PNG ou PDF · até 5 MB
        </span>
      </div>
      {file && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className="mt-2 text-xs text-zinc-400 hover:text-white"
        >
          Remover arquivo
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
