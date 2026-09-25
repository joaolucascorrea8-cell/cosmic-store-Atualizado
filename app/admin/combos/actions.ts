"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedProductImageUrl } from "@/lib/product-images";
import { buildComboPromotionBody, sendComboPromotion, type ComboPromotionProduct } from "@/lib/combo-promotions";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "combo";
}

async function uniqueSlug(base: string) {
  const admin = createAdminClient();
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const { data } = await admin.from("combos").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function promotionSummary(result: Awaited<ReturnType<typeof sendComboPromotion>>) {
  const parts: string[] = [];
  if (result.emailSent || result.emailFailed) parts.push(`${result.emailSent} e-mail(s) enviado(s)${result.emailFailed ? ` · ${result.emailFailed} falha(s)` : ""}`);
  if (result.discordStatus) parts.push(result.discordStatus === "sent" ? "Discord publicado" : "Discord falhou");
  return parts.join(" · ") || "Combo criado sem divulgação.";
}

export async function createCombo(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  const priceText = String(formData.get("price") ?? "").trim();
  const price = Number(priceText);
  const endsAtRaw = String(formData.get("ends_at") ?? "").trim();
  const isActive = formData.get("is_active") === "on";
  const sendEmail = formData.get("send_email") === "on";
  const sendDiscord = formData.get("send_discord") === "on";
  const customPromotionBody = String(formData.get("promotion_body") ?? "").trim();

  if (name.length < 2 || name.length > 120) throw new Error("O nome do combo deve ter entre 2 e 120 caracteres.");
  if (description.length > 3000) throw new Error("A descrição do combo deve ter no máximo 3000 caracteres.");
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(price) || price <= 0) throw new Error("Informe um preço válido para o combo.");
  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) throw new Error("Envie uma imagem válida para o combo.");

  const productIds = formData.getAll("product_ids").map(String).filter((id) => uuidRegex.test(id));
  if (!productIds.length) throw new Error("Selecione pelo menos um produto para o combo.");
  if (new Set(productIds).size !== productIds.length) throw new Error("Há produtos duplicados no combo.");

  const quantities = new Map<string, number>();
  for (const id of productIds) {
    const raw = String(formData.get(`qty_${id}`) ?? "1");
    const quantity = Number(raw);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Uma das quantidades do combo é inválida.");
    quantities.set(id, quantity);
  }

  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error("Data final inválida.");
  if (endsAt && endsAt.getTime() <= Date.now()) throw new Error("A data final precisa estar no futuro.");
  if ((sendEmail || sendDiscord) && !isActive) throw new Error("Para divulgar ao criar, deixe o combo publicado imediatamente.");

  const admin = createAdminClient();
  const { data: products, error: productError } = await admin
    .from("products")
    .select("id,name,price,image_url,is_active")
    .in("id", productIds);

  if (productError || !products || products.length !== productIds.length) throw new Error("Não foi possível validar todos os produtos selecionados.");
  if (isActive && products.some((product) => !product.is_active)) throw new Error("Desative o combo ou escolha apenas produtos ativos.");

  const compareAtPrice = Math.round(products.reduce((sum, product) => sum + Number(product.price) * (quantities.get(product.id) ?? 1), 0) * 100) / 100;
  if (price > compareAtPrice) throw new Error("O preço do combo não pode ser maior que a soma dos produtos separadamente.");

  const slug = await uniqueSlug(slugify(name));
  const { data: combo, error: comboError } = await admin.from("combos").insert({
    name,
    slug,
    description: description || null,
    price,
    compare_at_price: compareAtPrice,
    image_url: imageUrl || null,
    is_active: isActive,
    starts_at: null,
    ends_at: endsAt?.toISOString() ?? null,
    created_by: user.id,
  }).select("id").single();

  if (comboError || !combo) throw new Error("Não foi possível criar o combo.");

  const { error: itemError } = await admin.from("combo_items").insert(productIds.map((productId) => ({
    combo_id: combo.id,
    product_id: productId,
    quantity: quantities.get(productId) ?? 1,
  })));

  if (itemError) {
    await admin.from("combos").delete().eq("id", combo.id);
    throw new Error("Não foi possível salvar os produtos do combo.");
  }

  let promotion = "Combo criado sem divulgação.";
  if (sendEmail || sendDiscord) {
    const promotionProducts: ComboPromotionProduct[] = products.map((product) => ({
      name: product.name,
      image_url: product.image_url,
      quantity: quantities.get(product.id) ?? 1,
    }));
    const body = customPromotionBody || buildComboPromotionBody({ comboName: name, products: promotionProducts, price, compareAtPrice });
    try {
      const result = await sendComboPromotion({
        comboId: combo.id,
        comboName: name,
        comboSlug: slug,
        body,
        coverUrl: imageUrl || null,
        products: promotionProducts,
        price,
        compareAtPrice,
        sendEmail,
        sendDiscord,
        createdBy: user.id,
      });
      promotion = promotionSummary(result);
    } catch (error) {
      promotion = `Combo criado, mas a divulgação falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`;
    }
  }

  revalidatePath("/combos");
  revalidatePath("/admin/combos");
  redirect(`/admin/combos?created=${combo.id}&message=${encodeURIComponent(promotion)}`);
}

