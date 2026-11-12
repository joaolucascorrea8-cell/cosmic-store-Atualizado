import ProductIdentity from "@/app/components/ProductIdentity";
import DeliveryInstructions from "@/app/components/DeliveryInstructions";
import ProductPreferenceButton from "@/app/components/ProductPreferenceButton";
import ShareProduct from "@/app/components/ShareProduct";
import ServiceHours from "@/app/components/ServiceHours";
import { getStoreService, getRequestTime } from "@/lib/store-service-server";
import { deliveryText } from "@/lib/store-service";
import { cache } from "react";
import type { Metadata } from "next";
import ProductCard from "@/app/components/ProductCard";
import Image from "@/app/components/StoreImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import AddToCartButton from "@/app/components/AddToCartButton";
import StoreFeedbacks from "@/app/components/StoreFeedbacks";
import { createClient } from "@/lib/supabase/server";
import { withSignedReviewAttachments } from "@/lib/review-attachments";
export const dynamic = "force-dynamic";
const getProduct = cache(async (slug: string) => {
  const client = await createClient();
  const { data: product, error } = await client
    .from("products")
    .select("id,name,slug,description,price,image_url,stock,unlimited_stock,is_active,category_id,delivery_hours,delivery_instructions,categories!inner(name,slug,game_id,games!inner(name,slug,is_active,delivery_hours,delivery_instructions))")
    .eq("slug", slug).eq("is_active", true).eq("categories.games.is_active", true).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o produto.");
  if (!product) return null;
  const { categories, ...values } = product;
  const category = Array.isArray(categories) ? categories[0] : categories;
  const game = Array.isArray(category?.games) ? category.games[0] : category?.games;
  return category && game ? { ...values, category, game } : null;
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product)
    return { title: "Produto não encontrado", robots: { index: false } };
  const description = (
    product.description ||
    `${product.name} para ${product.game.name}. Pague com Pix e acompanhe a entrega na Cosmic Store.`
  ).slice(0, 160);
  return {
    title: `${product.name} · ${product.game.name}`,
    description,
    alternates: { canonical: `/produto/${product.slug}` },
    openGraph: {
      title: `${product.name} · ${product.game.name}`,
      description,
      images: product.image_url ? [product.image_url] : [],
    },
  };
}
export default async function ProductDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const client = await createClient();
  const [{ data: feedbacks }, { data: related }, service] = await Promise.all([
    client
      .from("feedbacks")
      .select(
        "id,rating,comment,author_nickname,created_at,source,attachment_path",
      )
      .eq("is_visible", true)
      .order("created_at", { ascending: false })
      .limit(3),
    client
      .from("products")
      .select("id,name,slug,description,price,image_url,stock,unlimited_stock")
      .eq("category_id", product.category_id)
      .eq("is_active", true)
      .neq("id", product.id)
      .order("display_order")
      .order("name")
      .limit(4),
    getStoreService(),
  ]);
  const signedFeedbacks = await withSignedReviewAttachments(feedbacks ?? []);
  const estimatedHours =
    product.delivery_hours ??
    product.game.delivery_hours ??
    service?.delivery_hours;
  const soldOut = !product.unlimited_stock && product.stock <= 0;
  const site =
    process.env.NEXT_PUBLIC_SITE_URL || "https://cosmic-store-blush.vercel.app";
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": new URL(`/produto/${product.slug}#product`, site).href,
    sku: product.id,
    category: `${product.game.name} · ${product.category.name}`,
    name: product.name,
    description: product.description || product.name,
    image: new URL(
      product.image_url || "/images/products/placeholder.svg",
      site,
    ).href,
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: Number(product.price).toFixed(2),
      url: new URL(`/produto/${product.slug}`, site).href,
      availability: `https://schema.org/${soldOut ? "OutOfStock" : "InStock"}`,
      seller: { "@type": "Organization", name: "Cosmic Store" },
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Início", path: "/" },
      { name: product.game.name, path: `/${product.game.slug}` },
      { name: product.category.name, path: `/${product.game.slug}/${product.category.slug}` },
      { name: product.name, path: `/produto/${product.slug}` },
    ].map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: new URL(item.path, site).href })),
  };
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([structured, breadcrumbs]).replace(/</g, "\\u003c"),
        }}
      />
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="shell py-8 md:py-12"
      >
        <nav
          aria-label="Navegação de localização"
          className="mb-6 flex flex-wrap items-center gap-2 text-xs text-zinc-500"
        >
          <Link href="/">Início</Link>
          <span>/</span>
          <Link href={`/${product.game.slug}`}>{product.game.name}</Link>
          <span>/</span>
          <Link href={`/${product.game.slug}/${product.category.slug}`}>
            {product.category.name}
          </Link>
          <span>/</span>
          <span className="text-zinc-200">{product.name}</span>
        </nav>
        <div className="product-detail-layout" aria-labelledby="product-title">
          <div className="product-detail-heading">
            <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-violet-200">
              ITEM DIGITAL
            </span>
            <ProductIdentity context={{ game: product.game.name, category: product.category.name }} />
            <h1 id="product-title" className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              {product.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
              <span className={soldOut ? "text-amber-300" : "text-emerald-300"}>
                ● {soldOut ? "Esgotado" : "Disponível"}
              </span>
              <span>Pagamento via Pix</span>
              <span>Suporte no site</span>
            </div>
          </div>
          <div className="product-detail-art relative overflow-hidden rounded-2xl border border-white/10">
            <Image
              src={product.image_url || "/images/products/placeholder.svg"}
              alt={product.name}
              fill
              priority
              sizes="(max-width:1024px) 100vw,50vw"
              className="object-contain p-4 md:p-8 lg:p-12"
            />
          </div>
          <div className="product-detail-info">
            <div className="product-purchase-box rounded-xl border border-violet-400/25 bg-[#17121f] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Valor do item
              </p>
              <strong className="mt-2 block text-3xl font-black tracking-tight sm:text-4xl">
                {Number(product.price).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>
              <p className="mt-2 text-xs text-zinc-500">
                {product.unlimited_stock
                  ? "Estoque ilimitado"
                  : `${product.stock} unidades disponíveis`}
              </p>
              <p className="mt-3 text-xs leading-5 text-violet-200">
                {estimatedHours ? deliveryText(estimatedHours) : "Consulte a equipe para combinar o prazo."}
              </p>
              <div className="mt-5">
                <AddToCartButton produto={{ id: product.id, name: product.name, slug: product.slug, price: product.price, image_url: product.image_url, stock: product.stock, unlimited_stock: product.unlimited_stock }} context={{ game: product.game.name, category: product.category.name }} />
              </div>
              {soldOut && (
                <ProductPreferenceButton id={product.id} kind="restock" />
              )}
              <ProductPreferenceButton id={product.id} />
              <Link href="/carrinho" className="btn-secondary mt-3 w-full">
                Ir para o carrinho →
              </Link>
            </div>
            <p className="mt-6 whitespace-pre-line text-sm leading-7 text-zinc-400 sm:text-base">
              {product.description ||
                "Item digital para o seu jogo. Consulte a equipe se tiver dúvidas antes de comprar."}
            </p>
            <DeliveryInstructions
              items={[
                {
                  delivery_instructions: [
                    {
                      name: product.name,
                      text:
                        product.delivery_instructions ||
                        product.game.delivery_instructions ||
                        "",
                    },
                  ],
                },
              ]}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <ShareProduct
                name={product.name}
                path={`/produto/${product.slug}`}
              />
            </div>
            {service && (
              <ServiceHours
                settings={service}
                initialTime={await getRequestTime()}
              />
            )}
            <div className="mt-5 rounded-xl border border-white/[.075] p-4 text-xs leading-6 text-zinc-400">
              <strong className="block text-sm text-white">
                Como funciona?
              </strong>
              <p className="mt-1">
                Adicione ao carrinho, informe seu nickname no checkout, pague
                via Pix e envie o comprovante. A equipe confirma o pagamento
                antes da entrega.
              </p>
              <Link
                href="/ajuda#entrega"
                className="mt-2 inline-block font-bold text-violet-300"
              >
                Ver como funciona a entrega ↗
              </Link>
            </div>
          </div>
        </div>
        {Boolean(related?.length) && (
          <section className="mt-12 border-t border-white/10 pt-8">
            <div className="section-heading">
              <h2 className="text-xl font-black">
                Mais de {product.category.name}
              </h2>
              <Link
                href={`/${product.game.slug}/${product.category.slug}`}
                className="section-link"
              >
                Ver categoria →
              </Link>
            </div>
            <div className="product-grid mt-5">
              {related?.map((item) => (
                <ProductCard key={item.id} produto={item} context={{ game: product.game.name, category: product.category.name }} />
              ))}
            </div>
          </section>
        )}
      </main>
      <section className="border-t border-white/[.07] py-10">
        <StoreFeedbacks feedbacks={signedFeedbacks} />
      </section>
      <SiteFooter />
    </div>
  );
}
