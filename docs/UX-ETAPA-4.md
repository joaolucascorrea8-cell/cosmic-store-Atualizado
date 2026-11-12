# UX 4 — hierarquia do produto

Um único H1, com jogo/categoria e disponibilidade no cabeçalho do item. Desktop mantém arte à esquerda e compra à direita; mobile limita a área visual da arte entre 220–280 px e mantém object-fit:contain, sem cortes ou distorção. Preço, estoque, prazo conhecido e botão principal vêm antes da descrição longa; nenhuma descrição ou instrução foi removida. Favoritos/reposição, compartilhamento, relacionados e carrinho continuam disponíveis. Não foi criada barra fixa que pudesse cobrir conteúdo/chat, nem alterado o comportamento do botão de compra.

Validação: build fictício passa, 126 testes aprovados e lint/TypeScript sem avisos ou erros. Executor UX passou 27 verificações em 390/1440: um H1, imagem contain, botão principal dentro dos 900 px de altura no fixture mobile, pesquisa/Enter, chips, Escape/foco, filtro/limpar, carrinho legado, dois jogos e confirmação interceptada com QR fictício. Zero imagens quebradas, overflow ou erros JS nas dez páginas principais. Capturas em /workspace/scratch/cosmic-ux-review/etapa4/after; antes em /workspace/scratch/cosmic-ux-review/before.

O teste de primeira dobra usa título curto e viewport 390×900. Não é promessa para todas as alturas, títulos longos ou zoom; o layout continua rolável e a imagem proporcional. Interações de checkout usam dados fictícios, sem cobrar ou criar pedido no backend real. A regra de um nickname por pedido permanece intacta; mudanças de regra ou snapshots históricos imutáveis de jogo/categoria exigem proposta e autorização separadas.

Sem migração, dados reais ou deploy. Build .next aponta para Supabase fictício e NÃO deve ser implantado.
