"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getManagedProductImagePath,
  isAllowedProductImageUrl,
  PRODUCT_IMAGE_BUCKET,
} from "@/lib/product-images";

export type UpdateProductState = {
  error: string | null;
};

export async function createGame(formData: FormData) {
  // Verificar a autorização antes de usar a chave administrativa.
  await requireAdmin();

  const name = formData.get("name");
  const slug = formData.get("slug");

  if (
    typeof name !== "string" ||
    typeof slug !== "string"
  ) {
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

  const { error } = await supabase.from("games").insert({
    name: cleanName,
    slug: cleanSlug,
    image_url: imageUrl || null,
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
  const slug = String(formData.get("category_slug") ?? "").trim().toLowerCase();
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(gameId) || name.length < 2 || name.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Dados da categoria inválidos.");
  }
  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) {
    throw new Error("Envie uma imagem válida para a categoria.");
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("categories").insert({ game_id: gameId, name, slug, image_url: imageUrl || null });
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
  imageUrl: string
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
    const oldPath = getManagedProductImagePath(current.image_url);
    if (oldPath) {
      const { error: removeError } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .remove([oldPath]);
      if (removeError) {
        console.error("Erro ao remover capa antiga:", removeError.message);
      }
    }
  }
}

export async function updateGameImage(formData: FormData) {
  await requireAdmin();
  const gameId = String(formData.get("game_id") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(gameId)) throw new Error("Jogo inválido.");
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

  if (!/^[0-9a-f-]{36}$/i.test(categoryId)) throw new Error("Categoria inválida.");
  if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) {
    throw new Error("Envie uma imagem válida para a categoria.");
  }

  const supabase = createAdminClient();
  const { data: category } = await supabase.from("categories").select("game_id").eq("id", categoryId).single();
  await replaceCatalogImage("categories", categoryId, imageUrl);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/jogos");
  if (category?.game_id) {
    const { data: game } = await supabase.from("games").select("slug").eq("id", category.game_id).single();
    if (game?.slug) revalidatePath(`/${game.slug}`);
  }
  redirect("/admin/catalogo?updated=category-image");
}

export async function saveProductOrder(productIds: string[]) {
  await requireAdmin();

  if (!Array.isArray(productIds) || productIds.length > 1000) {
    return { error: "Ordem de produtos inválida." };
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ids = productIds.map((id) => String(id).trim());

  if (ids.some((id) => !uuidRegex.test(id)) || new Set(ids).size !== ids.length) {
    return { error: "A lista de produtos contém itens inválidos ou repetidos." };
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

export async function createProduct(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2 || name.length > 100) {
    throw new Error(
      "O nome do produto deve ter entre 2 e 100 caracteres."
    );
  }
const slug = String(formData.get("slug") ?? "").trim();

if (
  slug.length < 2 ||
  slug.length > 100 ||
  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
) {
  throw new Error(
    "O identificador deve ter entre 2 e 100 caracteres e conter apenas letras minúsculas, números e hífens."
  );
}
const categoryId = String(formData.get("category_id") ?? "").trim();

if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    categoryId
  )
) {
  throw new Error("Selecione uma categoria válida.");
}

const priceText = String(formData.get("price") ?? "").trim();

const price = Number(priceText);

if (
  priceText === "" ||
  !/^\d+(?:\.\d{1,2})?$/.test(priceText) ||
  !Number.isFinite(price) ||
  price < 0 ||
  price > 9999999999.99
) {
  throw new Error(
    "Informe um preço válido, com até duas casas decimais."
  );
}

const unlimitedStockText = String(
  formData.get("unlimited_stock") ?? ""
);

if (
  unlimitedStockText !== "true" &&
  unlimitedStockText !== "false"
) {
  throw new Error("Selecione um tipo de estoque válido.");
}

const unlimitedStock = unlimitedStockText === "true";

const stockText = String(formData.get("stock") ?? "").trim();

let stock = 0;

if (!unlimitedStock) {
  stock = Number(stockText);

  if (
    stockText === "" ||
    !/^\d+$/.test(stockText) ||
    !Number.isSafeInteger(stock) ||
    stock < 0 ||
    stock > 2147483647
  ) {
    throw new Error(
      "Informe uma quantidade válida de unidades em estoque."
    );
  }
}

const description = String(
  formData.get("description") ?? ""
).trim();

if (description.length > 2000) {
  throw new Error(
    "A descrição deve ter no máximo 2000 caracteres."
  );
}

const imageUrl = String(
  formData.get("image_url") ?? ""
).trim();

if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) {
  throw new Error(
    "Envie uma imagem válida usando o campo de imagem."
  );
}

