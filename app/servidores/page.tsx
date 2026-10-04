import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import Icon from "@/app/components/Icon";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/query-pages";
import type { GameServer } from "@/lib/game-servers";
import ServerExplorer from "./ServerExplorer";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Servidores VIP",
  description:
    "Encontre servidores dos seus jogos favoritos e peça um servidor para outro jogo.",
  alternates: { canonical: "/servidores" },
};
export default async function ServersPage() {
  const client = await createClient();
  const { data, error } = await allRows(
    client
      .from("game_servers")
      .select(
        "id,game_name,name,join_url,description,image_url,is_active,availability,display_order,updated_at",
      )
      .eq("is_active", true)
      .order("display_order")
      .order("created_at")
      .order("id"),
  );
  if (error) console.error("[servidores] Falha ao consultar lista:", error);
  return (
    <>
      <SiteHeader />
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="shell py-8 md:py-12"
      >
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Entre e jogue</p>
            <h1 className="section-title">Servidores</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              Escolha o jogo e entre pelo botão. Não encontrou o seu? Você
              também pode pedir um servidor VIP.
            </p>
          </div>
          <Link
            href="/servidores/pedir"
            className="btn-primary inline-flex shrink-0 items-center justify-center gap-2"
          >
            <Icon name="plus" className="h-4 w-4" /> Pedir servidor
          </Link>
        </div>
        {error ? (
          <div role="alert" className="surface rounded-2xl p-8 text-center">
            <p className="text-zinc-300">
              Não foi possível carregar os servidores agora.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Tente novamente em instantes ou fale com a equipe pelo suporte.
            </p>
            <Link href="/suporte" className="btn-secondary mt-5 inline-flex">
              Abrir suporte
            </Link>
          </div>
        ) : (
          <ServerExplorer servers={(data ?? []) as GameServer[]} />
        )}
        <p className="mt-8 text-xs leading-5 text-zinc-500">
          O acesso depende da disponibilidade do servidor e das permissões do
          jogo. Os links abrem em uma nova aba.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
