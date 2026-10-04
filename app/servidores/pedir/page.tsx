import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import ServerRequestForm from "./ServerRequestForm";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pedir servidor",
  robots: { index: false, follow: false },
};
export default async function RequestServerPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login?next=/servidores/pedir");
  const { data: games } = await client
    .from("games")
    .select("name")
    .eq("is_active", true)
    .order("display_order");
  return (
    <>
      <SiteHeader />
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="shell py-8 md:py-12"
      >
        <div className="mx-auto max-w-2xl">
          <Link
            href="/servidores"
            className="text-sm font-bold text-zinc-400 hover:text-white"
          >
            ← Servidores
          </Link>
          <p className="eyebrow mt-7">Seu próximo jogo</p>
          <h1 className="section-title">Pedir servidor VIP</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Não encontrou o jogo que queria? Escreva o nome e conte seu pedido.
            A resposta fica na sua conta, em Meus atendimentos.
          </p>
          <section className="surface mt-7 rounded-3xl p-5 sm:p-7">
            <ServerRequestForm
              userId={user.id}
              games={[...new Set((games ?? []).map((game) => game.name))]}
            />
          </section>
          <Link
            href="/suporte"
            className="mt-5 inline-flex text-sm font-bold text-violet-300"
          >
            Acompanhar meus pedidos de servidor →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
