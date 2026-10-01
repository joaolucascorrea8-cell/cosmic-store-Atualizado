"use server";

import { readProductForm } from "@/lib/product-form";
import { parsePrice, UUID_PATTERN } from "@/lib/catalog";
import { removeUnusedProductImage } from "@/lib/product-image-cleanup";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeInternalPath } from "@/lib/safe-redirect";
import {
  getManagedProductImagePath,
  isAllowedProductImageUrl,
} from "@/lib/product-images";

export type UpdateProductState = {
  error: string | null;
  success: string | null;
};

function safeProductReturnPath(value: FormDataEntryValue | null) {
  const fallback = "/admin/produtos?catalogo=1#catalogo-produtos";
  const safe = safeInternalPath(
    typeof value === "string" ? value : null,
    fallback,
  );
  return safe === "/admin/produtos" ||
    safe.startsWith("/admin/produtos?") ||
    safe.startsWith("/admin/produtos#")
    ? safe
    : fallback;
}

function productReturnWithSuccess(
  path: string,
  success = "produto-atualizado",
) {
  const parsed = new URL(path, "https://cosmic.local");
  parsed.searchParams.set("sucesso", success);
  const query = parsed.searchParams.toString();
  return `${parsed.pathname}${query ? `?${query}` : ""}${parsed.hash || "#catalogo-produtos"}`;
}

export async function createGame(formData: FormData) {
  // Verificar a autorização antes de usar a chave administrativa.
  await requireAdmin();

  const name = formData.get("name");
  const slug = formData.get("slug");

  if (typeof name !== "string" || typeof slug !== "string") {
    throw new Error("Dados inválidos.");
  }

  const cleanName = name.trim();
  const cleanSlug = slug.trim().toLowerCase();
  const imageUrl = String(formData.get("image_url") ?? "").trim();

  if (
    cleanName.length < 2 ||
    cleanName.length > 100 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug) ||
    cleanSlug.length > 100
  ) {
    throw new Error("Nome ou identificador inválido.");
  }

  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) {
    throw new Error("Envie uma imagem válida para o jogo.");
  }

  const supabase = createAdminClient();
  const { data: lastGame, error: orderError } = await supabase
    .from("games")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    console.error("Erro ao consultar ordem dos jogos:", orderError.code);
    throw new Error("Não foi possível preparar a ordem do jogo.");
  }

  const nextDisplayOrder =
    Math.max(0, Number(lastGame?.display_order ?? 0)) + 10;

  const { error } = await supabase.from("games").insert({
    name: cleanName,
    slug: cleanSlug,
    image_url: imageUrl || null,
    display_order: nextDisplayOrder,
  });

  if (error) {
    console.error("Erro ao cadastrar jogo:", error.code);
    throw new Error("Não foi possível cadastrar o jogo.");
  }

  revalidatePath("/admin");
  revalidatePath("/jogos");
  redirect("/admin/catalogo?created=game");
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const gameId = String(formData.get("game_id") ?? "").trim();
  const name = String(formData.get("category_name") ?? "").trim();
  const slug = String(formData.get("category_slug") ?? "")
    .trim()
    .toLowerCase();
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  if (
    !UUID_PATTERN.test(gameId) ||
    name.length < 2 ||
    name.length > 100 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    throw new Error("Dados da categoria inválidos.");
  }
  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) {
    throw new Error("Envie uma imagem válida para a categoria.");
  }
  const supabase = createAdminClient();
  const { data: lastCategory, error: orderError } = await supabase
    .from("categories")
    .select("display_order")
    .eq("game_id", gameId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    console.error("Erro ao consultar ordem das categorias:", orderError.code);
    throw new Error("Não foi possível preparar a ordem da categoria.");
  }

  const nextDisplayOrder =
    Math.max(0, Number(lastCategory?.display_order ?? 0)) + 10;
  const { error } = await supabase.from("categories").insert({
    game_id: gameId,
    name,
    slug,
    image_url: imageUrl || null,
    display_order: nextDisplayOrder,
  });
  if (error) {
    console.error("Erro ao cadastrar categoria:", error.code);
    throw new Error("Não foi possível cadastrar a categoria.");
  }
  revalidatePath("/admin");
  revalidatePath("/jogos");
  redirect("/admin/catalogo?created=category");
}

