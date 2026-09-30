import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ProductCard from "@/app/components/ProductCard";
import StoreFeedbacks from "@/app/components/StoreFeedbacks";
import CatalogCard from "@/app/components/CatalogCard";
import { withSignedReviewAttachments } from "@/lib/review-attachments";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: games }, { data: categories }, { data: products }, { data: feedbacks }] = await Promise.all([
    supabase.from("games").select("id,name,slug,image_url,display_order").eq("is_active", true).order("display_order", { ascending: true }).order("name"),
    supabase.from("categories").select("id,name,slug,game_id,image_url,display_order").order("display_order", { ascending: true }).order("name"),
    supabase.from("products").select("id,name,slug,description,price,image_url,stock,unlimited_stock,display_order").eq("is_active", true).order("display_order", { ascending: true }).order("name", { ascending: true }).limit(8),
    supabase.from("feedbacks").select("id,rating,comment,author_nickname,created_at,source,attachment_path").eq("is_visible", true).order("created_at", { ascending: false }).limit(3),
  ]);
  const signedFeedbacks = await withSignedReviewAttachments(feedbacks ?? []);
  const activeGames = games ?? [];
  const gamePosition = new Map(activeGames.map((game, index) => [game.id, index]));
  const visibleCategories = (categories ?? [])
    .filter((category) => activeGames.some((game) => game.id === category.game_id))
    .sort((a, b) => (gamePosition.get(a.game_id) ?? 9999) - (gamePosition.get(b.game_id) ?? 9999) || Number(a.display_order) - Number(b.display_order) || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 6);
  const featured = products?.find((product) => product.image_url) ?? products?.[0];
  const heroImage = featured?.image_url || activeGames[0]?.image_url || "/images/products/20560-perm-dragon-blox-fruits.png";
  const heroHref = featured ? `/produto/${featured.slug}` : activeGames[0] ? `/${activeGames[0].slug}` : "/jogos";

  return <div className="min-h-screen"><SiteHeader /><main>
    <div className="announcement-bar"><div className="shell flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span><span className="mr-2 text-violet-300">✦</span>Seu inventário começa aqui. Itens digitais para seus jogos.</span><Link href="/pedidos" className="font-bold text-violet-200 hover:text-white">Acompanhar pedido <span aria-hidden="true">↗</span></Link></div></div>
    <section className="shell hero-stage grid items-center gap-7 py-9 md:py-14 lg:grid-cols-[.94fr_1.06fr] lg:gap-12">
      <div className="max-w-xl py-4 lg:py-12"><div className="hero-kicker"><span className="h-2 w-2 rounded-full bg-violet-400" /> COSMIC STORE · LOJA DE GAMES</div><h1 className="hero-headline mt-6">O próximo <span>upgrade</span> do seu jogo está aqui.</h1><p className="mt-6 max-w-lg text-base leading-7 text-zinc-400 md:text-lg">Frutas permanentes, passes e itens digitais em um catálogo feito para quem joga. Escolha, pague via Pix e acompanhe seu pedido.</p><div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/jogos" className="btn-primary">Ver jogos <span aria-hidden="true">↗</span></Link><Link href="/combos" className="btn-secondary">Ver combos <span aria-hidden="true">→</span></Link></div><div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-5 text-xs font-medium text-zinc-400"><span>✓ Pagamento via Pix</span><span>✓ Suporte no pedido</span><span>✓ Entrega acompanhada</span></div></div>
      <div className="hero-art relative overflow-hidden rounded-[26px] border border-white/10"><div className="hero-art-grid" /><div className="hero-orbit" /><div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider backdrop-blur-sm"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {activeGames[0]?.name ?? "Universo gamer"}</div><Image src={heroImage} alt={featured ? `Arte do produto ${featured.name}` : "Destaque gamer da Cosmic Store"} fill priority sizes="(max-width:1023px) 100vw, 50vw" className="hero-art-image object-contain" /><div className="hero-art-bottom absolute inset-x-0 bottom-0 z-10 p-5 sm:p-7"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-violet-200">{featured ? "Em destaque no catálogo" : "Seu universo, suas escolhas"}</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black sm:text-3xl">{featured?.name ?? activeGames[0]?.name ?? "Explore nossos jogos"}</h2>{featured && <p className="mt-1 text-sm font-bold text-zinc-300">{Number(featured.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}</div><Link href={heroHref} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-violet-200">Ver detalhes ↗</Link></div></div></div>
    </section>
    <section className="border-y border-white/[.07] bg-[#100e17]"><div className="shell grid gap-0 sm:grid-cols-3"><div className="trust-item"><span aria-hidden="true" className="trust-icon">◇</span><div><strong>Pagamento via Pix</strong><p>Valor e instruções no checkout.</p></div></div><div className="trust-item"><span aria-hidden="true" className="trust-icon">◎</span><div><strong>Pedido acompanhado</strong><p>Confira o andamento na sua conta.</p></div></div><div className="trust-item"><span aria-hidden="true" className="trust-icon">↗</span><div><strong>Suporte direto</strong><p>Converse com a equipe no site.</p></div></div></div></section>
    <section className="shell store-section" id="jogos"><div className="section-heading"><div><p className="eyebrow">ESCOLHA SEU JOGO</p><h2 className="section-title">Onde vamos jogar?</h2><p className="section-description">Entre no seu jogo e encontre as categorias disponíveis.</p></div><Link href="/jogos" className="section-link">Todos os jogos ↗</Link></div><div className="catalog-grid mt-7">{activeGames.map((game) => <CatalogCard key={game.id} href={`/${game.slug}`} name={game.name} imageUrl={game.image_url} eyebrow="Jogo disponível" description="Ver categorias e itens disponíveis" />)}{!activeGames.length && <div className="empty-store-state">Estamos preparando o catálogo de jogos. Volte em breve.</div>}</div></section>
    {visibleCategories.length > 0 && <section className="shell pb-3"><div className="section-heading"><div><p className="eyebrow">ENCONTRE MAIS RÁPIDO</p><h2 className="section-title">Navegue por categoria</h2></div></div><div className="category-shortcuts mt-6">{visibleCategories.map((category) => {const game = activeGames.find((entry) => entry.id === category.game_id);return game ? <Link className="category-shortcut" href={`/${game.slug}/${category.slug}`} key={category.id}><span className="category-shortcut-icon">↗</span><span className="min-w-0"><strong className="block truncate">{category.name}</strong><small className="text-zinc-500">{game.name}</small></span><span className="ml-auto text-zinc-500">→</span></Link> : null;})}</div></section>}
    <section className="shell store-section" id="destaques"><div className="section-heading"><div><p className="eyebrow">VITRINE COSMIC</p><h2 className="section-title">Destaques do catálogo</h2><p className="section-description">Itens disponíveis para explorar agora.</p></div><Link href="/produtos" className="section-link">Ver todos os produtos ↗</Link></div>{products?.length ? <div className="product-grid mt-7">{products.map((product) => <ProductCard key={product.id} produto={product} />)}</div> : <div className="empty-store-state mt-7">Os produtos aparecerão aqui quando forem publicados.</div>}</section>
    <section className="shell pb-8"><div className="help-banner"><div><p className="eyebrow">PRECISA DE AJUDA?</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Seu pedido não precisa ser uma dúvida.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">Veja como funciona a entrega, as diferenças entre os itens, o envio do comprovante e onde acompanhar sua compra.</p></div><div className="flex shrink-0 flex-wrap gap-2"><Link href="/ajuda" className="btn-secondary">Ver ajuda rápida ↗</Link><Link href="/suporte" className="btn-secondary">Falar com suporte ↗</Link></div></div></section>
    <section className="shell pb-10" aria-labelledby="conta-e-privacidade">
      <div className="overflow-hidden rounded-[26px] border border-white/[.08] bg-[#100e17]">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <p className="eyebrow">CONTA E PRIVACIDADE</p>
            <h2 id="conta-e-privacidade" className="mt-2 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">Entre com Google ou Discord de forma simples e transparente.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">A conta da Cosmic Store serve para autenticar você, identificar seus pedidos, acompanhar entregas, receber avisos importantes e acessar o suporte. Ao usar o Google, solicitamos apenas informações básicas de identificação necessárias ao login, como nome, e-mail, identificador da conta e foto de perfil quando disponibilizada.</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">A Cosmic Store não recebe sua senha do Google e não solicita acesso ao conteúdo do Gmail, Google Drive, contatos, calendário, fotos ou documentos da sua Conta Google.</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">A integração com o Google é usada exclusivamente para autenticação e identificação básica da conta. Não utilizamos APIs do Google para gerar imagens, criar conteúdo por inteligência artificial ou executar outros serviços além do login necessário à sua conta na Cosmic Store.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/privacidade" className="btn-secondary">Política de Privacidade ↗</Link>
              <Link href="/termos" className="btn-secondary">Termos de uso ↗</Link>
            </div>
          </div>
          <div className="grid gap-px border-t border-white/[.07] bg-white/[.07] sm:grid-cols-3 lg:grid-cols-1 lg:border-l lg:border-t-0">
            <div className="bg-[#0c0b11] p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">Dados básicos</p><p className="mt-2 text-sm leading-6 text-zinc-400">Nome, e-mail, identificador e foto de perfil quando fornecidos pelo método de login.</p></div>
            <div className="bg-[#0c0b11] p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">Finalidade</p><p className="mt-2 text-sm leading-6 text-zinc-400">Login, segurança da conta, pedidos, entregas, suporte e comunicações essenciais.</p></div>
            <div className="bg-[#0c0b11] p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">Sem acesso ao conteúdo</p><p className="mt-2 text-sm leading-6 text-zinc-400">Não acessamos Gmail, Drive, contatos, calendário ou outros conteúdos privados da Conta Google.</p></div>
          </div>
        </div>
      </div>
    </section>
    <section className="border-t border-white/[.07] bg-white/[.015] py-14"><StoreFeedbacks feedbacks={signedFeedbacks} /></section>
  </main><SiteFooter /></div>;
}
