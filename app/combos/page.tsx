import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ComboCard from "@/app/components/ComboCard";
import { createClient } from "@/lib/supabase/server";
import type { ComboNestedItem } from "@/lib/combos";
export const dynamic="force-dynamic";
type Combo={id:string;name:string;slug:string;description:string|null;price:number;compare_at_price:number;image_url:string|null;combo_items:ComboNestedItem[]|null};
export default async function CombosPage(){const supabase=await createClient();const {data}=await supabase.from("combos").select("id,name,slug,description,price,compare_at_price,image_url,combo_items(quantity,products(id,name,image_url,stock,unlimited_stock,is_active))").order("created_at",{ascending:false});const combos=(data??[]) as unknown as Combo[];return <div className="min-h-screen"><SiteHeader/><main className="catalog-shell"><div className="catalog-page-head"><p className="eyebrow">OFERTAS ESPECIAIS</p><h1 className="section-title">Combos Cosmic.</h1><p className="section-description">Pacotes criados pela equipe com vários itens e um preço especial.</p></div>{combos.length?<div className="product-grid pb-16">{combos.map(combo=><ComboCard key={combo.id} combo={combo}/>)}</div>:<div className="empty-store-state mb-16">Nenhum combo disponível agora. Fique de olho nas próximas ofertas.</div>}</main><SiteFooter/></div>}