const isActiveText = String(
  formData.get("is_active") ?? ""
);

if (isActiveText !== "true" && isActiveText !== "false") {
  throw new Error("Selecione um status válido para o produto.");
}

const isActive = isActiveText === "true";

const admin = createAdminClient();

const { data: category, error: categoryError } = await admin
  .from("categories")
  .select("id")
  .eq("id", categoryId)
  .maybeSingle();

if (categoryError) {
  console.error(
    "Erro ao verificar categoria:",
    categoryError.code
  );

  throw new Error(
    "Não foi possível verificar a categoria. Tente novamente."
  );
}

if (!category) {
  throw new Error("A categoria selecionada não existe.");
}

const { data: lastProduct, error: orderError } = await admin
  .from("products")
  .select("display_order")
  .order("display_order", { ascending: false })
  .limit(1)
  .maybeSingle();

if (orderError) {
  console.error("Erro ao calcular ordem do produto:", orderError.code);
  throw new Error(
    "Não foi possível definir a posição do produto. Confira se a migration de ordenação foi executada."
  );
}

const nextDisplayOrder = Math.max(0, Number(lastProduct?.display_order ?? 0)) + 10;

const productData = {
  category_id: categoryId,
  name,
  slug,
  description: description || null,
  price,
  stock,
  unlimited_stock: unlimitedStock,
  image_url: imageUrl || null,
  is_active: isActive,
  display_order: nextDisplayOrder,
};

  // O cadastro permanece bloqueado até concluirmos as validações.
  const { error: insertError } = await admin
  .from("products")
  .insert(productData);

if (insertError) {
  console.error(
    "Erro ao cadastrar produto:",
    insertError.code
  );

  throw new Error(
    "Não foi possível cadastrar o produto. Verifique os dados e tente novamente."
  );
}



revalidatePath("/admin/produtos");
revalidatePath("/");
revalidatePath("/produtos");

redirect("/admin/produtos?sucesso=produto-cadastrado");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();

  const productId = String(
    formData.get("product_id") ?? ""
  ).trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      productId
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
  console.error(
    "Erro ao verificar produto:",
    productError.code
  );

  throw new Error(
    "Não foi possível verificar o produto. Tente novamente."
  );
}

if (!product) {
  throw new Error("O produto selecionado não existe.");
}

if (product.is_active) {
  throw new Error(
    "Desative o produto antes de excluí-lo."
  );
}

  // A exclusão continua bloqueada.
  const { data: deletedProducts, error: deleteError } = await admin
  .from("products")
  .delete()
  .eq("id", productId)
  .eq("is_active", false)
  .select("id");

if (deleteError) {
  console.error(
    "Erro ao excluir produto:",
    deleteError.code
  );

  throw new Error(
    "Não foi possível excluir o produto. Tente novamente."
  );
}

if (deletedProducts?.length !== 1) {
  throw new Error(
    "O produto não foi excluído. Atualize a página e tente novamente."
  );
}

const deletedImagePath = getManagedProductImagePath(product.image_url);

if (deletedImagePath) {
  const { error: imageDeleteError } = await admin.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([deletedImagePath]);

  if (imageDeleteError) {
    console.error("Erro ao remover imagem antiga:", imageDeleteError.message);
  }
}

