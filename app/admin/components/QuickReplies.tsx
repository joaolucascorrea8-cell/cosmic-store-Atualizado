"use client";
const replies = {
  order: [
    {
      label: "Entrega",
      text: "Olá! O pagamento foi confirmado e estamos preparando sua entrega. Confira se o nickname informado no pedido está correto.",
    },
    {
      label: "Nickname",
      text: "Pode confirmar seu nickname no jogo para combinarmos a entrega?",
    },
    {
      label: "Disponibilidade",
      text: "Estamos prontos para entregar. Você está disponível no jogo agora?",
    },
  ],
  support: [
    {
      label: "Boas-vindas",
      text: "Olá! Vamos ajudar você. Pode contar um pouco mais sobre o que aconteceu?",
    },
    {
      label: "Código do pedido",
      text: "Pode informar o código do seu pedido para verificarmos?",
    },
    {
      label: "Resolvido",
      text: "Conseguimos resolver sua solicitação. Precisa de ajuda com mais alguma coisa?",
    },
  ],
};
export default function QuickReplies({
  scope,
  onChoose,
  disabled,
}: {
  scope: keyof typeof replies;
  onChoose: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-3">
      <p className="mb-2 text-[11px] text-zinc-500">
        Respostas rápidas · escolha, revise e envie
      </p>
      <div className="flex flex-wrap gap-2">
        {replies[scope].map((reply) => (
          <button
            type="button"
            key={reply.label}
            disabled={disabled}
            className="admin-small-button"
            onClick={() => onChoose(reply.text)}
          >
            {reply.label}
          </button>
        ))}
      </div>
    </div>
  );
}
