"use server";

import { parsePrice, slugify } from "@/lib/catalog";
import { removeUnusedProductImage } from "@/lib/product-image-cleanup";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedProductImageUrl } from "@/lib/product-images";
import {
  buildComboPromotionBody,
  sendComboPromotion,
  type ComboPromotionProduct,
} from "@/lib/combo-promotions";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function promotionSummary(
  result: Awaited<ReturnType<typeof sendComboPromotion>>,
) {
  const parts: string[] = [];
  if (result.emailSent || result.emailFailed)
    parts.push(
      `${result.emailSent} e-mail(s) enviado(s)${result.emailFailed ? ` · ${result.emailFailed} falha(s)` : ""}`,
    );
  if (result.discordStatus)
    parts.push(
      result.discordStatus === "sent" ? "Discord publicado" : "Discord falhou",
    );
  return parts.join(" · ") || "Combo criado sem divulgação.";
}

export type ComboState = { error: string | null };
export async function saveCombo(
  _state: ComboState,
  formData: FormData,
): Promise<ComboState> {
  const user = await requireAdmin();
  const id = String(formData.get("combo_id") ?? ""),
    name = String(formData.get("name") ?? "").trim(),
    description = String(formData.get("description") ?? "").trim(),
    imageUrl = String(formData.get("image_url") ?? "").trim();
  const price = parsePrice(formData.get("price")),
    isActive = formData.get("is_active") === "on",
    sendEmail = formData.get("send_email") === "on",
    sendDiscord = formData.get("send_discord") === "on";
  if (id && !uuidRegex.test(id)) return { error: "Combo inválido." };
  if (
    name.length < 2 ||
    name.length > 120 ||
    description.length > 3000 ||
    price === null ||
    price <= 0
  )
    return { error: "Confira nome, descrição e preço do combo." };
  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl))
    return { error: "Envie uma imagem válida para o combo." };
  const productIds = formData.getAll("product_ids").map(String);
  if (
    !productIds.length ||
    productIds.length > 40 ||
    productIds.some((id) => !uuidRegex.test(id)) ||
    new Set(productIds).size !== productIds.length
  )
    return { error: "Selecione de 1 a 40 produtos diferentes." };
  const items = productIds.map((id) => ({
    id,
    quantity: Number(formData.get(`qty_${id}`) ?? 1),
  }));
  if (
    items.some(
      (item) =>
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99,
    )
  )
    return { error: "As quantidades devem ser de 1 a 99." };
  const endsRaw = String(formData.get("ends_at") ?? "");
  if (endsRaw && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(endsRaw))
    return { error: "Data final inválida." };
  const ends = endsRaw ? new Date(`${endsRaw}:00-03:00`) : null;
  if (
    ends &&
    (Number.isNaN(ends.getTime()) || (isActive && ends.getTime() <= Date.now()))
  )
    return {
      error: "A data final de um combo publicado precisa estar no futuro.",
    };
  if ((sendEmail || sendDiscord) && !isActive)
    return { error: "Publique o combo antes de divulgá-lo." };
  const admin = createAdminClient();
  const { data: previous } = id
    ? await admin.from("combos").select("image_url").eq("id", id).maybeSingle()
    : { data: null };
  const { data: combo, error } = await admin.rpc("save_store_combo", {
    p_admin_id: user.id,
    p_combo_id: id || null,
    p_name: name,
    p_slug: slugify(name) || "combo",
    p_description: description,
    p_price: price,
    p_image_url: imageUrl,
    p_active: isActive,
    p_ends_at: ends?.toISOString() ?? null,
    p_items: items,
  });
  if (error || !combo)
    return {
      error:
        error?.code === "P0001"
          ? error.message
          : "Não foi possível salvar o combo. Tente novamente.",
    };
  if (previous?.image_url !== imageUrl)
    await removeUnusedProductImage(previous?.image_url);
  let message = id
    ? "Combo atualizado. O link original foi preservado."
    : "Combo criado sem divulgação.";
  if (sendEmail || sendDiscord) {
    const { data: products } = await admin
      .from("products")
      .select("id,name,image_url")
      .in("id", productIds);
    const promotionProducts: ComboPromotionProduct[] = (products ?? []).map(
      (p) => ({
        name: p.name,
        image_url: p.image_url,
        quantity: items.find((i) => i.id === p.id)?.quantity ?? 1,
      }),
    );
    const body =
      String(formData.get("promotion_body") ?? "").trim() ||
      buildComboPromotionBody({
        comboName: name,
        products: promotionProducts,
        price,
        compareAtPrice: Number(combo.compare_at_price),
      });
    try {
      message = promotionSummary(
        await sendComboPromotion({
          comboId: combo.id,
          comboName: name,
          comboSlug: combo.slug,
          body,
          coverUrl: imageUrl || null,
          products: promotionProducts,
          price,
          compareAtPrice: Number(combo.compare_at_price),
          sendEmail,
          sendDiscord,
          createdBy: user.id,
        }),
      );
    } catch (error) {
      message = `Combo salvo. Divulgação pendente: ${error instanceof Error ? error.message : "tente novamente"}`;
    }
  }
  revalidatePath("/", "layout");
  redirect(
    `/admin/combos?${id ? "updated" : "created"}=${combo.id}&message=${encodeURIComponent(message)}`,
  );
}

