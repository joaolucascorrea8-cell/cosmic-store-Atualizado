"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyCustomer } from "@/lib/notifications";

const allowed = ["paid","delivered","cancelled","proof_rejected"];

export async function updateOrderStatus(formData:FormData){
  const adminUser=await requireAdmin();
  const orderId=String(formData.get("order_id")??""); const status=String(formData.get("status")??"");
  if(!orderId||!allowed.includes(status))throw new Error("Situação inválida.");
  const admin=createAdminClient(); const {data:order}=await admin.from("orders").select("user_id,order_code,status,stock_deducted_at,stock_restored_at").eq("id",orderId).single(); if(!order)throw new Error("Pedido não encontrado.");
  const rejectionReason=String(formData.get("rejection_reason")??"").trim();
  if(status==="proof_rejected"&&(rejectionReason.length<5||rejectionReason.length>300))throw new Error("Informe um motivo de 5 a 300 caracteres.");
  if(status==="paid"&&!['paid','preparing_delivery','delivered'].includes(order.status)){
    const {error:stockError}=await admin.rpc("commit_order_stock",{target_order_id:orderId});
    if(stockError)throw new Error(stockError.message);
  }
  if(status==="cancelled"&&order.stock_deducted_at&&!order.stock_restored_at){
    const {error:stockError}=await admin.rpc("restore_order_stock",{target_order_id:orderId});
    if(stockError)throw new Error(stockError.message);
  }
  const now=new Date(); const updates:Record<string,string|null>={status};
  if(status==="paid"){updates.paid_at=now.toISOString();updates.delivery_due_at=new Date(now.getTime()+24*60*60*1000).toISOString();updates.chat_closed_at=null;updates.rejection_reason=null;}
  if(status==="delivered"){updates.delivered_at=now.toISOString();updates.chat_closed_at=now.toISOString();}
  if(status==="proof_rejected")updates.rejection_reason=rejectionReason;
  const {error}=await admin.from("orders").update(updates).eq("id",orderId); if(error)throw error;
  await admin.from("order_admin_events").insert({order_id:orderId,admin_id:adminUser.id,action:`status:${status}`,details:status==="proof_rejected"?{rejection_reason:rejectionReason}:null});
  const notifications:Record<string,[string,string]>={
    paid:["Pagamento confirmado!",`O pagamento do pedido ${order.order_code} foi confirmado. O chat do pedido já está disponível.`],
    delivered:["Pedido entregue!",`O pedido ${order.order_code} foi marcado como entregue. Conte como foi sua experiência com a Cosmic Store.`],
    cancelled:["Pedido cancelado",`O pedido ${order.order_code} foi cancelado. Fale conosco se precisar de ajuda.`],
    proof_rejected:["Comprovante não confirmado",`Não conseguimos confirmar o comprovante do pedido ${order.order_code}. Motivo: ${rejectionReason} Abra o pedido para enviar um novo arquivo.`],
  };
  const [title,body]=notifications[status]; await notifyCustomer(order.user_id,title,body,`/pedidos/${orderId}`);
  revalidatePath(`/admin/pedidos/${orderId}`); revalidatePath("/admin/pedidos"); revalidatePath(`/pedidos/${orderId}`);
}

export async function updateOrderChat(formData:FormData){
  const adminUser=await requireAdmin();
  const orderId=String(formData.get("order_id")??""); const action=String(formData.get("chat_action")??"");
  if(!orderId||!["open","close"].includes(action))throw new Error("Ação de atendimento inválida.");
  const admin=createAdminClient();
  const {data:order}=await admin.from("orders").select("status").eq("id",orderId).maybeSingle();
  if(!order||!["paid","preparing_delivery","delivered"].includes(order.status))throw new Error("O chat ainda não está disponível para este pedido.");
  const {error}=await admin.from("orders").update({chat_closed_at:action==="close"?new Date().toISOString():null}).eq("id",orderId);
  if(error)throw error;
  await admin.from("order_admin_events").insert({order_id:orderId,admin_id:adminUser.id,action:`chat:${action}`});
  revalidatePath(`/admin/pedidos/${orderId}`); revalidatePath(`/pedidos/${orderId}`);
}
