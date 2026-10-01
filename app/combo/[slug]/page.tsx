import { ACTIVE_COMBO_WINDOW_FILTER } from "@/lib/combos";
import { cache } from "react";
import type { Metadata } from "next";
import { localDate } from "@/lib/catalog";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import AddComboToCartButton from "@/app/components/AddComboToCartButton";
import ComboArtwork from "@/app/components/ComboArtwork";
import { createClient } from "@/lib/supabase/server";
import {
  comboMaxQuantity,
  comboProduct,
  type ComboNestedItem,
} from "@/lib/combos";

export const dynamic = "force-dynamic";
const money = (value: number) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type Combo = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number;
  image_url: string | null;
  ends_at: string | null;
  combo_items: ComboNestedItem[] | null;
};

const getCombo = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("combos")
    .select(
      "id,name,slug,description,price,compare_at_price,image_url,ends_at,combo_items(quantity,products(id,name,image_url,stock,unlimited_stock,is_active))",
    )
    .eq("is_active", true)
    .or(ACTIVE_COMBO_WINDOW_FILTER)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o combo.");
  return data as unknown as Combo | null;
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const combo = await getCombo((await params).slug);
  return combo
    ? {
        title: combo.name,
        description: (
          combo.description || `Confira o combo ${combo.name} na Cosmic Store.`
        ).slice(0, 160),
        alternates: { canonical: `/combo/${combo.slug}` },
        openGraph: { images: combo.image_url ? [combo.image_url] : [] },
      }
    : { title: "Combo não encontrado", robots: { index: false } };
}
export default async function ComboPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const combo = await getCombo(slug);
  if (!combo) notFound();
  const max = comboMaxQuantity(combo.combo_items);
  const products = (combo.combo_items ?? [])
    .map((item) => ({
      quantity: item.quantity,
      product: comboProduct(item.products),
    }))
    .filter((row) => row.product);
  const artworkProducts = products.map(({ product }) => ({
    id: product!.id,
    name: product!.name,
    image_url: product!.image_url ?? null,
  }));
  const cartImage =
    combo.image_url ||
    products[0]?.product?.image_url ||
    "/images/products/placeholder.svg";
  const saving = Math.max(
    0,
    Number(combo.compare_at_price) - Number(combo.price),
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="shell py-8 md:py-12"
      >
        <nav
          aria-label="Navegação de localização"
          className="mb-6 flex flex-wrap gap-2 text-xs text-zinc-500"
        >
          <Link href="/">Início</Link>
          <span>/</span>
          <Link href="/combos">Combos</Link>
          <span>/</span>
          <span className="text-zinc-200">{combo.name}</span>
        </nav>
        <div className="grid items-start gap-8 lg:grid-cols-[.95fr_1.05fr]">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/[.04]">
              {combo.image_url ? (
                <Image
                  src={combo.image_url}
                  alt={combo.name}
                  fill
                  priority
                  sizes="(max-width:1024px) 100vw,50vw"
                  className="object-contain p-8"
                />
              ) : (
                <ComboArtwork
                  products={artworkProducts}
                  comboName={combo.name}
                  className="p-3"
                />
              )}
            </div>
            {products.length > 1 && (
              <div
                className={`mt-3 grid gap-2 ${products.length === 2 ? "grid-cols-2" : products.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}
              >
                {products.slice(0, 4).map(({ product }, index) => (
                  <div
                    key={product!.id}
                    className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/[.02]"
                  >
                    <Image
                      src={
                        product!.image_url || "/images/products/placeholder.svg"
                      }
                      alt={product!.name}
                      fill
                      sizes="120px"
                      className="object-contain p-2"
                    />
                    {index === 3 && products.length > 4 && (
                      <span className="absolute inset-0 grid place-items-center bg-black/65 text-xl font-black">
                        +{products.length - 4}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="lg:pt-3">
            <span className="inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-violet-200">
              COMBO ESPECIAL
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
              {combo.name}
            </h1>
            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-zinc-400 sm:text-base">
              {combo.description ||
                "Um pacote especial preparado pela Cosmic Store."}
            </p>
            <section className="mt-6 rounded-2xl border border-white/10 bg-[#121017] p-5">
              <h2 className="font-black">O que vem no combo</h2>
              <div className="mt-4 space-y-3">
                {products.map(({ quantity, product }) => (
                  <div key={product!.id} className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-white/[.04]">
                      <Image
                        src={
                          product!.image_url ||
                          "/images/products/placeholder.svg"
                        }
                        alt=""
                        fill
                        sizes="48px"
                        className="object-contain p-1"
                      />
                    </div>
                    <span className="flex-1 text-sm font-bold">
                      {quantity}× {product!.name}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/[.05] p-5">
              {saving > 0 && (
                <p className="text-sm text-zinc-500 line-through">
                  Separadamente: {money(combo.compare_at_price)}
                </p>
              )}
              <strong className="mt-1 block text-3xl font-black">
                {money(combo.price)}
              </strong>
              {saving > 0 && (
                <p className="mt-1 text-sm font-bold text-emerald-300">
                  Você economiza {money(saving)}
                </p>
              )}
              {combo.ends_at && (
                <p className="mt-3 text-xs text-amber-200">
                  Oferta válida até {localDate(combo.ends_at)}.
                </p>
              )}
              <p
                className={`mt-3 text-xs ${max > 0 ? "text-emerald-300" : "text-amber-300"}`}
              >
                {max > 0
                  ? "● Combo disponível"
                  : "● Combo indisponível no momento"}
              </p>
              <div className="mt-5">
                <AddComboToCartButton
                  combo={{
                    id: combo.id,
                    slug: combo.slug,
                    name: combo.name,
                    price: Number(combo.price),
                    image_url: cartImage,
                    max_quantity: max,
                  }}
                />
              </div>
              <Link href="/carrinho" className="btn-secondary mt-3 w-full">
                Ir para o carrinho →
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
