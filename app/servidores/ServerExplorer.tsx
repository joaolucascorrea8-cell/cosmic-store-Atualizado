"use client";
import ReportServer from "./ReportServer";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Icon from "@/app/components/Icon";
import { normalizeSearch } from "@/lib/catalog";
import {
  serverAvailability,
  serverJoinUrl,
  type GameServer,
} from "@/lib/game-servers";
export default function ServerExplorer({ servers }: { servers: GameServer[] }) {
  const [q, setQ] = useState("");
  const visible = servers.filter((server) =>
    normalizeSearch(`${server.game_name} ${server.name}`).includes(
      normalizeSearch(q),
    ),
  );
  const groups = new Map<string, GameServer[]>();
  for (const server of visible) {
    const key = normalizeSearch(server.game_name.trim()).replace(/\s+/g, " ");
    groups.set(key, [...(groups.get(key) ?? []), server]);
  }
  return (
    <>
      {servers.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="w-full sm:max-w-sm">
            <label htmlFor="server-search" className="sr-only">
              Buscar servidor pelo jogo ou nome
            </label>
            <input
              id="server-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="admin-input"
              placeholder="Buscar jogo ou servidor…"
            />
          </div>
          <p className="text-xs text-zinc-400">
            {visible.length}{" "}
            {visible.length === 1
              ? "servidor encontrado"
              : "servidores encontrados"}
          </p>
        </div>
      )}
      {[...groups].map(([key, list]) => (
        <section key={key} className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xl font-black">{list[0].game_name}</h2>
            <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-400">
              {list.length} {list.length === 1 ? "servidor" : "servidores"}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((server) => {
              const url = serverJoinUrl(server.join_url);
              const available =
                !server.availability || server.availability === "available";
              if (!url) return null;
              return (
                <article
                  key={server.id}
                  className="surface flex flex-col overflow-hidden rounded-2xl transition hover:border-violet-500/40"
                >
                  <a
                    href={available ? url : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                    aria-disabled={!available}
                    aria-label={`Entrar no servidor ${server.name} de ${server.game_name} (abre em nova aba)`}
                  >
                    <div className="relative grid h-36 place-items-center overflow-hidden bg-gradient-to-br from-violet-500/20 via-[#17131f] to-indigo-500/10">
                      {server.image_url ? (
                        <Image
                          src={server.image_url}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 380px"
                          className="object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <Icon
                          name="gamepad"
                          className="h-16 w-16 text-violet-300/70"
                        />
                      )}
                    </div>
                    <div className="px-5 pt-5">
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-300">
                        Servidor VIP
                      </p>
                      <h3 className="mt-2 break-words text-xl font-black group-hover:text-violet-200">
                        {server.name}
                      </h3>
                      <p className="mt-1 break-words text-sm font-semibold text-zinc-400">
                        {serverAvailability[server.availability ?? "available"]}
                      </p>
                    </div>
                  </a>
                  <p className="mb-5 mt-3 whitespace-pre-line break-words px-5 text-sm leading-6 text-zinc-400">
                    {server.description || "Abra o link para entrar e jogar."}
                  </p>
                  <div className="mt-auto px-5 pb-5">
                    <a
                      href={available ? url : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`btn-primary flex w-full items-center justify-center gap-2 ${available ? "" : "pointer-events-none opacity-50"}`}
                      aria-disabled={!available}
                      aria-label={`Entrar em ${server.game_name} — ${server.name} (abre em nova aba)`}
                    >
                      {available
                        ? "Entrar no servidor"
                        : serverAvailability[
                            server.availability ?? "unavailable"
                          ]}{" "}
                      {available && <Icon name="arrow" className="h-4 w-4" />}
                    </a>
                    <ReportServer serverId={server.id} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {!visible.length && (
        <div className="empty-store-state py-12">
          <Icon
            name="gamepad"
            className="mx-auto mb-4 h-10 w-10 text-violet-300"
          />
          <h2 className="text-lg font-bold text-white">
            {servers.length
              ? "Nenhum servidor encontrado"
              : "Novos servidores em breve"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6">
            {servers.length
              ? "Tente outro nome ou peça o servidor do seu jogo."
              : "Peça o servidor do jogo que você gostaria de ver por aqui."}
          </p>
          <Link
            href="/servidores/pedir"
            className="btn-secondary mt-5 inline-flex"
          >
            Pedir servidor
          </Link>
        </div>
      )}
    </>
  );
}