async function replaceCatalogImage(
  table: "games" | "categories",
  id: string,
  imageUrl: string,
) {
  const supabase = createAdminClient();
  const { data: current, error: lookupError } = await supabase
    .from(table)
    .select("id,image_url")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !current) {
    throw new Error("Não foi possível localizar o item do catálogo.");
  }

  const { error: updateError } = await supabase
    .from(table)
    .update({ image_url: imageUrl || null })
    .eq("id", id);

  if (updateError) {
    throw new Error("Não foi possível atualizar a imagem.");
  }

  if (current.image_url !== (imageUrl || null)) {
    await removeUnusedProductImage(current.image_url);
  }
}

export async function updateGameImage(formData: FormData) {
  await requireAdmin();
  const gameId = String(formData.get("game_id") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();

  if (!UUID_PATTERN.test(gameId)) throw new Error("Jogo inválido.");
  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) {
    throw new Error("Envie uma imagem válida para o jogo.");
  }

  await replaceCatalogImage("games", gameId, imageUrl);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/jogos");
  redirect("/admin/catalogo?updated=game-image");
}

export async function updateCategoryImage(formData: FormData) {
  await requireAdmin();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();

  if (!UUID_PATTERN.test(categoryId)) throw new Error("Categoria inválida.");
  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) {
    throw new Error("Envie uma imagem válida para a categoria.");
  }

  const supabase = createAdminClient();
  const { data: category } = await supabase
    .from("categories")
    .select("game_id")
    .eq("id", categoryId)
    .single();
  await replaceCatalogImage("categories", categoryId, imageUrl);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/jogos");
  if (category?.game_id) {
    const { data: game } = await supabase
      .from("games")
      .select("slug")
      .eq("id", category.game_id)
      .single();
    if (game?.slug) revalidatePath(`/${game.slug}`);
  }
  redirect("/admin/catalogo?updated=category-image");
}

