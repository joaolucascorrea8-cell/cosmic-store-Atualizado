import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeReviewImage, uploadReviewImage, validateReviewImage } from "@/lib/review-attachments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Entre na sua conta para avaliar." }, { status: 401 });

    const form = await request.formData();
    const orderId = String(form.get("order_id") ?? "");
    const rating = Number(form.get("rating") ?? 0);
    const comment = String(form.get("comment") ?? "").trim();
    const fileValue = form.get("attachment");
    const file = fileValue instanceof File ? fileValue : null;

    if (!orderId) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Escolha uma nota de 1 a 5 estrelas." }, { status: 400 });
    if (comment.length < 3 || comment.length > 600) return NextResponse.json({ error: "A avaliação deve ter entre 3 e 600 caracteres." }, { status: 400 });

    const admin = createAdminClient();
    const { data: order } = await admin.from("orders").select("id,user_id,status").eq("id", orderId).maybeSingle();
    if (!order || order.user_id !== user.id || order.status !== "delivered") {
      return NextResponse.json({ error: "Somente pedidos entregues podem ser avaliados." }, { status: 403 });
    }

    const checked = validateReviewImage(file);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

    const { data: existing } = await admin.from("feedbacks").select("id,attachment_path").eq("order_id", orderId).maybeSingle();
    let nextAttachmentPath = existing?.attachment_path ?? null;
    let uploadedPath: string | null = null;

    if (checked.file) {
      const bytes = new Uint8Array(await checked.file.arrayBuffer());
      uploadedPath = `site/${user.id}/${orderId}/${crypto.randomUUID()}.webp`;
      await uploadReviewImage(uploadedPath, bytes);
      nextAttachmentPath = uploadedPath;
    }

    const payload = {
      order_id: orderId,
      user_id: user.id,
      rating,
      comment,
      author_nickname: "temporario",
      source: "site",
      attachment_path: nextAttachmentPath,
      attachment_name: checked.file?.name?.slice(0, 180) || (nextAttachmentPath ? "imagem-da-entrega.webp" : null),
      attachment_type: nextAttachmentPath ? "image/webp" : null,
    };

    const { error } = await admin.from("feedbacks").upsert(payload, { onConflict: "order_id" });
    if (error) {
      if (uploadedPath) await removeReviewImage(uploadedPath);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (uploadedPath && existing?.attachment_path && existing.attachment_path !== uploadedPath) {
      await removeReviewImage(existing.attachment_path);
    }

    return NextResponse.json({ ok: true, message: existing ? "Avaliação atualizada." : "Obrigado! Sua avaliação foi publicada." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível enviar sua avaliação." }, { status: 500 });
  }
}
