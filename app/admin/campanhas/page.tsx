import {requireAdmin} from "@/lib/require-admin";
import {createAdminClient} from "@/lib/supabase/admin";
import CampaignComposer,{type CampaignSource} from "./CampaignComposer";

type Product={id:string;name:string;price:number;image_url:string|null;slug:string};
type ComboItem={quantity:number;products:{name:string;image_url:string|null}|{name:string;image_url:string|null}[]|null};
type Combo={id:string;name:string;price:number;compare_at_price:number;image_url:string|null;slug:string;combo_items:ComboItem[]|null};
type Campaign={id:string;title:string;status:string;send_email:boolean;send_discord:boolean;email_sent_count:number;email_failed_count:number;discord_status:string|null;created_at:string;sent_at:string|null};

export default async function CampaignsPage({searchParams}:{searchParams:Promise<{source?:string}>}){
  await requireAdmin();const params=await searchParams;const admin=createAdminClient();
  const [{data:products},{data:combos},{data:campaigns}]=await Promise.all([
    admin.from("products").select("id,name,price,image_url,slug").eq("is_active",true).order("display_order").order("name"),
    admin.from("combos").select("id,name,price,compare_at_price,image_url,slug,combo_items(quantity,products(name,image_url))").eq("is_active",true).order("created_at",{ascending:false}),
    admin.from("campaigns").select("id,title,status,send_email,send_discord,email_sent_count,email_failed_count,discord_status,created_at,sent_at").order("created_at",{ascending:false}).limit(20),
  ]);
  const sources:CampaignSource[]=[];
  for(const combo of (combos??[]) as unknown as Combo[]){sources.push({key:`combo:${combo.id}`,type:"combo",name:combo.name,price:Number(combo.price),compare_at_price:Number(combo.compare_at_price),image_url:combo.image_url,products:(combo.combo_items??[]).map(item=>{const p=Array.isArray(item.products)?item.products[0]:item.products;return p?{name:p.name,image_url:p.image_url,quantity:Number(item.quantity)}:null}).filter(Boolean) as CampaignSource["products"]});}
  for(const product of (products??[]) as Product[]){sources.push({key:`product:${product.id}`,type:"product",name:product.name,price:Number(product.price),compare_at_price:null,image_url:product.image_url,products:[{name:product.name,image_url:product.image_url,quantity:1}]});}
  return <main className="admin-page"><div><p className="eyebrow">DIVULGAÇÃO</p><h1 className="admin-title">Campanhas</h1><p className="admin-description">Escolha um combo ou produto, revise o anúncio e envie por E-mail, Discord ou pelos dois. O clique em “Enviar campanha” já é a ação final.</p></div>
    <section className="admin-panel mt-6"><div className="admin-panel-heading"><div><h2>Criar campanha</h2><p>O Discord publica no canal configurado pelo webhook; campanhas não são enviadas por DM.</p></div></div><div className="mt-5"><CampaignComposer sources={sources} initialSource={params.source}/></div></section>
    <section className="admin-panel mt-6"><div className="admin-panel-heading"><div><h2>Histórico recente</h2><p>Últimas campanhas e resultado dos canais.</p></div></div><div className="mt-5 space-y-3">{((campaigns??[]) as Campaign[]).map(campaign=><article key={campaign.id} className="admin-list-row"><div className="min-w-0"><strong className="block truncate text-sm">{campaign.title}</strong><span className="mt-1 block text-xs text-zinc-500">{new Date(campaign.created_at).toLocaleString("pt-BR")} · {campaign.send_email?`${campaign.email_sent_count} e-mail(s)${campaign.email_failed_count?` / ${campaign.email_failed_count} falha(s)`:""}`:"sem e-mail"} · {campaign.send_discord?`Discord ${campaign.discord_status==="sent"?"enviado":campaign.discord_status==="failed"?"falhou":"pendente"}`:"sem Discord"}</span></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${campaign.status==="sent"?"bg-emerald-500/15 text-emerald-300":campaign.status==="partial"?"bg-amber-500/15 text-amber-300":"bg-red-500/15 text-red-300"}`}>{campaign.status==="sent"?"Enviada":campaign.status==="partial"?"Parcial":campaign.status==="sending"?"Enviando":"Falhou"}</span></article>)}{!campaigns?.length&&<p className="admin-empty">Nenhuma campanha enviada ainda.</p>}</div></section>
  </main>;
}
