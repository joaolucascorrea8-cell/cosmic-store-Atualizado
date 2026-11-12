O catálogo de categorias carregava todos os produtos para mostrar uma página, e leituras independentes atrasavam a montagem do HTML. Esta alteração limita a listagem comum a 24 itens, paraleliza consultas públicas e evita repetir o processamento de imagens idênticas. Os componentes do navegador recebem apenas os campos que já utilizam.

- Imagens: WebP lossless e validações preservados; cache público por processo com 60 segundos, 64 entradas e 16 MB; requisições iguais compartilham processamento; suporte a ETag/304.
- Categoria: mantém busca por prefixos/acentos, ordenação pt-BR, isolamento por jogo, filtros e contagens. Trata o HTTP 416 real do PostgREST sem esconder erros de permissão.
- Preservação: sem mudança visual, autenticação, carrinho, regras comerciais, pagamentos, pedidos, RLS, migrations, variáveis reais ou configurações da conta Vercel. HTML e dados comerciais continuam dinâmicos e sem cache público.
- Proteção: deploy automático desabilitado somente para esta branch; nenhum deploy ou merge executado.

Validação local isolada: lint e TypeScript; 167 testes; 15 cenários de compra, incluindo Google/Discord simulados; 13 cenários administrativos; nove verificações de histórico; 27 verificações UX; sete regressões públicas; executores de desempenho antes/depois. Doze screenshots em 390/1440px tiveram zero pixels diferentes, textos e geometrias idênticos.

Com 120 ms artificiais por chamada REST, a mediana até o HTML completo caiu de 389 para 258 ms no jogo, 409 para 271 ms na categoria e 392 para 260 ms no produto. A categoria transferiu 24 linhas em vez de 60. Cinco solicitações de imagem passaram de cinco buscas na origem para uma, com os mesmos 52.402 bytes por resposta. Resultados de laboratório: o LCP teve variação nos dois sentidos e não comprova melhoria consistente. Não há nova medição de INP de campo nem certificação dos provedores reais.

O domínio de produção e a API GitHub foram bloqueados pelo proxy deste ambiente. O build local é fictício e não deve ser implantado. Rever medições na hospedagem apropriada antes de autorizar publicação.

Relatório e limitações: [docs/DESEMPENHO-20261112.md](https://github.com/joaolucascorrea8-cell/cosmic-store-Atualizado/blob/perf/cosmic-store-20261112/docs/DESEMPENHO-20261112.md). Evidências: `qa/results/perf-20261112-*.json`.
