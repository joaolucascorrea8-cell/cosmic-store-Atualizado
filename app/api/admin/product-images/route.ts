import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import {
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_TYPES,
} from "@/lib/product-images";
import { createAdminClient } from "@/lib/supabase/admin";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function matchesFileSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (type === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }

  if (type === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }

  return false;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Selecione uma imagem." },
        { status: 400 }
      );
    }

    if (
      !PRODUCT_IMAGE_TYPES.includes(
        image.type as (typeof PRODUCT_IMAGE_TYPES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Use uma imagem PNG, JPG, JPEG ou WEBP." },
        { status: 400 }
      );
    }

    if (image.size === 0 || image.size > PRODUCT_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        { error: "A imagem deve ter no máximo 5 MB." },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await image.arrayBuffer());

    if (!matchesFileSignature(bytes, image.type)) {
      return NextResponse.json(
        { error: "O conteúdo do arquivo não corresponde a uma imagem válida." },
        { status: 400 }
      );
    }

    const path = `${randomUUID()}.${extensions[image.type]}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, bytes, {
        contentType: image.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (error) {
      console.error("Erro ao enviar imagem de produto:", error.message);
      return NextResponse.json(
        { error: "Não foi possível enviar a imagem ao Supabase." },
        { status: 500 }
      );
    }

    const { data } = supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl });
  } catch {
    return NextResponse.json(
      { error: "Você precisa estar conectado como administrador." },
      { status: 403 }
    );
  }
}
