import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { createSupportTicket } from "./actions";

export const dynamic = "force-dynamic";
const labels: Record<string, string> = { open: "Aberto", answered: "Respondido", closed: "Encerrado" };

export default async function SupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/suporte");

  const [{ data: tickets }, { data: unread }] = await Promise.all([
    supabase.from("support_tickets").select("id,subject,category,status,created_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("notifications").select("link").eq("user_id", user.id).is("read_at", null).like("link", "/suporte/%"),
  ]);
  const unreadByTicket = new Map<string, number>();
  (unread ?? []).forEach((notification) => {
    if (!notification.link) return;
    unreadByTicket.set(notification.link, (unreadByTicket.get(notification.link) ?? 0) + 1);
  });

  return <>
    <SiteHeader />
    <main className="shell py-12 md:py-16">
      <p className="eyebrow">Atendimento particular</p>
      <h1 className="section-title">Central de suporte</h1>
      <p className="mt-3 max-w-2xl text-zinc-500">Abra um atendimento para dúvidas gerais. Para assuntos de uma compra, informe o código do pedido na mensagem.</p>

      <div className="mt-9 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <section className="surface rounded-3xl p-6">
          <h2 className="text-xl font-black">Novo atendimento</h2>
          <form action={createSupportTicket} className="mt-6 space-y-4">
            <div><label className="mb-2 block text-sm font-bold">Assunto</label><input name="subject" required minLength={3} maxLength={120} placeholder="Ex.: Dúvida sobre minha conta" className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 outline-none focus:border-violet-500" /></div>
            <div><label className="mb-2 block text-sm font-bold">Categoria</label><select name="category" className="w-full rounded-xl border border-white/10 bg-[#0b0910] px-4 py-3"><option value="order">Pedido</option><option value="payment">Pagamento</option><option value="account">Conta</option><option value="product">Produto</option><option value="other">Outro assunto</option></select></div>
            <div><label className="mb-2 block text-sm font-bold">Como podemos ajudar?</label><textarea name="message" required minLength={5} maxLength={1500} rows={6} placeholder="Explique o que aconteceu..." className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-4 py-3 outline-none focus:border-violet-500" /></div>
            <button className="w-full rounded-xl bg-violet-600 px-5 py-3 font-bold hover:bg-violet-500">Abrir atendimento</button>
          </form>
        </section>

        <section className="surface rounded-3xl p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-black">Meus atendimentos</h2><span className="text-xs text-zinc-500">{tickets?.length ?? 0} ticket(s)</span></div>
          <div className="mt-5 space-y-3">
            {tickets?.length ? tickets.map((ticket) => {
              const unreadCount = unreadByTicket.get(`/suporte/${ticket.id}`) ?? 0;
              return <Link key={ticket.id} href={`/suporte/${ticket.id}`} className={`block rounded-2xl border bg-white/[.025] p-4 hover:border-violet-500/40 ${unreadCount ? "border-violet-500/35" : "border-white/[.07]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><strong className="break-words">{ticket.subject}</strong>{unreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{unreadCount} nova{unreadCount === 1 ? "" : "s"}</span>}</div>
                    <p className="mt-1 text-xs text-zinc-500">Atualizado em {new Date(ticket.updated_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${ticket.status === "closed" ? "bg-zinc-500/10 text-zinc-400" : ticket.status === "answered" ? "bg-emerald-500/10 text-emerald-300" : "bg-violet-500/10 text-violet-300"}`}>{labels[ticket.status] ?? ticket.status}</span>
                </div>
              </Link>;
            }) : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">Você ainda não abriu nenhum atendimento.</div>}
          </div>
        </section>
      </div>
    </main>
    <SiteFooter />
  </>;
}
