import Link from "next/link";
export default function Pagination({
  page,
  total,
  pageSize = 24,
  pathname,
  params = {},
}: {
  page: number;
  total: number;
  pageSize?: number;
  pathname: string;
  params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages < 2) return null;
  const href = (n: number) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });
    q.set("pagina", String(n));
    return `${pathname}?${q}`;
  };
  return (
    <nav
      aria-label="Paginação"
      className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <span className="text-zinc-400">
        Página {page} de {pages} · {total} resultados
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="btn-secondary" href={href(page - 1)}>
            Anterior
          </Link>
        ) : (
          <span className="btn-secondary opacity-30">Anterior</span>
        )}
        {page < pages ? (
          <Link className="btn-secondary" href={href(page + 1)}>
            Próxima
          </Link>
        ) : (
          <span className="btn-secondary opacity-30">Próxima</span>
        )}
      </div>
    </nav>
  );
}
