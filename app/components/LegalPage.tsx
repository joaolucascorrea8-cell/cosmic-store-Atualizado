import type { ReactNode } from "react";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";

export default function LegalPage({eyebrow,title,intro,children}:{eyebrow:string;title:string;intro:string;children:ReactNode}){
  return <><SiteHeader/><main className="shell py-12 md:py-16"><article className="mx-auto max-w-4xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-400">{eyebrow}</p><h1 className="mt-3 text-4xl font-black md:text-5xl">{title}</h1><p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400">{intro}</p><p className="mt-3 text-xs text-zinc-600">Última atualização: 20 de setembro de 2026.</p><div className="mt-10 space-y-8 text-sm leading-7 text-zinc-300 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3">{children}</div></article></main><SiteFooter/></>;
}