revalidatePath("/admin/produtos");
revalidatePath("/");
revalidatePath("/produtos");

redirect("/admin/produtos?sucesso=produto-excluido");
}

export async function updateProduct(
  _previousState: UpdateProductState,
  formData: FormData
): Promise<UpdateProductState> {
  await requireAdmin();

  const productId = String(formData.get("product_id") ?? "").trim();

  if (!productId) {
  return {
    error: "ID do produto não informado.",
  };
}
  const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!uuidRegex.test(productId)) {
  return {
    error: "ID do produto inválido.",
  };
}

const supabase = createAdminClient();

const { data: existingProduct, error: lookupError } = await supabase
  .from("products")
  .select("id, image_url")
  .eq("id", productId)
  .maybeSingle();

if (lookupError) {
  console.error("Erro ao consultar produto:", lookupError.code);

  return {
    error: "Não foi possível consultar o produto. Tente novamente.",
  };
}

if (!existingProduct) {
  return {
    error: "Produto não encontrado.",
  };
}

const name = String(formData.get("name") ?? "").trim();

if (name.length < 2 || name.length > 100) {
  return {
    error: "O nome do produto deve ter entre 2 e 100 caracteres.",
  };
}

const slug = String(formData.get("slug") ?? "").trim();

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

if (slug.length < 2 || slug.length > 100 || !slugRegex.test(slug)) {
  return {
    error:
      "O slug deve ter entre 2 e 100 caracteres e conter apenas letras minúsculas, números e hífens.",
  };
}
const priceText = String(formData.get("price") ?? "").trim();

if (!/^\d+(?:\.\d{1,2})?$/.test(priceText)) {
  return {
    error:
      "O preço deve ser um número válido, com no máximo duas casas decimais.",
  };
}

const price = Number(priceText);

if (!Number.isFinite(price) || price < 0 || price > 9999999999.99) {
  return {
    error: "O preço informado está fora do intervalo permitido.",
  };
} 

const unlimitedStockText = String(
  formData.get("unlimited_stock") ?? ""
);

if (unlimitedStockText !== "true" && unlimitedStockText !== "false") {
  return {
    error: "Tipo de estoque inválido.",
  };
}

const unlimitedStock = unlimitedStockText === "true";

const stockText = String(formData.get("stock") ?? "").trim();

if (!/^\d+$/.test(stockText)) {
  return {
    error: "O estoque deve ser um número inteiro não negativo.",
  };
}

const stockNumber = Number(stockText);

if (!Number.isSafeInteger(stockNumber) || stockNumber > 2147483647) {
  return {
    error: "A quantidade em estoque está fora do limite permitido.",
  };
}

const stock = unlimitedStock ? 0 : stockNumber;

const description = String(
  formData.get("description") ?? ""
).trim();

if (description.length > 2000) {
  return {
    error: "A descrição do produto não pode ultrapassar 2.000 caracteres.",
  };
}

const imageUrl = String(formData.get("image_url") ?? "").trim();

if (imageUrl.length > 500 || !isAllowedProductImageUrl(imageUrl)) {
  return {
    error: "Envie uma imagem válida usando o campo de imagem.",
  };
}

const isActiveText = String(formData.get("is_active") ?? "");

if (isActiveText !== "true" && isActiveText !== "false") {
  return {
    error: "Status do produto inválido.",
  };
}

const isActive = isActiveText === "true";

const { data: updatedProduct, error: updateError } = await supabase
  .from("products")
  .update({
    name,
    slug,
    description: description || null,
    price,
    stock,
    unlimited_stock: unlimitedStock,
    image_url: imageUrl || null,
    is_active: isActive,
  })
  .eq("id", productId)
  .select("id")
  .single();

