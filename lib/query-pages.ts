// Read every page when the UI needs a complete catalog for search or manual ordering.
// Supabase limits each response; stable ordering must be provided by the caller.
type Result<T> = {
  data: T[] | null;
  error: { message: string; code?: string } | null;
};
type Query<T> = { range(from: number, to: number): PromiseLike<Result<T>> };
export async function allRows<T>(query: Query<T>): Promise<Result<T>> {
  const data: T[] = [];
  let offset = 0;
  for (;;) {
    const result = await query.range(offset, offset + 499);
    if (result.error) return { data: null, error: result.error };
    const rows = result.data ?? [];
    data.push(...rows);
    if (rows.length < 500) return { data, error: null };
    offset += 500;
  }
}
