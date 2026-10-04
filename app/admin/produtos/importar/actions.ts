"use server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { allRows } from "@/lib/query-pages";
import { parseProductCsv } from "@/lib/product-csv";
import { slugify, UUID_PATTERN } from "@/lib/catalog";
import { readProductForm } from "@/lib/product-form";
import { readRobuxRate, robuxPrice } from "@/lib/robux-pricing";
import { operationError } from "@/lib/store-issues";
import { revalidatePath } from "next/cache";
export type ImportRow = {
  name: string;
  slug: string;
  category_id: string;
  price: number;
  stock: number;
  unlimited_stock: boolean;
  description: string | null;
  robux_quantity: number | null;
  pricing_rate: number | null;
  delivery_instructions: string;
  category_label: string;
};
async function prepare(text: string, rate: string): Promise<ImportRow[]> {
  const amount = readRobuxRate(rate);
  if (!amount) throw new Error("Confira a cotação do Robux.");
  const rows = parseProductCsv(text),
    client = createAdminClient();
  const [games, categories] = await Promise.all([
    allRows(client.from("games").select("id,name,slug").order("id")),
    allRows(
      client.from("categories").select("id,name,slug,game_id").order("id"),
    ),
  ]);
  if (games.error || categories.error)
    throw new Error("Não foi possível conferir o catálogo.");
  const seen = new Set<string>();
  return rows.map((r, index) => {
    const matches = (games.data ?? []).filter(
      (g) => g.slug === slugify(r.jogo) || slugify(g.name) === slugify(r.jogo),
    );
    if (matches.length !== 1)
      throw new Error(
        `Registro ${index + 1}: jogo não encontrado ou ambíguo. Use o identificador do jogo.`,
      );
    const cats = (categories.data ?? []).filter(
      (c) =>
        c.game_id === matches[0].id &&
        (c.slug === slugify(r.categoria) ||
          slugify(c.name) === slugify(r.categoria)),
    );
    if (cats.length !== 1)
      throw new Error(
        `Registro ${index + 1}: categoria não encontrada neste jogo.`,
      );
    const key = cats[0].id + "|" + slugify(r.nome);
    if (seen.has(key))
      throw new Error(`Registro ${index + 1}: produto repetido na planilha.`);
    seen.add(key);
    let quantity: number | null = null;
    if (r.robux) {
      quantity = Number(r.robux);
      if (
        !/^\d+$/.test(r.robux) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 1000000
      )
        throw new Error(`Registro ${index + 1}: quantidade de Robux inválida.`);
    }
    const unlimited = (r.ilimitado || "nao").toLowerCase();
    if (!["sim", "não", "nao", "true", "false", "1", "0"].includes(unlimited))
      throw new Error(`Registro ${index + 1}: use sim ou nao em ilimitado.`);
    const form = new FormData();
    Object.entries({
      name: r.nome,
      slug: slugify(r.nome).slice(0, 90).replace(/-+$/, ""),
      category_id: cats[0].id,
      price:
        r.preco || (quantity ? robuxPrice(quantity, amount).toFixed(2) : ""),
      stock: r.estoque || "0",
      unlimited_stock: String(["sim", "true", "1"].includes(unlimited)),
      is_active: "false",
      description: r.descricao || "",
      image_url: "",
      delivery_instructions: r.instrucoes || "",
      robux_quantity: quantity ? String(quantity) : "",
      pricing_rate: !r.preco && quantity ? String(amount) : "",
    }).forEach(([k, v]) => form.set(k, v));
    const parsed = readProductForm(form);
    if (parsed.error) throw new Error(`Registro ${index + 1}: ${parsed.error}`);
    if (parsed.values!.price < 0.01 || parsed.values!.price > 999999.99)
      throw new Error(
        `Registro ${index + 1}: informe um preço entre R$0,01 e R$999.999,99.`,
      );
    return {
      ...parsed.values!,
      robux_quantity: quantity,
      delivery_instructions: r.instrucoes || "",
      category_label: matches[0].name + " · " + cats[0].name,
    };
  });
}
export async function previewImport(
  text: string,
  rate: string,
): Promise<{ rows?: ImportRow[]; error?: string }> {
  await requireAdmin();
  try {
    return { rows: await prepare(text, rate) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Confira a planilha." };
  }
}
export async function importProducts(
  text: string,
  rate: string,
  token: string,
) {
  const actor = await requireAdmin();
  if (!UUID_PATTERN.test(token))
    return { error: "Reabra a prévia da importação." };
  let rows: ImportRow[];
  try {
    rows = await prepare(text, rate);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Confira a planilha." };
  }
  const { data, error } = await createAdminClient(actor.id).rpc(
    "ops_import_products",
    { p_actor: actor.id, p_token: token, p_rows: rows },
  );
  if (error)
    return { error: await operationError(error, "/admin/produtos/importar") };
  revalidatePath("/", "layout");
  return {
    success: `${data} produtos cadastrados como ocultos. Revise imagens e preços no catálogo antes de publicar.`,
  };
}
