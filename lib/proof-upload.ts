import { createClient } from "@/lib/supabase/client";
export async function uploadProof(orderId: string, file: File) {
  if (
    !["image/jpeg", "image/png", "application/pdf"].includes(file.type) ||
    file.size === 0 ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Envie um JPG, PNG ou PDF de até 5 MB.");
  const client = createClient(),
    {
      data: { user },
    } = await client.auth.getUser();
  if (!user)
    throw new Error("Entre novamente na sua conta para enviar o comprovante.");
  const extension =
      file.type === "application/pdf"
        ? "pdf"
        : file.type === "image/png"
          ? "png"
          : "jpg",
    path = `${user.id}/${orderId}/comprovante-${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage
    .from("payment-proofs")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error)
    throw new Error("Não foi possível enviar o arquivo. Tente novamente.");
  const response = await fetch(`/api/orders/${orderId}/proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await response.json();
  if (!response.ok && !(response.status === 409 && data.proofReceived === true))
    throw new Error(data.error ?? "Não foi possível registrar o comprovante.");
}
