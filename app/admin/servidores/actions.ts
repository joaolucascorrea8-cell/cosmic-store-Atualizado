"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_PATTERN } from "@/lib/catalog";
import { serverJoinUrl } from "@/lib/game-servers";
import { isAllowedProductImageUrl } from "@/lib/product-images";
import { removeUnusedProductImage } from "@/lib/product-image-cleanup";
export type ServerAdminState = { error: string | null; success?: string };
function invalidate() {
  revalidatePath("/servidores");
  revalidatePath("/admin/servidores");
}
function failure(
  error: { code?: string; message: string } | null,
): ServerAdminState {
  console.error("[admin/servidores] Falha na operação:", error);
  if (error?.code === "23505")
    return { error: "Esse link já está cadastrado em outro servidor." };
  if (error?.code === "42P01" || error?.code === "PGRST205")
    return {
      error:
        "Aplique o SQL 202610040001_servers_live_pages.sql no Supabase antes de cadastrar servidores.",
    };
  return {
    error: "Não foi possível salvar. Atualize a lista e tente novamente.",
  };
}
export async function saveGameServer(
  _state: ServerAdminState,
  form: FormData,
): Promise<ServerAdminState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const gameName = String(form.get("game_name") ?? "").trim();
  const name = String(form.get("name") ?? "").trim() || "Servidor VIP";
  const joinUrl = serverJoinUrl(String(form.get("join_url") ?? "").trim());
  const description = String(form.get("description") ?? "").trim();
  const imageUrl = String(form.get("image_url") ?? "").trim();
  const orderText = String(form.get("display_order") ?? "").trim();
  const active = form.get("is_active") === "true";
  if (id && !UUID_PATTERN.test(id)) return { error: "Servidor inválido." };
  if (
    gameName.length < 2 ||
    gameName.length > 100 ||
    name.length < 2 ||
    name.length > 100 ||
    /[\r\n\u0000]/.test(gameName)
  )
    return {
      error: "Confira o nome do jogo e do servidor (2 a 100 caracteres).",
    };
  if (!joinUrl)
    return { error: "Cole um link completo e válido que comece com https://." };
  if (description.length > 600)
    return { error: "A descrição pode ter até 600 caracteres." };
  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl))
    return { error: "Use uma imagem enviada pelo formulário." };
  if (orderText && (!/^\d+$/.test(orderText) || Number(orderText) > 1000000))
    return { error: "A posição deve ser um número inteiro de 0 a 1.000.000." };
  const client = createAdminClient();
  let displayOrder = orderText ? Number(orderText) : 0;
  let oldImage: string | null = null;
  if (!id && !orderText) {
    const { data, error } = await client
      .from("game_servers")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return failure(error);
    displayOrder = Math.min((data?.display_order ?? 0) + 1, 1000000);
  }
  if (id) {
    const { data, error } = await client
      .from("game_servers")
      .select("image_url,updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error) return failure(error);
    if (
      !data ||
      data.updated_at !== String(form.get("expected_updated_at") ?? "")
    )
      return {
        error:
          "Esse servidor mudou em outra tela. Atualize a lista antes de salvar.",
      };
    oldImage = data.image_url;
  }
  const fields = {
    game_name: gameName,
    name,
    join_url: joinUrl,
    description,
    image_url: imageUrl || null,
    is_active: active,
    display_order: displayOrder,
  };
  const query = id
    ? client
        .from("game_servers")
        .update(fields)
        .eq("id", id)
        .eq("updated_at", String(form.get("expected_updated_at")))
    : client.from("game_servers").insert(fields);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return failure(error);
  if (!data)
    return {
      error:
        "Esse servidor mudou em outra tela. Atualize a lista antes de salvar.",
    };
  if (oldImage && oldImage !== fields.image_url)
    await removeUnusedProductImage(oldImage);
  invalidate();
  return {
    error: null,
    success: id ? "Servidor atualizado." : "Servidor cadastrado.",
  };
}
export async function deleteGameServer(
  _state: ServerAdminState,
  form: FormData,
): Promise<ServerAdminState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const expected = String(form.get("expected_updated_at") ?? "");
  if (!UUID_PATTERN.test(id) || !expected)
    return { error: "Servidor inválido." };
  const { data, error } = await createAdminClient()
    .from("game_servers")
    .delete()
    .eq("id", id)
    .eq("is_active", false)
    .eq("updated_at", expected)
    .select("image_url")
    .maybeSingle();
  if (error) return failure(error);
  if (!data)
    return {
      error:
        "Oculte o servidor antes de excluir. Se ele mudou em outra tela, atualize a lista.",
    };
  await removeUnusedProductImage(data.image_url);
  invalidate();
  return { error: null, success: "Servidor excluído." };
}
