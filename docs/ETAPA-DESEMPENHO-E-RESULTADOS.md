# Desempenho e resultado consolidado

## Alterações

- Produto, categoria e jogo são resolvidos por uma consulta PostgREST relacionada com inner joins e filtro de jogo ativo. Com relacionados, quatro leituras principais passam a duas, conferidas no executor isolado.
- Catálogo sem busca usa range de 24 produtos, count exato, filtros de jogo/categoria/estoque e ordenação por preço no banco. Página além do fim é recalculada para a última. Não carrega todos os produtos para mostrar a primeira página.
- Busca por prefixos/acentos e ordenação por nome pt-BR conservam o processamento anterior para não mudar semântica de pesquisa/colação sem migração. Esses caminhos ainda podem ler todo o catálogo: pendência de escala, não eliminada nesta etapa.
- Prefetch especulativo dos cards foi desativado: a leitura no clique continua normal, mas o cliente deixa de pré-carregar inúmeros detalhes ao rolar. Tradeoff: a primeira navegação ao produto pode perder o benefício do prefetch.
- Atualização por Realtime e polling existente foi preservada; nenhum pedido, preço ou estoque foi cacheado entre usuários.

## Método de laboratório

Chromium Linux, Node 24.22.1, Next 16.4.6, CPU limitada a 4x; sem throttling de rede, Supabase fictício e imagem sintética local, 60 produtos. Três contextos frios por página e largura (390 e 1440), mediana para TTFB/LCP/CLS. Cache do processo/CDN não é equivalente ao cache do provedor. A máquina é compartilhada; amostra pequena e rede local não permitem inferir ganhos de produção. Os resultados antes/depois abaixo já têm imagens funcionais; o baseline anterior à correção de imagens não serve como comparação visual equivalente.

| Largura | Página | LCP antes → depois (ms) | TTFB antes → depois (ms) | CLS depois |
| --- | --- | --- | --- | --- |
| 390 | Inicial | 712 → 804 | 35,3 → 138,0 | 0 |
| 390 | Catálogo | 856 → 792 | 32,4 → 42,4 | 0 |
| 390 | Produto | 724 → 724 | 34,0 → 38,7 | 0 |
| 1440 | Inicial | 748 → 884 | 26,3 → 29,5 | 0 |
| 1440 | Catálogo | 836 → 816 | 43,3 → 26,1 | 0 |
| 1440 | Produto | 836 → 804 | 30,0 → 28,9 | 0 |

Não houve melhora uniforme da latência: inicial variou para cima; produto mobile ficou igual. Não atribuir causalidade nem prometer esses tempos em produção. O benefício verificável é a redução de trabalho: catálogo solicita 24 dos 60 registros; leituras REST observadas no navegador desktop caem de 28 para 4 no catálogo e de 22 para 8 no detalhe (incluem leituras da página e prefetch). No mobile, catálogo 10 → 4 e produto 10 → 8. O perfil HTTP controlado do detalhe foi 4 → 2.

Máxima duração de evento de interação observada ao adicionar ao carrinho: 88 ms no mobile e 120 ms no desktop após mudanças. Isso NÃO é INP de campo nem uma mediana populacional; páginas sem interação registram ausência, não zero. Core Web Vitals de usuários reais (p75 LCP/INP/CLS por 28 dias) continuam pendentes de RUM/CrUX após uma implantação autorizada.

Resultado visual nas 18 navegações finais: zero imagens quebradas, zero overflow. Testes HTTP adicionais: página 2 traz outros 24 produtos; página 999 volta aos 12 produtos da última página; busca por dragon+blox mantém o único resultado correto; preço decrescente inclui o produto mais caro; sitemap/metadados/dados estruturados continuam válidos no fixture. Resultados brutos em qa/results/storefront-before-performance.json e storefront-after.json.

## Validação consolidada

- npm run check: 123 testes aprovados, zero falhas ou pulados; TypeScript passa; lint sem avisos ou erros.
- Builds completos das etapas e execução next start no runtime Node passam, com variáveis fictícias.
- Novos testes cobrem segurança/qualidade/limites das imagens, relações do sitemap, variantes indexáveis e paginação/clamp/erros.
- Executor de homologação administrativa foi adaptado para relações PostgREST e count exato e reexecutado após as mudanças; 13 cenários passaram, usando exclusivamente PGlite, sessões e credenciais fictícias.
- Executor HTTP legado atualizado mantém os cenários de pedidos históricos. As nove verificações HTTP passaram. Evidências em qa/results/admin-catalog-after-storefront.json e order-history-after-storefront.json.

## Hospedagem e pendências

A inspeção não acessou a conta Vercel e não fez deploy. Runtime selecionado no provedor, memória/timeout/limites/cron, bindings de variáveis, cache CDN efetivo e SMTP permanecem sem certificação. A rota de imagens depende de Node/Sharp e tem limite próprio de oito segundos para upstream. Robots permite especificamente a rota pública de imagens, mantendo o bloqueio geral de APIs e áreas privadas.

Mantêm-se os sete apontamentos moderados de lint registrados na etapa de segurança; não foi feita atualização de dependências nesta etapa. Antes de integrar: homologação em provedor separado, RLS/relacionamentos no PostgREST real de homologação e validação Search Console/rich results. Evoluções futuras: busca/paginação por nome no banco com colação adequada, índices apenas após plano EXPLAIN e autorização de migração, sitemap dividido acima de 50 mil URLs e acompanhamento de cache/custo da transformação de fotos reais.

Nada foi publicado, não houve migração nem escrita no banco real. Arquivos originais de imagens e identidade visual foram preservados. Artefatos .next dos executores apontam para Supabase fictício: NÃO implantar; reconstruir com as variáveis corretas do destino somente quando autorizado.