export async function updateProductQuick(input: {
  productId: string;
  stock: number;
  unlimitedStock: boolean;
  isActive: boolean;
  price?: string | number;
}) {
  await requireAdmin();

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const productId = String(input?.productId ?? "").trim();
  const stock = Number(input?.stock ?? 0);

  if (!uuidRegex.test(productId)) return { error: "Produto inválido." };
  if (
    !input.unlimitedStock &&
    (!Number.isSafeInteger(stock) || stock < 0 || stock > 2147483647)
  ) {
    return { error: "Informe um estoque válido." };
  }

  const price = input.price === undefined ? undefined : parsePrice(input.price);
  if (price === null) return { error: "Informe um preço válido." };
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("products")
    .update({
      ...(price === undefined ? {} : { price }),
      stock,
      unlimited_stock: Boolean(input.unlimitedStock),
      is_active: Boolean(input.isActive),
    })
    .eq("id", productId)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    console.error("Erro ao atualizar produto rapidamente:", error?.code);
    return { error: "Não foi possível salvar estoque/status agora." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/produtos");
  revalidatePath("/");
  revalidatePath("/produtos");
  return { error: null };
}

export async function saveProductOrder(productIds: string[]) {
  await requireAdmin();

  if (!Array.isArray(productIds) || productIds.length > 1000) {
    return { error: "Ordem de produtos inválida." };
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ids = productIds.map((id) => String(id).trim());

  if (
    ids.some((id) => !uuidRegex.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    return {
      error: "A lista de produtos contém itens inválidos ou repetidos.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_product_display_order", {
    product_ids: ids,
  });

  if (error) {
    console.error("Erro ao salvar ordem dos produtos:", error.code);
    return {
      error:
        "Não foi possível salvar a ordem. Se outro produto foi cadastrado agora, atualize a página e tente novamente.",
    };
  }

  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath("/admin/produtos");

  return { error: null };
}

export async function saveGameOrder(gameIds: string[]) {
  await requireAdmin();

  if (!Array.isArray(gameIds) || gameIds.length > 500) {
    return { error: "Ordem de jogos inválida." };
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ids = gameIds.map((id) => String(id).trim());

  if (
    ids.some((id) => !uuidRegex.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    return { error: "A lista de jogos contém itens inválidos ou repetidos." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_game_display_order", {
    game_ids: ids,
  });

  if (error) {
    console.error("Erro ao salvar ordem dos jogos:", error.code);
    return {
      error:
        "Não foi possível salvar a ordem dos jogos. Atualize a página e tente novamente.",
    };
  }

  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/produtos");
  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/combos");

  return { error: null };
}

export async function saveCategoryOrder(gameId: string, categoryIds: string[]) {
  await requireAdmin();

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const cleanGameId = String(gameId).trim();
  const ids = Array.isArray(categoryIds)
    ? categoryIds.map((id) => String(id).trim())
    : [];

  if (
    !uuidRegex.test(cleanGameId) ||
    ids.length > 1000 ||
    ids.some((id) => !uuidRegex.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    return { error: "Ordem de categorias inválida." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_category_display_order", {
    target_game_id: cleanGameId,
    category_ids: ids,
  });

  if (error) {
    console.error("Erro ao salvar ordem das categorias:", error.code);
    return {
      error:
        "Não foi possível salvar a ordem das categorias. Atualize a página e tente novamente.",
    };
  }

  const { data: game } = await admin
    .from("games")
    .select("slug")
    .eq("id", cleanGameId)
    .maybeSingle();

  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/produtos");
  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/combos");
  if (game?.slug) revalidatePath(`/${game.slug}`);

  return { error: null };
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();

  const productId = String(formData.get("product_id") ?? "").trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      productId,
    )
  ) {
    throw new Error("Identificador do produto inválido.");
  }

  const admin = createAdminClient();

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, name, is_active, image_url")
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    console.error("Erro ao verificar produto:", productError.code);

    throw new Error("Não foi possível verificar o produto. Tente novamente.");
  }

  if (!product) {
    throw new Error("O produto selecionado não existe.");
  }

  if (product.is_active) {
    throw new Error("Desative o produto antes de excluí-lo.");
  }

  // A exclusão continua bloqueada.
  const { data: deletedProducts, error: deleteError } = await admin
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("is_active", false)
    .select("id");

  if (deleteError) {
    console.error("Erro ao excluir produto:", deleteError.code);

    throw new Error(
      deleteError.code === "P0001"
        ? deleteError.message
        : deleteError.code === "23503"
          ? "Este produto faz parte de um combo. Remova-o do combo antes de excluir."
          : "Não foi possível excluir o produto. Tente novamente.",
    );
  }

  if (deletedProducts?.length !== 1) {
    throw new Error(
      "O produto não foi excluído. Atualize a página e tente novamente.",
    );
  }

  await removeUnusedProductImage(product.image_url);

  revalidatePath("/admin/produtos");
  revalidatePath("/");
  revalidatePath("/produtos");

  redirect(
    productReturnWithSuccess(
      safeProductReturnPath(formData.get("return_to")),
      "produto-excluido",
    ),
  );
}

// Edição e exclusão segura do catálogo: evita cascatas que apagariam produtos.
export async function updateGameDetails(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("game_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const visibility = String(formData.get("is_active") ?? "");
  if (!["true", "false"].includes(visibility))
    throw new Error("Selecione uma visibilidade válida.");
  const isActive = visibility === "true";
  if (
    !UUID_PATTERN.test(id) ||
    name.length < 2 ||
    name.length > 100 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 100
  )
    throw new Error("Dados do jogo inválidos.");
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("games")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (!before) throw new Error("Jogo não encontrado.");
  const { error } = await admin
    .from("games")
    .update({ name, slug, is_active: isActive })
    .eq("id", id);
  if (error)
    throw new Error(
      error.code === "23505"
        ? "O identificador já está sendo usado."
        : "Não foi possível editar o jogo.",
    );
  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath(`/` + before.slug);
  revalidatePath(`/${slug}`);
  revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo?updated=game");
}

export async function updateCategoryDetails(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("category_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  if (
    !UUID_PATTERN.test(id) ||
    name.length < 2 ||
    name.length > 100 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 100
  )
    throw new Error("Dados da categoria inválidos.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("categories")
    .update({ name, slug })
    .eq("id", id);
  if (error)
    throw new Error(
      error.code === "23505"
        ? "O identificador já está sendo usado."
        : "Não foi possível editar a categoria.",
    );
  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo?updated=category");
}

export async function deleteEmptyGame(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("game_id") ?? "");
  if (!UUID_PATTERN.test(id)) throw new Error("Jogo inválido.");
  const admin = createAdminClient();
  const { count, error: checkError } = await admin
    .from("categories")
    .select("id", { head: true, count: "exact" })
    .eq("game_id", id);
  if (checkError || count === null)
    throw new Error("Não foi possível conferir as categorias.");
  if (count > 0)
    throw new Error(
      "Exclua ou transfira as categorias antes de remover o jogo.",
    );
  const { data, error } = await admin
    .from("games")
    .delete()
    .eq("id", id)
    .select("image_url")
    .maybeSingle();
  if (error) throw new Error("Não foi possível remover o jogo.");
  const path = getManagedProductImagePath(data?.image_url ?? null);
  if (path) await removeUnusedProductImage(data?.image_url);
  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo?updated=game-deleted");
}

export async function deleteEmptyCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("category_id") ?? "");
  if (!UUID_PATTERN.test(id)) throw new Error("Categoria inválida.");
  const admin = createAdminClient();
  const { count, error: checkError } = await admin
    .from("products")
    .select("id", { head: true, count: "exact" })
    .eq("category_id", id);
  if (checkError || count === null)
    throw new Error("Não foi possível conferir os produtos.");
  if (count > 0)
    throw new Error(
      "Esta categoria ainda tem produtos. Remova os produtos primeiro.",
    );
  const { data, error } = await admin
    .from("categories")
    .delete()
    .eq("id", id)
    .select("image_url")
    .maybeSingle();
  if (error) throw new Error("Não foi possível remover a categoria.");
  const path = getManagedProductImagePath(data?.image_url ?? null);
  if (path) await removeUnusedProductImage(data?.image_url);
  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo?updated=category-deleted");
}

export type ProductEditorState = {
  error: string | null;
  success: string | null;
  id?: string;
};
export async function saveProduct(
  _previous: ProductEditorState,
  form: FormData,
): Promise<ProductEditorState> {
  await requireAdmin();
  const parsed = readProductForm(form);
  if (parsed.error) return { error: parsed.error, success: null };
  const values = parsed.values!;
  if (!isAllowedProductImageUrl(values.image_url ?? ""))
    return {
      error: "Envie uma imagem válida pelo campo de imagem.",
      success: null,
    };
  const id = String(form.get("product_id") ?? "");
  if (id && !UUID_PATTERN.test(id))
    return { error: "Produto inválido.", success: null };
  const admin = createAdminClient();
  const { data: category, error: categoryError } = await admin
    .from("categories")
    .select("id,slug")
    .eq("id", values.category_id)
    .maybeSingle();
  if (categoryError || !category)
    return {
      error: "A categoria não está disponível. Atualize a página.",
      success: null,
    };
  let old: { image_url: string | null; slug: string } | null = null;
  if (id) {
    const { data, error } = await admin
      .from("products")
      .select("image_url,slug")
      .eq("id", id)
      .maybeSingle();
    if (error || !data)
      return { error: "Produto não encontrado.", success: null };
    old = data;
  }
  let savedId = id;
  if (id) {
    const { data, error } = await admin
      .from("products")
      .update(values)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error || !data)
      return {
        error:
          error?.code === "23505"
            ? "Este identificador já está em uso por outro produto. Escolha um identificador único."
            : "Não foi possível atualizar o produto.",
        success: null,
      };
  } else {
    const { data: last, error: positionError } = await admin
      .from("products")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (positionError)
      return {
        error: "Não foi possível preparar a ordem do produto.",
        success: null,
      };
    const baseSlug = values.slug;
    let created = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const slug =
        attempt === 0
          ? baseSlug
          : attempt === 1
            ? `${baseSlug.slice(0, 70)}-${category.slug}`.slice(0, 100)
            : `${baseSlug.slice(0, 90)}-${attempt + 1}`;
      const { data, error } = await admin
        .from("products")
        .insert({
          ...values,
          slug,
          display_order: Number(last?.display_order ?? 0) + 10,
        })
        .select("id")
        .single();
      if (!error && data) {
        savedId = data.id;
        created = true;
        break;
      }
      if (error?.code !== "23505" || form.get("auto_slug") !== "true")
        return {
          error:
            error?.code === "23505"
              ? "Este identificador já está em uso. Altere-o em Opções avançadas."
              : "Não foi possível cadastrar o produto.",
          success: null,
        };
    }
    if (!created)
      return {
        error: "Não foi possível gerar um identificador único.",
        success: null,
      };
  }
  if (old?.image_url !== values.image_url)
    await removeUnusedProductImage(old?.image_url);
  revalidatePath("/", "layout");
  const saveAction = String(form.get("save_action") ?? "stay");
  if (saveAction === "back")
    redirect(
      productReturnWithSuccess(
        safeProductReturnPath(form.get("return_to")),
        id ? "produto-atualizado" : "produto-cadastrado",
      ),
    );
  return {
    error: null,
    success: id ? "Produto atualizado." : "Produto cadastrado.",
    id: savedId,
  };
}
export async function createProduct(form: FormData) {
  const state = await saveProduct({ error: null, success: null }, form);
  if (state.error) throw new Error(state.error);
  redirect("/admin/produtos?sucesso=produto-cadastrado");
}
export async function updateProduct(
  previous: UpdateProductState,
  form: FormData,
): Promise<UpdateProductState> {
  return saveProduct(previous, form);
}
export async function bulkUpdateProducts(
  ids: string[],
  action: string,
  value?: string,
) {
  await requireAdmin();
  if (!Array.isArray(ids) || ids.some((id) => !UUID_PATTERN.test(id)))
    return { error: "Selecione produtos válidos." };
  const number =
    action === "stock"
      ? Number(value)
      : action === "price_percent"
        ? Number(String(value).replace(",", "."))
        : null;
  const { error } = await createAdminClient().rpc(
    "bulk_update_store_products",
    { p_ids: ids, p_action: action, p_value: number },
  );
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "Não foi possível aplicar a alteração. Confira a atualização SQL.",
    };
  revalidatePath("/", "layout");
  return { error: null };
}
export async function setFeaturedProduct(id: string | null) {
  await requireAdmin();
  if (id && !UUID_PATTERN.test(id)) return { error: "Produto inválido." };
  const { error } = await createAdminClient()
    .from("store_settings")
    .upsert({ id: true, featured_product_id: id });
  if (error)
    return {
      error:
        "Não foi possível atualizar o destaque. Confira a atualização SQL.",
    };
  revalidatePath("/", "layout");
  return { error: null };
}
