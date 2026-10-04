"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import ProductImageUpload from "@/app/admin/produtos/ProductImageUpload";
import { normalizeSearch } from "@/lib/catalog";
import type { GameServer } from "@/lib/game-servers";
import {
  saveGameServer,
  deleteGameServer,
  type ServerAdminState,
} from "./actions";
function ServerEditor({
  server,
  games,
}: {
  server?: GameServer;
  games: string[];
}) {
  const [state, action, pending] = useActionState<ServerAdminState, FormData>(
    saveGameServer,
    { error: null },
  );
  const [deleted, remove, removing] = useActionState<
    ServerAdminState,
    FormData
  >(deleteGameServer, { error: null });
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const prefix = server?.id ?? "new";
  useEffect(() => {
    if (!state.success) return;
    queueMicrotask(() => {
      setDirty(false);
      if (!server) {
        form.current?.reset();
        setImageKey((key) => key + 1);
      }
    });
  }, [state.success, server]);
  return (
    <div
      data-live-dirty={dirty}
      data-live-busy={pending || removing || uploading}
    >
      <form
        ref={form}
        action={action}
        onChange={() => setDirty(true)}
        className="space-y-4"
      >
        <input type="hidden" name="id" value={server?.id ?? ""} />
        <input
          type="hidden"
          name="expected_updated_at"
          value={server?.updated_at ?? ""}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${prefix}-game`} className="admin-label">
              Nome do jogo
            </label>
            <input
              id={`${prefix}-game`}
              name="game_name"
              list="admin-server-games"
              defaultValue={server?.game_name}
              required
              minLength={2}
              maxLength={100}
              className="admin-input"
              placeholder="Pode ser um jogo fora do catálogo"
            />
          </div>
          <div>
            <label htmlFor={`${prefix}-name`} className="admin-label">
              Nome do servidor
            </label>
            <input
              id={`${prefix}-name`}
              name="name"
              defaultValue={server?.name ?? "Servidor VIP"}
              required
              minLength={2}
              maxLength={100}
              className="admin-input"
              placeholder="Ex.: Servidor 1 — Farm"
            />
          </div>
        </div>
        <datalist id={`server-suggestions-${prefix}`}>
          {games.map((game) => (
            <option key={game} value={game} />
          ))}
        </datalist>
        <div>
          <label htmlFor={`${prefix}-url`} className="admin-label">
            Link para entrar
          </label>
          <input
            id={`${prefix}-url`}
            name="join_url"
            type="url"
            defaultValue={server?.join_url}
            required
            maxLength={2048}
            className="admin-input"
            placeholder="https://www.roblox.com/share?..."
          />
          <p className="mt-1 text-xs text-zinc-500">
            O cliente verá o nome do jogo e o botão de entrada. O endereço fica
            associado a eles.
          </p>
        </div>
        <div>
          <label htmlFor={`${prefix}-description`} className="admin-label">
            Instruções (opcional)
          </label>
          <textarea
            id={`${prefix}-description`}
            name="description"
            defaultValue={server?.description}
            maxLength={600}
            rows={3}
            className="admin-input"
            placeholder="Ex.: Entre com sua conta Roblox. Servidor para farm."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${prefix}-active`} className="admin-label">
              Visibilidade
            </label>
            <select
              id={`${prefix}-active`}
              name="is_active"
              defaultValue={String(server?.is_active ?? true)}
              className="admin-input"
            >
              <option value="true">Publicado</option>
              <option value="false">Oculto</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${prefix}-order`} className="admin-label">
              Posição na página
            </label>
            <input
              id={`${prefix}-order`}
              name="display_order"
              type="number"
              min={0}
              max={1000000}
              step={1}
              defaultValue={server?.display_order ?? ""}
              className="admin-input"
              placeholder="Automática ao cadastrar"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Números menores aparecem primeiro.
            </p>
          </div>
        </div>
        <div>
          <label htmlFor={`${prefix}-availability`} className="admin-label">
            Estado do servidor
          </label>
          <select
            id={`${prefix}-availability`}
            name="availability"
            defaultValue={server?.availability ?? "available"}
            className="admin-input"
          >
            <option value="available">Disponível</option>
            <option value="maintenance">Em manutenção</option>
            <option value="unavailable">Temporariamente indisponível</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Este estado é definido pela equipe. Não mede a lotação ao vivo.
            Enquanto indisponível, o botão de entrada fica desativado.
          </p>
        </div>
        <div>
          <p className="admin-label">Capa (opcional)</p>
          <ProductImageUpload
            key={imageKey}
            inputId={`${prefix}-image`}
            defaultValue={server?.image_url}
            onChange={() => setDirty(true)}
            onUploadingChange={setUploading}
          />
        </div>
        {state.error && (
          <p role="alert" className="admin-error">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-emerald-300">
            {state.success}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            disabled={pending || uploading || removing}
            className="btn-primary flex-1"
          >
            {pending
              ? "Salvando…"
              : server
                ? "Salvar servidor"
                : "Cadastrar servidor"}
          </button>
          <button
            type="reset"
            disabled={pending || uploading || removing}
            onClick={() => {
              setDirty(false);
              setImageKey((key) => key + 1);
            }}
            className="btn-secondary"
          >
            Descartar alterações
          </button>
        </div>
      </form>
      {server && (
        <form
          action={remove}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"
          onSubmit={(event) => {
            if (
              !window.confirm(`Excluir ${server.name} de ${server.game_name}?`)
            )
              event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={server.id} />
          <input
            type="hidden"
            name="expected_updated_at"
            value={server.updated_at}
          />
          <p className="text-xs text-zinc-500">
            Oculte antes de excluir definitivamente.
          </p>
          <button
            disabled={server.is_active || removing || pending}
            className="admin-small-button text-red-300 disabled:opacity-40"
          >
            {removing ? "Excluindo…" : "Excluir servidor"}
          </button>
          {deleted.error && (
            <p role="alert" className="admin-error w-full">
              {deleted.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
export default function ServerManager({
  servers,
  games,
}: {
  servers: GameServer[];
  games: string[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = servers.filter(
    (server) =>
      normalizeSearch(`${server.game_name} ${server.name}`).includes(
        normalizeSearch(q),
      ) &&
      (status === "all" || server.is_active === (status === "active")),
  );
  return (
    <>
      <datalist id="admin-server-games">
        {games.map((game) => (
          <option key={game} value={game} />
        ))}
      </datalist>
      <details className="admin-form-details mt-6">
        <summary>
          <span>+ Cadastrar servidor</span>
          <span>⌄</span>
        </summary>
        <div className="mt-5 border-t border-white/10 pt-5">
          <ServerEditor games={games} />
        </div>
      </details>
      <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar servidor"
          placeholder="Buscar jogo ou servidor…"
          className="admin-input"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Visibilidade dos servidores"
          className="admin-input"
        >
          <option value="all">Todos</option>
          <option value="active">Publicados</option>
          <option value="hidden">Ocultos</option>
        </select>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {filtered.length} servidor(es) · Filtros preservados durante
        atualizações automáticas.
      </p>
      <div className="mt-4 space-y-3">
        {filtered.map((server) => (
          <details key={server.id} className="admin-item-details">
            <summary>
              <span className="min-w-0 flex-1">
                <strong className="block break-words text-sm">
                  {server.game_name}
                </strong>
                <small className="text-zinc-400">
                  {server.name} · Posição {server.display_order} ·{" "}
                  {server.is_active ? "Publicado" : "Oculto"}
                </small>
              </span>
              <span className="shrink-0 text-xs text-violet-300">Editar ⌄</span>
            </summary>
            <div className="mt-5 border-t border-white/10 pt-5">
              <ServerEditor
                key={`${server.id}-${server.updated_at}`}
                server={server}
                games={games}
              />
            </div>
          </details>
        ))}
      </div>
      {!filtered.length && (
        <p className="mt-5 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-400">
          {servers.length
            ? "Nenhum servidor corresponde aos filtros."
            : "Cadastre seu primeiro servidor para aparecer na loja."}
        </p>
      )}
    </>
  );
}
