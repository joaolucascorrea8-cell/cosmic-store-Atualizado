const conversationTitles = new Set([
  "Nova mensagem de pedido",
  "Nova mensagem no seu pedido",
  "Cliente enviou uma imagem",
  "Nova imagem no seu pedido",
  "Nova mensagem no suporte",
  "Cliente enviou uma imagem no suporte",
  "Resposta do suporte",
  "Nova imagem do suporte",
]);
export function normalizeNotificationPath(value?: string | null) {
  const clean = value?.split(/[?#]/)[0] ?? "";
  return clean.length > 1 ? clean.replace(/\/$/, "") : clean;
}
export function isViewedConversation(
  notification: { title?: string; link?: string | null },
  pathname: string,
  visible: boolean,
  focused: boolean,
) {
  return (
    conversationTitles.has(notification.title ?? "") &&
    normalizeNotificationPath(notification.link) ===
      normalizeNotificationPath(pathname) &&
    visible &&
    focused
  );
}
