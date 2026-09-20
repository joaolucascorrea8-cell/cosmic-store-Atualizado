import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import NotificationList from "./NotificationList";

export const dynamic="force-dynamic";
export default async function NotificationsPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/notificacoes");const {data}=await supabase.from("notifications").select("id,title,body,link,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);return <><SiteHeader/><main className="shell min-h-[70vh] py-8 sm:py-12"><div className="mx-auto max-w-3xl"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">Sua conta</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Notificações</h1></div><Link href="/pedidos" className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-bold text-violet-300">Meus pedidos</Link></div><NotificationList initial={data??[]} userId={user.id}/></div></main><SiteFooter/></>}
