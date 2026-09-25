import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateUser } from "./actions";

export default async function CommunityAdmin() {
  const admin = createAdminClient();
  const [{ data: messages }, { data: reports }] = await Promise.all([
    admin.from("global_messages").select("id,user_id,message,created_at,profiles(nickname)").order("created_at", { ascending: false }).limit(40),
    admin.from("message_reports").select("id,reason,created_at,global_messages(message,profiles(nickname))").is("resolved_at", null).order("created_at", { ascending: false }),
  ]);
  return <main className="admin-page"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">COMUNIDADE</p><h1 className="admin-title">Chat e moderação</h1><p className="admin-description">Mensagens recentes e denúncias ficam aqui. As avaliações agora têm uma seção própria.</p></div><Link href="/admin/avaliacoes" className="admin-small-button">★ Abrir avaliações</Link></div>
    {reports?.length ? <section className="admin-panel border-amber-500/20 bg-amber-500/5"><h2 className="text-xl font-black">Denúncias pendentes</h2>{reports.map(report => <div key={report.id} className="mt-3 rounded-xl bg-black/20 p-4 text-sm"><strong>{report.reason}</strong><p className="mt-1 text-zinc-400">{JSON.stringify(report.global_messages)}</p></div>)}</section> : null}
    <section className="admin-panel mt-6"><h2 className="text-xl font-black">Mensagens recentes</h2><div className="mt-4 space-y-3">{messages?.map(message => { const profile = Array.isArray(message.profiles) ? message.profiles[0] : message.profiles; return <div key={message.id} className="flex flex-col justify-between gap-3 rounded-xl bg-black/20 p-4 sm:flex-row"><div><strong>{profile?.nickname ?? "Usuário"}</strong><p className="mt-1 text-sm text-zinc-300">{message.message}</p></div><div className="flex flex-wrap gap-2">{[["delete_message","Apagar"],["mute","Silenciar 24h"],["ban","Banir"]].map(([action,label]) => <form key={action} action={moderateUser}><input type="hidden" name="user_id" value={message.user_id}/><input type="hidden" name="message_id" value={message.id}/><input type="hidden" name="action" value={action}/><button className="admin-small-button">{label}</button></form>)}</div></div>})}</div></section>
  </main>;
}
