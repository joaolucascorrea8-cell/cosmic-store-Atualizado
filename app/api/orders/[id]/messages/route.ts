import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminDiscord, notifyCustomer, sendEmail } from "@/lib/notifications";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Não autorizado."},{status:401});
  const body=await request.json().catch(()=>null) as {message?:unknown}|null;const message=typeof body?.message==="string"?body.message.trim():"";if(!message||message.length>1000)return NextResponse.json({error:"Mensagem inválida."},{status:400});
  const admin=createAdminClient();const [{data:order},{data:adminRole}]=await Promise.all([admin.from("orders").select("user_id,order_code,status,chat_closed_at").eq("id",id).maybeSingle(),admin.from("admins").select("role").eq("user_id",user.id).maybeSingle()]);
  if(!order||(!adminRole&&order.user_id!==user.id)||!["paid","preparing_delivery","delivered"].includes(order.status)||order.chat_closed_at)return NextResponse.json({error:"Este atendimento está encerrado."},{status:403});
  const {error}=await supabase.from("order_messages").insert({order_id:id,user_id:user.id,message});if(error)return NextResponse.json({error:error.message},{status:400});
  if(adminRole){await notifyCustomer(order.user_id,"Nova mensagem no seu pedido",`A equipe respondeu no pedido ${order.order_code}.`,`/pedidos/${id}`);}else{await Promise.allSettled([notifyAdminDiscord(`💬 Nova mensagem no pedido **${order.order_code}**`),sendEmail(process.env.ADMIN_NOTIFICATION_EMAIL,`Nova mensagem — ${order.order_code}`,`<p>O cliente enviou uma nova mensagem.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000"}/admin/pedidos/${id}">Abrir conversa</a></p>`)]);}
  return NextResponse.json({ok:true});
}
