import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import NotificationList from "./NotificationList";

export const dynamic="force-dynamic";
export default async function NotificationsPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/notificacoes");const {data}=await supabase.from("notifications").select("id,title,body,link,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);return <><SiteHeader/><main className="shell min-h-[70vh] py-12"><div className="mx-auto max-w-3xl"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">Sua conta</p><h1 className="mt-2 text-4xl font-black">Notificações</h1></div><Link href="/pedidos" className="text-sm font-bold text-violet-300">Meus pedidos</Link></div><NotificationList initial={data??[]}/></div></main><SiteFooter/></>}