export async function promoteCombo(formData: FormData) {
  const user = await requireAdmin();
  const comboId = String(formData.get("combo_id") ?? "");
  const sendEmail = formData.get("send_email") === "on";
  const sendDiscord = formData.get("send_discord") === "on";
  const body = String(formData.get("promotion_body") ?? "").trim();

  if (!uuidRegex.test(comboId)) throw new Error("Combo inválido.");
  if (!sendEmail && !sendDiscord) throw new Error("Marque E-mail, Discord ou os dois.");
  if (body.length < 2 || body.length > 3000) throw new Error("O texto da divulgação deve ter entre 2 e 3000 caracteres.");

  const admin = createAdminClient();
  const { data, error } = await admin.from("combos")
    .select("id,name,slug,price,compare_at_price,image_url,is_active,starts_at,ends_at,combo_items(quantity,products(name,image_url,is_active))")
    .eq("id", comboId)
    .maybeSingle();

  if (error || !data) throw new Error("Combo não encontrado.");
  const now = Date.now();
  if (!data.is_active || (data.starts_at && new Date(data.starts_at).getTime() > now) || (data.ends_at && new Date(data.ends_at).getTime() <= now)) {
    throw new Error("Ative o combo e confira a validade antes de divulgar.");
  }

  const products = (data.combo_items ?? []).map((item: any) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    return product ? {
      name: String(product.name),
      image_url: product.image_url ? String(product.image_url) : null,
      is_active: Boolean(product.is_active),
      quantity: Number(item.quantity),
    } : null;
  }).filter(Boolean) as Array<ComboPromotionProduct & { is_active: boolean }>;

  if (products.some((product) => !product.is_active)) throw new Error("Um produto deste combo está inativo.");

  const result = await sendComboPromotion({
    comboId: data.id,
    comboName: data.name,
    comboSlug: data.slug,
    body,
    coverUrl: data.image_url,
    products: products.map(({ name, image_url, quantity }) => ({ name, image_url, quantity })),
    price: Number(data.price),
    compareAtPrice: Number(data.compare_at_price),
    sendEmail,
    sendDiscord,
    createdBy: user.id,
  });

  revalidatePath("/admin/combos");
  redirect(`/admin/combos?message=${encodeURIComponent(`Divulgação concluída: ${promotionSummary(result)}`)}`);
}

export async function toggleCombo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("combo_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!uuidRegex.test(id)) throw new Error("Combo inválido.");
  const { error } = await createAdminClient().from("combos").update({ is_active: active }).eq("id", id);
  if (error) throw new Error("Não foi possível atualizar o combo.");
  revalidatePath("/combos");
  revalidatePath("/admin/combos");
}
