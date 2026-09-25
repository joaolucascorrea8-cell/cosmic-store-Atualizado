"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { campaignEmailHtml, sendCampaignDiscord, sendCampaignEmail, type CampaignProduct } from "@/lib/campaigns";
import { isAllowedProductImageUrl } from "@/lib/product-images";

type CampaignState={error:string|null;success:string|null};
const uuidRegex=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const siteUrl=(process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000").replace(/\/$/,"");

function nested<T>(value:T|T[]|null|undefined){return Array.isArray(value)?value[0]:value;}

async function listCustomerEmails(){
  const admin=createAdminClient();
  const {data:adminRows}=await admin.from("admins").select("user_id");
  const adminIds=new Set((adminRows??[]).map(row=>row.user_id));
  const emails=new Set<string>();
  for(let page=1;page<=50;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    if(error) throw new Error("Não foi possível carregar os e-mails dos clientes.");
    for(const user of data.users){
      const email=user.email?.trim().toLowerCase();
      if(email&&!adminIds.has(user.id)) emails.add(email);
    }
    if(data.users.length<1000) break;
  }
  return [...emails];
}

export async function sendCampaign(_previous:CampaignState,formData:FormData):Promise<CampaignState>{
  const user=await requireAdmin();
  const requestToken=String(formData.get("request_token")??"");
  const source=String(formData.get("source")??"");
  const [sourceType,sourceId]=source.split(":");
  const title=String(formData.get("title")??"").trim();
  const body=String(formData.get("body")??"").trim();
  const bannerUrl=String(formData.get("banner_url")??"").trim();
  const sendEmail=formData.get("send_email")==="on";
  const sendDiscord=formData.get("send_discord")==="on";

  if(!uuidRegex.test(requestToken)) return {error:"Atualize a página e tente novamente.",success:null};
  if(!["combo","product"].includes(sourceType)||!uuidRegex.test(sourceId)) return {error:"Escolha um combo ou produto válido.",success:null};
  if(title.length<2||title.length>140) return {error:"O título deve ter entre 2 e 140 caracteres.",success:null};
  if(body.length<2||body.length>3000) return {error:"O texto deve ter entre 2 e 3000 caracteres.",success:null};
  if(!sendEmail&&!sendDiscord) return {error:"Marque E-mail, Discord ou os dois.",success:null};
  if(bannerUrl.length>500||!isAllowedProductImageUrl(bannerUrl)) return {error:"Use um banner enviado pela própria loja.",success:null};

  const admin=createAdminClient();
  const {data:existing}=await admin.from("campaigns").select("id,status").eq("request_token",requestToken).maybeSingle();
  if(existing) return {error:null,success:"Essa campanha já foi processada. Atualize a página para criar outra."};

  let sourceName="";let slug="";let price:number|null=null;let compareAtPrice:number|null=null;let sourceImage:string|null=null;let products:CampaignProduct[]=[];
  if(sourceType==="combo"){
    const {data,error}=await admin.from("combos").select("id,name,slug,price,compare_at_price,image_url,is_active,starts_at,ends_at,combo_items(quantity,products(name,image_url,is_active))").eq("id",sourceId).maybeSingle();
    if(error||!data) return {error:"Combo não encontrado.",success:null};
    const now=Date.now(); if(!data.is_active||(data.starts_at&&new Date(data.starts_at).getTime()>now)||(data.ends_at&&new Date(data.ends_at).getTime()<=now)) return {error:"Ative o combo e confira o período da oferta antes de divulgar.",success:null};
    sourceName=data.name;slug=data.slug;price=Number(data.price);compareAtPrice=Number(data.compare_at_price);sourceImage=data.image_url;
    const rawProducts=(data.combo_items??[]).map((item:any)=>{const product=nested(item.products) as {name:string;image_url:string|null;is_active:boolean}|undefined;return product?{name:product.name,image_url:product.image_url,is_active:product.is_active,quantity:Number(item.quantity)}:null}).filter(Boolean) as Array<CampaignProduct & {is_active:boolean}>;
    if(rawProducts.some(product=>!product.is_active)) return {error:"Um produto deste combo está inativo. Ajuste o combo antes de divulgar.",success:null};
    products=rawProducts.map(({name,image_url,quantity})=>({name,image_url,quantity}));
  }else{
    const {data,error}=await admin.from("products").select("id,name,slug,price,image_url,is_active").eq("id",sourceId).maybeSingle();
    if(error||!data) return {error:"Produto não encontrado.",success:null};
    if(!data.is_active) return {error:"Ative o produto antes de divulgar.",success:null};
    sourceName=data.name;slug=data.slug;price=Number(data.price);sourceImage=data.image_url;products=[{name:data.name,image_url:data.image_url,quantity:1}];
  }
  const path=sourceType==="combo"?`/combo/${slug}`:`/produto/${slug}`;
  const url=`${siteUrl}${path}`;
  const finalBanner=bannerUrl||sourceImage||products.find(product=>product.image_url)?.image_url||null;

  const {data:campaign,error:campaignError}=await admin.from("campaigns").insert({request_token:requestToken,title,body,source_type:sourceType,source_id:sourceId,banner_url:finalBanner,send_email:sendEmail,send_discord:sendDiscord,status:"sending",created_by:user.id}).select("id").single();
  if(campaignError||!campaign){
    if(campaignError?.code==="23505") return {error:null,success:"Essa campanha já foi processada."};
    return {error:"Não foi possível registrar a campanha.",success:null};
  }

  const deliveries:{campaign_id:string;channel:"email"|"discord";recipient:string|null;status:"sent"|"failed";error_message:string|null}[]=[];
  let emailSent=0;let emailFailed=0;let discordStatus:"sent"|"failed"|null=null;let discordError:string|null=null;

  if(sendDiscord){
    try{await sendCampaignDiscord({title,body,url,bannerUrl:finalBanner,products,price,compareAtPrice});discordStatus="sent";deliveries.push({campaign_id:campaign.id,channel:"discord",recipient:"canal-de-campanhas",status:"sent",error_message:null});}
    catch(error){discordStatus="failed";discordError=error instanceof Error?error.message:String(error);deliveries.push({campaign_id:campaign.id,channel:"discord",recipient:"canal-de-campanhas",status:"failed",error_message:discordError.slice(0,500)});}
  }

  if(sendEmail){
    let emails:string[]=[];
    try{emails=await listCustomerEmails();}catch(error){await admin.from("campaign_deliveries").insert({campaign_id:campaign.id,channel:"email",recipient:null,status:"failed",error_message:error instanceof Error?error.message:"Falha ao listar destinatários."});await admin.from("campaigns").update({status:sendDiscord&&discordStatus==="sent"?"partial":"failed",discord_status:discordStatus,discord_error:discordError,sent_at:new Date().toISOString()}).eq("id",campaign.id);return {error:"A campanha foi registrada, mas não foi possível carregar os e-mails dos clientes.",success:null};}
    const html=campaignEmailHtml({title,body,url,bannerUrl:finalBanner,products,price,compareAtPrice});
    for(let index=0;index<emails.length;index+=5){
      const batch=emails.slice(index,index+5);
      const results=await Promise.allSettled(batch.map(email=>sendCampaignEmail(email,`🌌 ${title} — Cosmic Store`,html)));
      results.forEach((result,i)=>{const email=batch[i];if(result.status==="fulfilled"){emailSent++;deliveries.push({campaign_id:campaign.id,channel:"email",recipient:email,status:"sent",error_message:null});}else{emailFailed++;deliveries.push({campaign_id:campaign.id,channel:"email",recipient:email,status:"failed",error_message:String(result.reason instanceof Error?result.reason.message:result.reason).slice(0,500)});}});
    }
  }

  if(deliveries.length) await admin.from("campaign_deliveries").insert(deliveries);
  const totalSuccess=emailSent+(discordStatus==="sent"?1:0);
  const totalFailure=emailFailed+(discordStatus==="failed"?1:0);
  const status=totalFailure===0?"sent":totalSuccess===0?"failed":"partial";
  await admin.from("campaigns").update({status,email_sent_count:emailSent,email_failed_count:emailFailed,discord_status:discordStatus,discord_error:discordError,sent_at:new Date().toISOString()}).eq("id",campaign.id);
  revalidatePath("/admin/campanhas");

  const parts=[] as string[];
  if(sendEmail) parts.push(`${emailSent} e-mail(s) enviado(s)${emailFailed?` · ${emailFailed} falha(s)`:""}`);
  if(sendDiscord) parts.push(discordStatus==="sent"?"Discord publicado":"Discord falhou");
  return {error:status==="failed"?"A campanha foi criada, mas nenhum canal conseguiu concluir o envio.":null,success:status!=="failed"?`Campanha enviada: ${parts.join(" · ")}.`:null};
}
