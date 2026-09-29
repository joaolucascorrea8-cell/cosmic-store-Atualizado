import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderStatus } from "@/lib/order-status";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [orders, products, proofs, deliveries, lowStock, tickets, messages] = await Promise.all([
    admin.from("orders").select("id,order_code,status,total,game_nickname,created_at").order("created_at", { ascending: false }).limit(8),
    admin.from("products").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }).in("status", ["proof_submitted", "under_review"]),
    admin.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "preparing_delivery"]),
    admin.from("products").select("id", { count: "exact", head: true }).eq("is_active", true).eq("unlimited_stock", false).gt("stock", 0).lte("stock", 2),
    admin.from("support_tickets").select("id,subject,status,updated_at").neq("status", "closed").order("updated_at", { ascending: false }).limit(4),
    admin.from("order_messages").select("id,order_id,message,created_at").order("created_at", { ascending: false }).limit(4),
  ]);

  const money = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return <main className="admin-page">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">PAINEL DE CONTROLE</p><h1 className="admin-title">Visão geral da loja</h1><p className="admin-description">Pendências importantes aparecem primeiro para você resolver sem procurar.</p></div>
      <Link href="/admin/produtos?novo=1#novo-produto" className="btn-primary">+ Novo produto</Link>
    </div>

    <div className="admin-stats mt-7">
      <Link href="/admin/pedidos?status=pending" className="admin-stat"><span>Comprovantes para analisar</span><strong>{proofs.count ?? "—"}</strong><small>{proofs.count ? "Precisam da sua conferência ↗" : "Nenhum pendente agora"}</small></Link>
      <Link href="/admin/pedidos?status=delivery" className="admin-stat"><span>Aguardando entrega</span><strong>{deliveries.count ?? "—"}</strong><small>{deliveries.count ? "Pagos ou em preparação ↗" : "Fila de entrega vazia"}</small></Link>
      <Link href="/admin/produtos?catalogo=1&status=low#catalogo-produtos" className="admin-stat"><span>Estoque baixo</span><strong>{lowStock.count ?? "—"}</strong><small>Produtos ativos com 1–2 unidades ↗</small></Link>
      <Link href="/admin/produtos" className="admin-stat"><span>Produtos cadastrados</span><strong>{products.count ?? "—"}</strong><small>Gerenciar catálogo ↗</small></Link>
    </div>

    <div className="mt-7 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Pedidos recentes</h2><p>Abra um pedido para conferir o Pix, comprovante e atendimento.</p></div><Link href="/admin/pedidos">Ver todos ↗</Link></div>
        <div className="mt-5 space-y-2">{orders.data?.map(order => <Link key={order.id} href={`/admin/pedidos/${order.id}`} className="admin-list-row"><div className="min-w-0"><strong className="block truncate text-sm">{order.order_code}</strong><span className="mt-1 block text-xs text-zinc-500">{order.game_nickname} · {new Date(order.created_at).toLocaleString("pt-BR")}</span></div><div className="shrink-0 text-right"><strong className="block text-sm">{money(order.total)}</strong><span className="mt-1 block text-[11px] text-violet-300">{orderStatus[order.status]?.label ?? order.status} ↗</span></div></Link>)}{!orders.data?.length && <p className="admin-empty">Nenhum pedido recebido até agora.</p>}</div>
      </section>

      <div className="space-y-5">
        <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Atendimento</h2><p>Conversas e solicitações recentes.</p></div><Link href="/admin/suporte">Ver suporte ↗</Link></div><div className="mt-4 space-y-2">{tickets.data?.map(ticket=><Link key={ticket.id} href={`/admin/suporte/${ticket.id}`} className="admin-list-row"><div className="min-w-0"><strong className="block truncate text-sm">{ticket.subject}</strong><span className="text-xs text-zinc-500">{ticket.status === "open" ? "Aguardando equipe" : "Respondido"}</span></div><span className="text-violet-300">↗</span></Link>)}{!tickets.data?.length && <p className="admin-empty">Nenhum atendimento em aberto.</p>}</div></section>
        <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Mensagens de pedidos</h2><p>Últimas mensagens no chat dos pedidos.</p></div></div><div className="mt-4 space-y-2">{messages.data?.map(message=><Link key={message.id} href={`/admin/pedidos/${message.order_id}`} className="admin-list-row"><span className="line-clamp-2 text-xs text-zinc-300">{message.message}</span><span className="shrink-0 text-violet-300">↗</span></Link>)}{!messages.data?.length && <p className="admin-empty">Nenhuma mensagem recente.</p>}</div></section>
      </div>
    </div>

    <section className="admin-panel mt-5">
      <div className="admin-panel-heading"><div><h2>Ações rápidas</h2><p>Acesse diretamente as tarefas mais comuns.</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Link className="admin-action" href="/admin/catalogo">▦ <strong>Adicionar jogo</strong><span>Jogos e categorias ↗</span></Link><Link className="admin-action" href="/admin/produtos?novo=1#novo-produto">◈ <strong>Cadastrar item</strong><span>Preço, imagem e estoque ↗</span></Link><Link className="admin-action" href="/admin/combos">✦ <strong>Criar combo</strong><span>Pacote + divulgação ↗</span></Link><Link className="admin-action" href="/admin/pedidos?status=pending">▤ <strong>Revisar Pix</strong><span>Comprovantes recebidos ↗</span></Link><Link className="admin-action" href="/admin/comunidade">◎ <strong>Moderar chat</strong><span>Mensagens e avaliações ↗</span></Link></div>
    </section>
  </main>;
}
