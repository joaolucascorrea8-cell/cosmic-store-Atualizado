"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { CSV_HEADERS, exportCsv } from "@/lib/product-csv";
import { money } from "@/lib/catalog";
import { previewImport, importProducts, type ImportRow } from "./actions";
export default function Importer() {
  const [text, setText] = useState(""),
    [rate, setRate] = useState("34,00"),
    [rows, setRows] = useState<ImportRow[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [token, setToken] = useState(""),
    [page, setPage] = useState(0),
    [pending, start] = useTransition();
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportCsv([CSV_HEADERS])], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-produtos-cosmic.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div
      className="mt-6 space-y-5"
      data-live-dirty={Boolean(text || rows.length)}
      data-live-busy={pending}
    >
      <section className="admin-panel">
        <h2 className="text-lg font-bold">Preparar a planilha</h2>
        <p className="mt-3 text-sm text-zinc-400">
          Baixe o modelo e abra no Excel ou Google Planilhas. Salve como CSV
          UTF-8. Use o nome ou identificador do jogo e da categoria já
          cadastrados. Limite: 500 produtos e 500 KB.
        </p>
        <button className="btn-secondary mt-4" onClick={download}>
          Baixar modelo CSV
        </button>
        <p className="mt-3 text-sm text-zinc-400">
          Preencha o preço em reais ou deixe a célula vazia e informe os Robux.
          Estoque vazio vira zero; ilimitado aceita sim ou nao. As imagens são
          adicionadas depois pelo catálogo.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="admin-label">
            Arquivo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="admin-input mt-2"
              disabled={pending}
              onChange={async (e) => {
                setRows([]);
                setMessage("");
                setError("");
                setText("");
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 512000) {
                  setError("O arquivo deve ter até 500 KB.");
                  return;
                }
                const value = await f.text();
                if (value.includes("\uFFFD")) {
                  setError(
                    "Salve a planilha como CSV UTF-8 e envie novamente.",
                  );
                  return;
                }
                setText(value);
              }}
            />
          </label>
          <label className="admin-label">
            Cotação para linhas com Robux e sem preço
            <input
              className="admin-input mt-2"
              value={rate}
              inputMode="decimal"
              disabled={pending}
              onChange={(e) => {
                setRate(e.target.value);
                setRows([]);
              }}
            />
          </label>
        </div>
        <button
          className="btn-primary mt-4"
          disabled={!text || pending}
          onClick={() =>
            start(async () => {
              setError("");
              const r = await previewImport(text, rate);
              if (r.error) setError(r.error);
              else {
                setRows(r.rows ?? []);
                setToken(crypto.randomUUID());
                setPage(0);
              }
            })
          }
        >
          {pending ? "Conferindo…" : "Conferir planilha"}
        </button>
      </section>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {message && (
        <div role="status" className="admin-success">
          {message}
          <Link
            className="mt-2 block underline"
            href="/admin/produtos?catalogo=1&status=inactive#catalogo-produtos"
          >
            Revisar os produtos ocultos →
          </Link>
        </div>
      )}
      {rows.length > 0 && (
        <section className="admin-panel">
          <h2 className="text-lg font-bold">Prévia · {rows.length} produtos</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Todos serão criados ocultos. Produtos existentes não serão
            substituídos.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-zinc-400">
                  <th className="p-2">Produto</th>
                  <th className="p-2">Categoria</th>
                  <th className="p-2">Preço</th>
                  <th className="p-2">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(page * 50, (page + 1) * 50).map((r, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.category_label}</td>
                    <td className="whitespace-nowrap p-2">{money(r.price)}</td>
                    <td className="p-2">
                      {r.unlimited_stock ? "Ilimitado" : r.stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && (
            <div className="mt-4 flex gap-3">
              <button
                className="admin-small-button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span>
                {page + 1}/{Math.ceil(rows.length / 50)}
              </span>
              <button
                className="admin-small-button"
                disabled={(page + 1) * 50 >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </button>
            </div>
          )}
          <button
            className="btn-primary mt-5"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(`Cadastrar os ${rows.length} produtos como ocultos?`)
              )
                return;
              start(async () => {
                const r = await importProducts(text, rate, token);
                if (r.error) setError(r.error);
                else {
                  setMessage(r.success ?? "");
                  setRows([]);
                  setText("");
                }
              });
            }}
          >
            Importar produtos conferidos
          </button>
        </section>
      )}
    </div>
  );
}
