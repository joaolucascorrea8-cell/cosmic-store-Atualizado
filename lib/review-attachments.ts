import "server-only";

import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

export const REVIEW_ATTACHMENT_BUCKET = "review-attachments";
export const REVIEW_SOURCE_MAX_BYTES = 10 * 1024 * 1024;

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ReviewWithAttachment = {
  attachment_path?: string | null;
  [key: string]: unknown;
};

export function validateReviewImage(file: File | null) {
  if (!file || file.size === 0) return { ok: true as const, file: null };
  if (!allowedTypes.has(file.type)) return { ok: false as const, error: "Envie uma imagem JPG, PNG ou WEBP." };
  if (file.size > REVIEW_SOURCE_MAX_BYTES) return { ok: false as const, error: "A imagem original pode ter no máximo 10 MB." };
  return { ok: true as const, file };
}

export async function optimizeReviewImage(input: Uint8Array | Buffer) {
  let output = await sharp(input, { failOn: "warning" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();

  if (output.byteLength > 2_500_000) {
    output = await sharp(input, { failOn: "warning" })
      .rotate()
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 68, effort: 4 })
      .toBuffer();
  }
  return output;
}

export async function uploadReviewImage(path: string, input: Uint8Array | Buffer) {
  const optimized = await optimizeReviewImage(input);
  const admin = createAdminClient();
  const { error } = await admin.storage.from(REVIEW_ATTACHMENT_BUCKET).upload(path, optimized, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Falha ao salvar imagem da avaliação: ${error.message}`);
  return { path, bytes: optimized.byteLength, type: "image/webp" };
}

export async function removeReviewImage(path: string | null | undefined) {
  if (!path) return;
  await createAdminClient().storage.from(REVIEW_ATTACHMENT_BUCKET).remove([path]);
}

export async function withSignedReviewAttachments<T extends { attachment_path?: string | null }>(rows: T[]) {
  const admin = createAdminClient();
  return Promise.all(rows.map(async (row) => {
    if (!row.attachment_path) return { ...row, attachment_url: null as string | null };
    const { data } = await admin.storage.from(REVIEW_ATTACHMENT_BUCKET).createSignedUrl(row.attachment_path, 60 * 60);
    return { ...row, attachment_url: data?.signedUrl ?? null };
  }));
}