export async function promoteCombo(formData: FormData) {
  const user = await requireAdmin();
  const comboId = String(formData.get("combo_id") ?? "");
  const sendEmail = formData.get("send_email") === "on";
  const sendDiscord = formData.get("send_discord") === "on";
  const body = String(formData.get("promotion_body") ?? "").trim();

  if (!uuidRegex.test(comboId)) throw new Error("Combo inválido.");
  if (!sendEmail && !sendDiscord)
    throw new Error("Marque E-mail, Discord ou os dois.");
  if (body.length < 2 || body.length > 3000)
    throw new Error(
      "O texto da divulgação deve ter entre 2 e 3000 caracteres.",
    );

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("combos")
    .select(
      "id,name,slug,price,compare_at_price,image_url,is_active,starts_at,ends_at,combo_items(quantity,products(name,image_url,is_active))",
    )
    .eq("id", comboId)
    .maybeSingle();

  if (error || !data) throw new Error("Combo não encontrado.");
  const now = Date.now();
  if (
    !data.is_active ||
    (data.starts_at && new Date(data.starts_at).getTime() > now) ||
    (data.ends_at && new Date(data.ends_at).getTime() <= now)
  ) {
    throw new Error("Ative o combo e confira a validade antes de divulgar.");
  }

  const products = (data.combo_items ?? [])
    .map((item) => {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      return product
        ? {
            name: String(product.name),
            image_url: product.image_url ? String(product.image_url) : null,
            is_active: Boolean(product.is_active),
            quantity: Number(item.quantity),
          }
        : null;
    })
    .filter(Boolean) as Array<ComboPromotionProduct & { is_active: boolean }>;

  if (products.some((product) => !product.is_active))
    throw new Error("Um produto deste combo está inativo.");

  const result = await sendComboPromotion({
    comboId: data.id,
    comboName: data.name,
    comboSlug: data.slug,
    body,
    coverUrl: data.image_url,
    products: products.map(({ name, image_url, quantity }) => ({
      name,
      image_url,
      quantity,
    })),
    price: Number(data.price),
    compareAtPrice: Number(data.compare_at_price),
    sendEmail,
    sendDiscord,
    createdBy: user.id,
  });

  revalidatePath("/admin/combos");
  redirect(
    `/admin/combos?message=${encodeURIComponent(`Divulgação concluída: ${promotionSummary(result)}`)}`,
  );
}

export async function toggleCombo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("combo_id") ?? "");
  const activeText = String(formData.get("active") ?? "");
  if (!["true", "false"].includes(activeText))
    throw new Error("Visibilidade inválida.");
  const active = activeText === "true";
  if (!uuidRegex.test(id)) throw new Error("Combo inválido.");
  const admin = createAdminClient();
  const { data: combo } = await admin
    .from("combos")
    .select(
      "id,name,slug,description,price,image_url,ends_at,combo_items(product_id,quantity)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!combo) throw new Error("Combo não encontrado.");
  const user = await requireAdmin();
  const { error } = await admin.rpc("save_store_combo", {
    p_admin_id: user.id,
    p_combo_id: id,
    p_name: combo.name,
    p_slug: combo.slug,
    p_description: combo.description || "",
    p_price: combo.price,
    p_image_url: combo.image_url || "",
    p_active: active,
    p_ends_at: combo.ends_at,
    p_items: (combo.combo_items ?? []).map((item) => ({
      id: item.product_id,
      quantity: item.quantity,
    })),
  });
  if (error)
    throw new Error(
      error.code === "P0001"
        ? error.message
        : "Não foi possível atualizar o combo.",
    );
  revalidatePath("/", "layout");
}
