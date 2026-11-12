export async function notificationFetch(url: string, init: RequestInit, fetcher: typeof fetch = fetch) {
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Canal de notificação recusou o envio (HTTP ${response.status}).`);
  return response;
}
