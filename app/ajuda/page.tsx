export const metadata = {
  title: "Central de ajuda",
  description:
    "Entenda o Pix, o comprovante e como acompanhar a entrega do seu pedido.",
  alternates: { canonical: "/ajuda" },
};
import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";

const faqs = [
  {
    id: "servidores",
    question: "Como entro em um servidor ou peço outro jogo?",
    answer: (
      <div className="space-y-3">
        <p>
          Abra{" "}
          <Link href="/servidores" className="font-bold text-violet-300">
            Servidores
          </Link>
          , escolha o jogo e clique em Entrar no servidor. O link abre em uma
          nova aba; o acesso depende das permissões do jogo e da
          disponibilidade.
        </p>
        <p>
          Para pedir um servidor VIP, entre na sua conta e clique em Pedir
          servidor. Escreva o nome do jogo, mesmo que ele ainda não esteja no
          catálogo, e explique seu pedido. A equipe responde pela conversa em
          Meus atendimentos. A solicitação não gera uma compra nem garante a
          criação do servidor.
        </p>
      </div>
    ),
  },
  {
    id: "entrega",
    question: "Como funciona a entrega?",
    answer: (
      <div className="space-y-3">
        <p>
          Você escolhe o produto, informa o nickname do jogo, cria o pedido e
          paga via Pix. Depois, envia o comprovante pelo próprio checkout.
        </p>
        <p>
          Quando a equipe confirmar o pagamento, o chat do pedido é liberado
          para combinar e acompanhar a entrega. O andamento também aparece em{" "}
          <strong>Meus pedidos</strong>.
        </p>
      </div>
    ),
  },
  {
    id: "fisica-permanente",
    question:
      "Qual a diferença entre fruta física e fruta permanente no Blox Fruits?",
    answer: (
      <div className="space-y-3">
        <p>
          <strong>Fruta física</strong> é o item entregue dentro do jogo como
          fruta física. Ela não libera permanentemente a fruta na conta.
        </p>
        <p>
          <strong>Fruta permanente</strong> é a versão permanente indicada no
          anúncio. Confira sempre o nome, a categoria e a descrição do produto
          antes de comprar.
        </p>
      </div>
    ),
  },
  {
    id: "comprovante",
    question: "Como envio o comprovante do Pix?",
    answer: (
      <div className="space-y-3">
        <p>
          Depois de criar o pedido, a tela do Pix mostra a área para anexar o
          comprovante. São aceitos os formatos indicados na própria tela.
        </p>
        <p>
          Se o comprovante for recusado por imagem ilegível, valor incorreto ou
          outro motivo, o pedido mostra o motivo e libera o reenvio.
        </p>
      </div>
    ),
  },
  {
    id: "acompanhar",
    question: "Onde acompanho meu pedido?",
    answer: (
      <p>
        Abra{" "}
        <Link
          href="/pedidos"
          className="font-bold text-violet-300 hover:text-violet-200"
        >
          Meus pedidos
        </Link>
        . Lá você vê o status, o prazo exibido para a entrega, as mensagens da
        equipe e o histórico do pedido.
      </p>
    ),
  },
  {
    id: "email",
    question: "Não recebi um e-mail da Cosmic Store. E agora?",
    answer: (
      <div className="space-y-3">
        <p>
          Confira Spam, Lixo eletrônico e Promoções. Os e-mails são uma forma
          extra de aviso: o status oficial da compra continua disponível dentro
          da sua conta, em <strong>Meus pedidos</strong>.
        </p>
        <p>
          Se você digitou o e-mail errado ao criar a conta ou precisa de ajuda,
          abra um atendimento pelo suporte.
        </p>
      </div>
    ),
  },
  {
    id: "cadastro",
    question: "Preciso confirmar meu e-mail para criar a conta?",
    answer: (
      <p>
        Não. No fluxo novo, a conta por e-mail e senha entra direto após o
        cadastro. Por isso, confira o endereço com atenção: ele é usado para
        recuperação de senha e avisos dos pedidos.
      </p>
    ),
  },
  {
    id: "discord",
    question: "Posso entrar com Discord?",
    answer: (
      <div className="space-y-3">
        <p>
          Sim. O Discord continua disponível como opção de entrada. Se estiver
          usando o navegador interno do TikTok, Instagram ou Facebook, abra a
          Cosmic Store no Chrome, Opera ou navegador padrão antes de tentar.
        </p>
      </div>
    ),
  },
  {
    id: "seguranca",
    question: "O que nunca devo enviar no chat?",
    answer: (
      <p>
        Nunca envie senha, código de autenticação, token, dados completos do
        cartão ou acesso à sua conta. Para a entrega, use somente as informações
        solicitadas pela Cosmic Store dentro do pedido.
      </p>
    ),
  },
];

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="shell py-12 md:py-16"
      >
        <section className="mx-auto max-w-4xl">
          <p className="eyebrow">AJUDA RÁPIDA</p>
          <h1 className="section-title">Como funciona a Cosmic Store</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
            As respostas principais sobre cadastro, pagamento, comprovante,
            entrega e acompanhamento do pedido em um só lugar.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              ["1", "Escolha o item", "Confira o tipo e a descrição"],
              ["2", "Pague via Pix", "Use o valor do pedido"],
              ["3", "Envie o comprovante", "A equipe faz a conferência"],
              ["4", "Acompanhe a entrega", "Tudo pelo pedido e chat"],
            ].map(([number, title, detail]) => (
              <div
                key={number}
                className="rounded-2xl border border-white/10 bg-white/[.025] p-4"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 text-xs font-black text-violet-200">
                  {number}
                </span>
                <strong className="mt-3 block text-sm">{title}</strong>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
              </div>
            ))}
          </div>

          <section className="mt-10" aria-labelledby="faq-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">DÚVIDAS FREQUENTES</p>
                <h2 id="faq-title" className="mt-2 text-2xl font-black">
                  Respostas rápidas
                </h2>
              </div>
              <Link
                href="/pedidos"
                className="text-sm font-bold text-violet-300 hover:text-white"
              >
                Acompanhar meus pedidos →
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {faqs.map((faq) => (
                <details
                  key={faq.id}
                  id={faq.id}
                  className="group scroll-mt-24 rounded-2xl border border-white/10 bg-white/[.025] p-5 open:border-violet-400/25 open:bg-violet-500/[.05]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-zinc-100">
                    <span>{faq.question}</span>
                    <span
                      className="shrink-0 text-xl text-violet-300 transition group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <div className="mt-4 border-t border-white/10 pt-4 text-sm leading-7 text-zinc-400">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-violet-400/20 bg-violet-500/10 p-6 sm:p-8">
            <p className="eyebrow">AINDA PRECISA DE AJUDA?</p>
            <h2 className="mt-2 text-2xl font-black">Fale com a equipe</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
              Se a dúvida for sobre uma compra, tenha o código do pedido em
              mãos. O suporte particular fica vinculado à sua conta.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/suporte" className="btn-primary">
                Abrir suporte
              </Link>
              <Link href="/pedidos" className="btn-secondary">
                Ver meus pedidos
              </Link>
            </div>
          </section>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
