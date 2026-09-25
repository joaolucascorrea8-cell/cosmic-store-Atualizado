import "server-only";
import { sendGmailEmail } from "@/lib/gmail";

export type CampaignProduct = { name:string; image_url:string|null; quantity?:number };

function escapeHtml(value:string) {
  return value.replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char] ?? char));
}

function paragraphHtml(value:string) {
  return escapeHtml(value).replace(/\n/g,"<br/>");
}

export async function sendCampaignDiscord({
  title, body, url, bannerUrl, products, price, compareAtPrice,
}:{title:string;body:string;url:string;bannerUrl?:string|null;products:CampaignProduct[];price?:number|null;compareAtPrice?:number|null}) {
  const webhook=process.env.DISCORD_CAMPAIGNS_WEBHOOK_URL?.trim();
  if(!webhook) throw new Error("DISCORD_CAMPAIGNS_WEBHOOK_URL não configurado.");
  const fields:{name:string;value:string;inline?:boolean}[]=[];
  if(typeof price==="number") fields.push({name:"💜 Preço",value:price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),inline:true});
  if(typeof compareAtPrice==="number"&&compareAtPrice>Number(price??0)) fields.push({name:"Antes",value:compareAtPrice.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),inline:true});
  fields.push({name:"🛒 Loja",value:`[Abrir oferta na Cosmic Store](${url})`});
  const imageCandidates=products.map(product=>product.image_url).filter((value):value is string=>Boolean(value)).slice(0,4);
  const embeds:any[]=[{
    title:`🌌 ${title}`,
    description:body.slice(0,3800),
    url,
    color:0x7c3aed,
    fields,
    footer:{text:"Cosmic Store • Oferta divulgada pela equipe"},
    ...(bannerUrl?{image:{url:bannerUrl}}:imageCandidates[0]?{thumbnail:{url:imageCandidates[0]}}:{}),
  }];
  for(const [index,image] of imageCandidates.entries()){
    const product=products.filter(p=>p.image_url).slice(0,4)[index];
    embeds.push({title:`${product?.quantity??1}× ${product?.name??"Produto"}`.slice(0,256),url,image:{url:image},color:0x17131f});
  }
  const response=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Cosmic Store • Ofertas",embeds,allowed_mentions:{parse:[]}})});
  if(!response.ok) throw new Error(`Discord recusou a campanha (${response.status}): ${(await response.text()).slice(0,400)}`);
}

export function campaignEmailHtml({title,body,url,bannerUrl,products,price,compareAtPrice}:{title:string;body:string;url:string;bannerUrl?:string|null;products:CampaignProduct[];price?:number|null;compareAtPrice?:number|null}) {
  const visible=products.slice(0,6);
  const cards=visible.map(product=>`<td style="width:${visible.length===1?"100%":"50%"};padding:6px;vertical-align:top"><div style="border:1px solid #292330;border-radius:14px;background:#131017;padding:12px;text-align:center">${product.image_url?`<img src="${escapeHtml(product.image_url)}" alt="" style="width:100%;max-width:160px;height:130px;object-fit:contain;display:block;margin:0 auto 10px"/>`:""}<strong style="font-size:14px;color:#fff">${escapeHtml(`${product.quantity??1}× ${product.name}`)}</strong></div></td>`);
  const rows=[] as string[];for(let i=0;i<cards.length;i+=2)rows.push(`<tr>${cards.slice(i,i+2).join("")}${cards.length%2===1&&i===cards.length-1?'<td style="width:50%"></td>':""}</tr>`);
  const priceHtml=typeof price==="number"?`<div style="margin:24px 0;padding:18px;border:1px solid #6d28d9;border-radius:16px;background:#171020;text-align:center">${typeof compareAtPrice==="number"&&compareAtPrice>price?`<div style="color:#8b8490;text-decoration:line-through;font-size:14px">De ${compareAtPrice.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</div>`:""}<div style="margin-top:4px;font-size:30px;font-weight:900;color:#fff">${price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</div></div>`:"";
  return `<!doctype html><html><body style="margin:0;background:#090811;font-family:Arial,sans-serif;color:#fff"><div style="max-width:640px;margin:0 auto;padding:28px 18px"><div style="text-align:center;margin-bottom:18px"><div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#a78bfa">COSMIC STORE</div><h1 style="margin:10px 0 0;font-size:30px">${escapeHtml(title)}</h1></div>${bannerUrl?`<img src="${escapeHtml(bannerUrl)}" alt="Banner da campanha" style="display:block;width:100%;max-height:360px;object-fit:cover;border-radius:18px;border:1px solid #292330;margin-bottom:22px"/>`:""}<div style="font-size:16px;line-height:1.7;color:#d6d3d9">${paragraphHtml(body)}</div>${priceHtml}${rows.length?`<table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0">${rows.join("")}</table>`:""}<div style="text-align:center;margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:900;padding:14px 24px;border-radius:12px">Ver oferta na Cosmic Store</a></div><div style="border-top:1px solid #292330;padding-top:18px;color:#8b8490;font-size:12px;line-height:1.6;text-align:center">Você está recebendo esta novidade por ter uma conta na Cosmic Store. Para dúvidas, fale com a equipe pelo suporte da loja.</div></div></body></html>`;
}

export async function sendCampaignEmail(to:string, subject:string, html:string) {
  await sendGmailEmail({to,subject,html});
}
