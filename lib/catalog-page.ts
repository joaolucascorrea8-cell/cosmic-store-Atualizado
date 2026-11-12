type PageResult<T> = { data: T[] | null; error: { message: string; code?: string } | null; count: number | null };
type PageQuery<T> = { range(from: number, to: number): PromiseLike<PageResult<T>> };
export async function loadCatalogPage<T>(query: PageQuery<T>, requested: number) {
  const wanted = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  let result = await query.range((wanted - 1) * 24, wanted * 24 - 1);
  let fetchedPage = wanted;
  // PostgREST retorna 416/PGRST103 sem count quando o offset excede o total.
  // Só nesse caso, lê a primeira página para descobrir o limite com segurança.
  if (wanted > 1 && result.error?.code === "PGRST103") {
    result = await query.range(0, 23);
    fetchedPage = 1;
  }
  if (result.error) return { ...result, page: wanted };
  if (result.count === null) return { ...result, data: null, error: { message: "Não foi possível contar os produtos." }, page: wanted };
  const page = Math.min(wanted, Math.max(1, Math.ceil(result.count / 24)));
  if (page !== fetchedPage) result = await query.range((page - 1) * 24, page * 24 - 1);
  return { ...result, page };
}
