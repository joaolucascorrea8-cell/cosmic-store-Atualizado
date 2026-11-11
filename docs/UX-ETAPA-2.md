# UX 2 — pesquisa e acesso ao catálogo

Padding específico de 44 px no campo de pesquisa impede que a regra global de inputs sobreponha a lupa. Campo usa enterKeyHint=search e Enter aplica imediatamente a busca, cancelando o debounce anterior. Atualização mantém aria-busy e não muda o algoritmo de prefixos/acentos, filtros, preços ou paginação.

Menu desktop/mobile inclui Produtos. A lupa e Buscar na loja do menu apontam diretamente para /produtos#catalog-search, sem exigir retorno à inicial. O link Produtos identifica a área também no detalhe do item. Cores, tipografia e identidade preservadas.

Validação: build fictício/TypeScript e 21 verificações no Chromium passaram em 390/1440 px, incluindo padding medido >=40 px, Enter, filtros, limpar, estado vazio, busca da inicial, contexto dos jogos, checkout e confirmação interceptada. Nenhum erro JS/overflow/imagem quebrada. Capturas após em /workspace/scratch/cosmic-ux-review/etapa2/after; baseline em /workspace/scratch/cosmic-ux-review/before. Nenhum pedido real ou deploy.