if (updateError) {
  console.error("Erro ao atualizar produto:", updateError.code);

  if (updateError.code === "23505") {
    return {
      error: "Já existe um produto com esse slug nesta categoria.",
    };
  }

  return {
    error: "Não foi possível atualizar o produto. Tente novamente.",
  };
}

if (!updatedProduct) {
  return {
    error: "A atualização do produto não foi confirmada. Tente novamente.",
  };
}

if (existingProduct.image_url !== (imageUrl || null)) {
  const oldImagePath = getManagedProductImagePath(existingProduct.image_url);

  if (oldImagePath) {
    const { error: imageDeleteError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .remove([oldImagePath]);

    if (imageDeleteError) {
      console.error("Erro ao remover imagem antiga:", imageDeleteError.message);
    }
  }
}

revalidatePath("/admin/produtos");
revalidatePath("/");
revalidatePath("/produtos");
revalidatePath(`/admin/produtos/${productId}/editar`);

redirect("/admin/produtos?sucesso=produto-atualizado");
}




// Edição e exclusão segura do catálogo: evita cascatas que apagariam produtos.
export async function updateGameDetails(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("game_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const visibility = String(formData.get("is_active") ?? "");
  if (!["true", "false"].includes(visibility)) throw new Error("Selecione uma visibilidade válida.");
  const isActive = visibility === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id) || name.length < 2 || name.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) throw new Error("Dados do jogo inválidos.");
  const admin = createAdminClient();
  const { data: before } = await admin.from("games").select("slug").eq("id",id).maybeSingle();
  if (!before) throw new Error("Jogo não encontrado.");
  const { error } = await admin.from("games").update({ name, slug, is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.code === "23505" ? "O identificador já está sendo usado." : "Não foi possível editar o jogo.");
  revalidatePath("/");revalidatePath("/jogos");revalidatePath(`/`+before.slug);revalidatePath(`/${slug}`);revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo?updated=game");
}

export async function updateCategoryDetails(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("category_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(id) || name.length < 2 || name.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) throw new Error("Dados da categoria inválidos.");
  const admin = createAdminClient();
  const { error } = await admin.from("categories").update({ name, slug }).eq("id", id);
  if (error) throw new Error(error.code === "23505" ? "O identificador já está sendo usado." : "Não foi possível editar a categoria.");
  revalidatePath("/");revalidatePath("/jogos");revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo?updated=category");
}

export async function deleteEmptyGame(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("game_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Jogo inválido.");
  const admin = createAdminClient();
  const { count, error: checkError } = await admin.from("categories").select("id",{head:true,count:"exact"}).eq("game_id",id);
  if (checkError || count === null) throw new Error("Não foi possível conferir as categorias.");
  if (count > 0) throw new Error("Exclua ou transfira as categorias antes de remover o jogo.");
  const { data, error } = await admin.from("games").delete().eq("id",id).select("image_url").maybeSingle();
  if (error) throw new Error("Não foi possível remover o jogo.");
  const path = getManagedProductImagePath(data?.image_url ?? null);
  if (path) await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  revalidatePath("/");revalidatePath("/jogos");revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo?updated=game-deleted");
}

export async function deleteEmptyCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("category_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Categoria inválida.");
  const admin = createAdminClient();
  const { count, error: checkError } = await admin.from("products").select("id",{head:true,count:"exact"}).eq("category_id",id);
  if (checkError || count === null) throw new Error("Não foi possível conferir os produtos.");
  if (count > 0) throw new Error("Esta categoria ainda tem produtos. Remova os produtos primeiro.");
  const { data, error } = await admin.from("categories").delete().eq("id",id).select("image_url").maybeSingle();
  if (error) throw new Error("Não foi possível remover a categoria.");
  const path = getManagedProductImagePath(data?.image_url ?? null);
  if (path) await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  revalidatePath("/");revalidatePath("/jogos");revalidatePath("/admin/catalogo");
  redirect("/admin/catalogo?updated=category-deleted");
}
