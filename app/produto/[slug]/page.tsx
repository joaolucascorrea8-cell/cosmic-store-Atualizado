import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import AddToCartButton from "@/app/components/AddToCartButton";
import StoreFeedbacks from "@/app/components/StoreFeedbacks";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductDetail({ params }: { params: Promise<{slug:string}> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const [{ data: product }, { data: feedbacks }] = await Promise.all([
    supabase.from("products").select("id,name,slug,description,price,image_url,stock,unlimited_stock,is_active").eq("slug",slug).eq("is_active",true).single(),
    supabase.from("feedbacks").select("id,rating,comment,author_nickname,created_at").eq("is_visible",true).order("created_at",{ascending:false}).limit(3),
  ]);
  if (!product) notFound();
  return <div className="min-h-screen"><SiteHeader/><main className="shell py-10 md:py-16"><Link href="/produtos" className="text-sm font-bold text-zinc-500 hover:text-white">← Voltar ao catálogo</Link><div className="mt-6 grid gap-8 lg:grid-cols-2"><div className="relative grid min-h-[420px] place-items-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/25 to-fuchsia-900/10">{product.image_url ? <Image src={product.image_url} alt={product.name} fill sizes="(max-width:1024px) 100vw,50vw" className="object-contain p-10"/> : <span className="text-8xl">✦</span>}</div><div className="flex flex-col justify-center"><span className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">Produto digital</span><h1 className="mt-3 text-4xl font-black md:text-5xl">{product.name}</h1><p className="mt-5 text-lg leading-8 text-zinc-400">{product.description || "Produto digital da Cosmic Store."}</p><div className="mt-7 text-sm text-zinc-400">✓ Produto verificado</div><div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-5"><div className="flex items-end justify-between"><div><p className="text-sm text-zinc-500">Preço</p><strong className="text-3xl">{Number(product.price).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></div><span className="text-sm text-zinc-500">{product.unlimited_stock ? "Estoque ilimitado" : `${product.stock} disponíveis`}</span></div><div className="mt-5"><AddToCartButton produto={product}/></div></div></div></div></main><StoreFeedbacks feedbacks={feedbacks??[]}/><SiteFooter/></div>;
}
