export const descriptionTemplates = [
  {
    name: "Item digital",
    text: "{{produto}} para {{jogo}}.\n\nApós a confirmação do pagamento, combinamos a entrega pelo chat do pedido. Informe seu nickname corretamente no checkout.",
  },
  {
    name: "Fruta permanente",
    text: "{{produto}} para {{jogo}}. Produto na versão permanente.\n\nA entrega é combinada pelo chat do pedido após a confirmação do pagamento. Confira seu nickname no checkout e siga as orientações da equipe para receber no jogo.",
  },
  {
    name: "Fruta física",
    text: "{{produto}} para {{jogo}}, na versão física. Este item não é uma fruta permanente.\n\nA entrega ocorre dentro do jogo, combinada pelo chat do pedido após a confirmação do pagamento. Consulte os requisitos de troca antes de comprar.",
  },
  {
    name: "Gamepass",
    text: "{{produto}} para {{jogo}}.\n\nConfira os benefícios e requisitos deste passe antes da compra. Após a confirmação do pagamento, a equipe combina a entrega pelo chat do pedido.",
  },
];
export function applyDescriptionTemplate(
  template: string,
  product: string,
  game: string,
) {
  return template
    .replaceAll("{{produto}}", product.trim() || "Nome do produto")
    .replaceAll("{{jogo}}", game.trim() || "Nome do jogo")
    .slice(0, 2000);
}
