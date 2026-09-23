import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "./components/AdminNav";
import AdminLiveAlerts from "./components/AdminLiveAlerts";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/admin");
  const { data: admin, error } = await supabase.from("admins").select("role").eq("user_id", user.id).maybeSingle();
  if (error || !admin || !["owner", "admin"].includes(admin.role)) redirect("/");
  const [orders, support, reports] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["proof_submitted", "under_review"]),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("message_reports").select("id", { count: "exact", head: true }).is("resolved_at", null),
  ]);
  return <div className="admin-app"><header className="admin-topbar"><div className="admin-topbar-inner"><Link href="/admin" className="text-lg font-black tracking-tight">COSMIC<span className="text-violet-400">.</span><span className="ml-2 text-xs font-semibold tracking-normal text-zinc-400">/ Gestão</span></Link><Link href="/" className="admin-small-button">↗ Ver loja</Link></div></header><div className="admin-layout"><aside className="admin-sidebar"><p className="px-3 pb-3 text-[10px] font-black uppercase tracking-[.2em] text-zinc-500">Área administrativa</p><AdminNav /><div className="mt-8 rounded-xl border border-violet-500/15 bg-violet-500/5 p-4 text-xs text-zinc-400"><strong className="block text-sm text-white">Dica rápida</strong><p className="mt-2 leading-5">Jogos, categorias e capas ficam na mesma seção do catálogo.</p><Link href="/admin/catalogo" className="mt-3 inline-block font-bold text-violet-300">Abrir catálogo ↗</Link></div></aside><div className="admin-workspace"><AdminLiveAlerts initial={{ proofs: orders.count ?? 0, support: support.count ?? 0, reports: reports.count ?? 0 }} />{children}</div></div></div>;
}
