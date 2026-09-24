import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const CHAT_ATTACHMENT_BUCKET = "chat-attachments";
export const CHAT_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);


function hasExpectedImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (type === "image/webp") {
    const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
    return bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  }
  return false;
}

export type ChatAttachmentUpload = {
  path: string;
  name: string;
  type: string;
  bytes: Uint8Array;
};

export function validateChatAttachment(file: File | null) {
  if (!file || file.size === 0) return { ok: true as const, file: null };
  const extension = allowedTypes.get(file.type);
  if (!extension) return { ok: false as const, error: "Envie uma imagem JPG, PNG ou WEBP." };
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) return { ok: false as const, error: "A imagem pode ter no máximo 3 MB." };
  return { ok: true as const, file, extension };
}

export async function uploadChatAttachment(scope: "orders" | "support", conversationId: string, file: File) {
  const checked = validateChatAttachment(file);
  if (!checked.ok || !checked.file || !checked.extension) throw new Error(checked.ok ? "Arquivo inválido." : checked.error);

  const bytes = new Uint8Array(await checked.file.arrayBuffer());
  if (!hasExpectedImageSignature(bytes, checked.file.type)) {
    throw new Error("O arquivo não corresponde a uma imagem válida JPG, PNG ou WEBP.");
  }
  const path = `${scope}/${conversationId}/${crypto.randomUUID()}.${checked.extension}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(CHAT_ATTACHMENT_BUCKET).upload(path, bytes, {
    contentType: checked.file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw new Error("Não foi possível enviar a imagem. Tente novamente.");

  return {
    path,
    name: checked.file.name.slice(0, 180) || `imagem.${checked.extension}`,
    type: checked.file.type,
    bytes,
  } satisfies ChatAttachmentUpload;
}

export async function removeChatAttachment(path: string | null | undefined) {
  if (!path) return;
  await createAdminClient().storage.from(CHAT_ATTACHMENT_BUCKET).remove([path]);
}

export async function withSignedChatAttachments<T extends { attachment_path?: string | null }>(messages: T[]) {
  const admin = createAdminClient();
  return Promise.all(messages.map(async (message) => {
    if (!message.attachment_path) return { ...message, attachment_url: null as string | null };
    const { data } = await admin.storage.from(CHAT_ATTACHMENT_BUCKET).createSignedUrl(message.attachment_path, 60 * 60);
    return { ...message, attachment_url: data?.signedUrl ?? null };
  }));
}
