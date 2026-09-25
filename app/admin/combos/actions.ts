"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedProductImageUrl } from "@/lib/product-images";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createCombo(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  const priceText = String(formData.get("price") ?? "").trim();
  const price = Number(priceText);
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const endsAtRaw = String(formData.get("ends_at") ?? "").trim();
  const isActive = formData.getAll("is_active").map(String).includes("true");

  if (name.length < 2 || name.length > 120) throw new Error("O nome do combo deve ter entre 2 e 120 caracteres.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) throw new Error("Use um identificador válido para o combo.");
  if (description.length > 3000) throw new Error("A descrição do combo deve ter no máximo 3000 caracteres.");
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(price) || price <= 0) throw new Error("Informe um preço válido para o combo.");
  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) throw new Error("Envie uma imagem válida para o combo.");

  const productIds = formData.getAll("product_ids").map(String).filter(id => uuidRegex.test(id));
  if (!productIds.length) throw new Error("Selecione pelo menos um produto para o combo.");
  if (new Set(productIds).size !== productIds.length) throw new Error("Há produtos duplicados no combo.");

  const quantities = new Map<string, number>();
  for (const id of productIds) {
    const raw = String(formData.get(`qty_${id}`) ?? "1");
    const quantity = Number(raw);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Uma das quantidades do combo é inválida.");
    quantities.set(id, quantity);
  }

  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) throw new Error("Data inicial inválida.");
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error("Data final inválida.");
  if (startsAt && endsAt && endsAt <= startsAt) throw new Error("A data final precisa ser posterior à inicial.");

  const admin = createAdminClient();
  const { data: products, error: productError } = await admin.from("products").select("id,name,price,is_active").in("id", productIds);
  if (productError || !products || products.length !== productIds.length) throw new Error("Não foi possível validar todos os produtos selecionados.");

  if (isActive && products.some(product => !product.is_active)) throw new Error("Desative o combo ou escolha apenas produtos ativos.");

  const compareAtPrice = Math.round(products.reduce((sum, product) => sum + Number(product.price) * (quantities.get(product.id) ?? 1), 0) * 100) / 100;
  if (price > compareAtPrice) throw new Error("O preço do combo não pode ser maior que a soma dos produtos separadamente.");

  const { data: combo, error: comboError } = await admin.from("combos").insert({
    name,
    slug,
    description: description || null,
    price,
    compare_at_price: compareAtPrice,
    image_url: imageUrl || null,
    is_active: isActive,
    starts_at: startsAt?.toISOString() ?? null,
    ends_at: endsAt?.toISOString() ?? null,
    created_by: user.id,
  }).select("id").single();

  if (comboError || !combo) {
    if (comboError?.code === "23505") throw new Error("Já existe um combo usando esse identificador.");
    throw new Error("Não foi possível criar o combo.");
  }

  const { error: itemError } = await admin.from("combo_items").insert(productIds.map(productId => ({
    combo_id: combo.id,
    product_id: productId,
    quantity: quantities.get(productId) ?? 1,
  })));

  if (itemError) {
    await admin.from("combos").delete().eq("id", combo.id);
    throw new Error("Não foi possível salvar os produtos do combo.");
  }

  revalidatePath("/combos");
  revalidatePath("/admin/combos");
  redirect(`/admin/combos?created=${combo.id}`);
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
