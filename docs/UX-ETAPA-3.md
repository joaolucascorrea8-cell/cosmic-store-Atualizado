# UX 3 — catálogo mobile

Pesquisa sempre visível. No mobile, Filtros expande/recolhe ordenação, jogo, categoria e disponibilidade; no desktop esses controles permanecem expostos. O painel é uma expansão inline (não modal), com aria-expanded/controls; Escape fecha e devolve foco ao botão. Campos recolhidos ficam fora da navegação por CSS, sem duplicar inputs.

Chips visíveis representam busca, jogo, categoria, ordem e disponibilidade; remoção individual atualiza a URL. Remover/trocar jogo também limpa categoria como no fluxo anterior. Limpar filtros continua disponível fora do painel. Paginação, prefixos/acentos, ordenação e dados de estoque não mudaram. A grade mantém dois cards no mobile e a identidade visual existente.

Build fictício, TypeScript, lint sem avisos e 25 verificações UX passaram a 390/1440 px: painel inicialmente fechado só no mobile, pesquisa visível, abertura, Escape/foco, chips/remoção do jogo e restauração de resultados; demais cenários de carrinho/checkout/contexto preservados. Capturas em /workspace/scratch/cosmic-ux-review/etapa3/after. Nenhuma escrita real, migração ou publicação.
