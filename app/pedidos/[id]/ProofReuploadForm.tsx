"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadProof } from "@/lib/proof-upload";
import FileDropZone from "@/app/components/FileDropZone";

export default function ProofReuploadForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [proof, setProof] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function upload() {
    if (!proof || loading) return;
    if (
      !["image/jpeg", "image/png", "application/pdf"].includes(proof.type) ||
      proof.size > 5 * 1024 * 1024
    ) {
      setError("Envie JPG, PNG ou PDF de até 5 MB.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await uploadProof(orderId, proof);
      router.push(`/pedidos/${orderId}?proof=resent`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Erro ao reenviar comprovante.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
      <h2 className="text-xl font-black">Enviar novo comprovante</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Confira o motivo informado pela equipe e envie um arquivo corrigido.
      </p>
      <div className="mt-5">
        <FileDropZone file={proof} onChange={setProof} disabled={loading} />
      </div>
      <button
        type="button"
        disabled={!proof || loading}
        onClick={upload}
        className="mt-4 w-full rounded-xl bg-violet-600 py-3 font-black disabled:opacity-50"
      >
        {loading ? "Enviando..." : "Reenviar comprovante"}
      </button>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}
