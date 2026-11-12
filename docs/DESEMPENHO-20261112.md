# Desempenho da Cosmic Store — 12/11/2026

## Escopo e preservação

Branch: `perf/cosmic-store-20261112`. Base: `fa6bc17df8e3ecfa4f88bf9a8e75eb2c398588dd`, merge da revisão anterior na main. Nenhuma alteração foi feita na main, em variáveis reais, na conta Vercel, no banco real, em RLS, funções SQL, migrations ou regras comerciais. Nenhuma compra, pagamento ou notificação real foi executada. Não houve deploy. O build local usa Supabase fictício e não serve para produção.

A única alteração de configuração de hospedagem no repositório impede deploy automático desta branch de desempenho. O cron e a configuração de produção permanecem iguais. Os commits contêm `[skip vercel]`.

## Gargalos observados e correções

1. **Categorias carregavam todos os produtos para exibir 24.** A listagem comum agora usa a paginação já utilizada pelo catálogo geral. Na fixture de 60 itens, a primeira página transfere 24, uma redução de 60% nas linhas. Busca por prefixos/acentos e ordenação pt-BR continuam no caminho completo, mantendo os resultados.
2. **Leituras em sequência.** Categoria e jogo são obtidos em uma consulta com relacionamento e filtro de jogo ativo. Na página do jogo, categorias e contagens são lidas em paralelo; o relacionamento usado para filtrar as contagens não transfere suas colunas. No produto, configurações de atendimento são lidas em paralelo com avaliações e relacionados. Mesmos filtros de visibilidade e cliente Supabase; nenhum cache compartilhado de dados comerciais.
3. **Imagem idêntica era buscada e processada novamente em cada chamada à origem.** Cache por processo, limitado a 64 imagens/16 MB e 60 segundos; requisições concorrentes iguais compartilham processamento, com limite de 16 chaves pendentes. Só respostas 200 de imagens públicas validadas entram no cache. Erros não ficam armazenados. ETag permite resposta 304.
4. **Dados redundantes na hidratação.** Os botões recebem somente os sete campos que já utilizavam. Descrição, relações e instruções continuam renderizadas no servidor; o conteúdo do carrinho e suas regras permanecem iguais.
5. **Compatibilidade de paginação.** Uma consulta real, sem retornar produtos, confirmou que PostgREST responde 416/PGRST103 com count nulo para offset excessivo. O helper agora consulta a primeira página somente nesse caso para descobrir a última. Falhas de permissão/rede continuam explícitas. Isso evita regressão ao aplicar paginação às categorias e corrige o mesmo caso no catálogo geral.

As duas formas novas de relacionamento foram verificadas na API Supabase configurada com GETs limitados a zero linhas: HTTP 200. Isso valida sintaxe/colunas/relacionamentos, não representa EXPLAIN nem certifica o plano de execução do banco usado pela Vercel.

## Imagens, cache, JavaScript e navegação

Foram inspecionados StoreImage, catalog-image-response, catalog-image-url, ProductCard e HomeGameCard. As validações de origem/bucket/nome/largura, limite de 5 MB, conteúdo raster, timeout, 20 MP, proporção e ausência de ampliação foram mantidas. WebP continua lossless, com os mesmos pixels e tamanhos. Não se adotou compressão com perda, AVIF, novos sizes ou alterações de lazy loading/prioridade sem evidência de benefício e qualidade equivalente. As artes da marca não foram regravadas.

O cache local só contém resultados públicos do bucket de catálogo; a chave inclui origem, arquivo e largura. Não contém cookies, perfis, preços, estoque, comprovantes nem URLs assinadas. Os cabeçalhos HTTP anteriores foram preservados. Esse cache não persiste entre processos/cold starts e não substitui o cache CDN. Um primeiro processamento ainda exige download e conversão. Alterações no mesmo arquivo podem aguardar até 60 segundos neste cache, além da política HTTP já existente; novos nomes de arquivo têm chaves independentes.

Mantivemos force-dynamic nas páginas: o cabeçalho/layout possuem sessão e o catálogo exige disponibilidade atual. Não aplicamos ISR ou cache público de HTML/dados. Testes modificam preço/estoque apenas na fixture e exigem resposta seguinte atualizada e HTML sem cache público.

Mantivemos prefetch desabilitado nos cards de produto para evitar 24 leituras especulativas e pré-carregar dados de disponibilidade. Os links, transições e carregamento existentes foram preservados; ambos os tamanhos testaram navegação real por Link. Não houve redução relevante nos bytes JavaScript iniciais; nenhuma funcionalidade de autenticação, favoritos ou notificações foi retirada para reduzir bundle.

## Metodologia e limites

O domínio correto informado foi https://cosmicstore.com.br. O proxy deste ambiente recusou o túnel com HTTP 403 antes de chegar à loja. Não existem medições novas de produção, cold start Vercel, cache HIT da CDN ou Core Web Vitals de campo nesta entrega. Isso não demonstra falha do site.

O executor existente foi rodado antes/depois. O perfil adicional fez 36 navegações por rodada: seis rotas, dois tamanhos (390/1440), três contextos frios do Chromium, CPU 4x, servidor local em execução e 120 ms artificiais por chamada REST/Storage. Imagem raster da própria fixture local; dados fictícios. O navegador bloqueia solicitações externas. Navegação/JavaScript/CLS e screenshots foram registrados. INP de campo não foi medido; Event Timing de poucas interações não o substitui.

Para separar variação de pintura do trabalho do servidor, um segundo ensaio aguardou o HTML completo em cinco chamadas por rota, com a mesma latência simulada. O baseline foi compilado em worktree descartável e separado no commit da main, sem reverter o código da branch.

## HTML completo — mediana de cinco chamadas

| Rota | Antes | Depois | Variação |
| --- | ---: | ---: | ---: |
| `/` | 152 ms | 143 ms | -5.9% |
| `/jogos` | 143 ms | 152 ms | 6.3% |
| `/blox-fruits` | 389 ms | 258 ms | -33.7% |
| `/blox-fruits/frutas` | 409 ms | 271 ms | -33.7% |
| `/produtos` | 278 ms | 267 ms | -4.0% |
| `/produto/dragon` | 392 ms | 260 ms | -33.7% |

Jogo, categoria e produto eliminaram aproximadamente uma rodada de rede neste ensaio. As páginas sem alterações de consultas também variam; não atribuímos toda diferença às otimizações.

## LCP de laboratório e TTFB do início do stream

| Largura | Rota | LCP antes/depois | TTFB antes/depois | CLS antes/depois |
| --- | --- | ---: | ---: | ---: |
| 390px | `/` | 824/660 ms | 40.9/36.2 ms | 0/0 |
| 390px | `/jogos` | 1084/688 ms | 36.0/27.9 ms | 0/0 |
| 390px | `/blox-fruits` | 1088/980 ms | 32.4/22.0 ms | 0/0 |
| 390px | `/blox-fruits/frutas` | 1124/1180 ms | 26.1/27.4 ms | 0/0 |
| 390px | `/produtos` | 832/656 ms | 29.0/33.5 ms | 0/0 |
| 390px | `/produto/dragon` | 964/980 ms | 32.0/39.1 ms | 0/0 |
| 1440px | `/` | 724/780 ms | 24.5/24.7 ms | 0/0 |
| 1440px | `/jogos` | 916/740 ms | 29.5/31.6 ms | 0/0 |
| 1440px | `/blox-fruits` | 980/1196 ms | 22.5/33.9 ms | 0/0 |
| 1440px | `/blox-fruits/frutas` | 1436/1348 ms | 33.9/28.0 ms | 0/0 |
| 1440px | `/produtos` | 1160/1092 ms | 22.4/35.5 ms | 0/0 |
| 1440px | `/produto/dragon` | 1068/1080 ms | 29.1/28.2 ms | 0/0 |

O LCP teve resultados mistos: por exemplo, a categoria mobile variou de 1124 para 1180 ms e a página de jogo desktop de 980 para 1196 ms. Três amostras e este ambiente não permitem afirmar melhoria consistente de LCP/INP. O TTFB é do início do stream, que pode conter o estado de carregamento; não equivale ao catálogo pronto. Os ganhos determinísticos são menos linhas, menos dados redundantes, menos fases sequenciais e menos processamento repetido.

## Imagens repetidas e payload

Cinco leituras da mesma imagem/largura: antes ocorreram cinco buscas à origem; depois, uma. Cada resposta continuou com **52.402 bytes**. As quatro respostas quentes seguintes levaram 7, 3, 4 e 3 ms no ensaio, contra 178, 177, 174 e 179 ms antes. A primeira leitura não melhorou (185/255 ms); o cache beneficia reutilização e não elimina o custo de um miss. Não são números de CDN/produção.

Na fixture, HTML decodificado: catálogo 166.951 → 163.073 bytes; categoria 166.100 → 163.719; produto 63.266 → 61.950. Os bytes de JavaScript iniciais permaneceram equivalentes.

## Visual e testes

Doze screenshots comparativos (seis páginas × 390/1440): **zero pixels diferentes**, textos e geometrias idênticos no cenário registrado. Local: `/workspace/scratch/cosmic-performance/before` e `after`. Screenshots ficam fora do Git; JSONs sanitizados de comparação e medições estão em `qa/results/perf-20261112-*.json`.

- Antes: lint, TypeScript e 159 testes passaram; executor de desempenho existente, 36 navegações adicionais, 27 verificações UX, sete regressões públicas e 14 cenários de compra passaram.
- Depois: lint, TypeScript e **167 testes passaram**, incluindo seis testes novos do cache e dois de compatibilidade de paginação.
- Desempenho existente, 36 navegações, sete regressões públicas (incluindo 416), comparação visual e 27 verificações UX passaram.
- **15 cenários de compra passaram**: carrinho, checkout, Pix manual, comprovante, concorrência/estoque, confirmação, cancelamento/devolução, Game Pass e falhas de notificação.
- Google e Discord: início OAuth, callback PKCE, sessão e cancelamento passaram com Auth simulado. Google foi habilitado somente no processo de teste. Login nos provedores reais, consentimento, envio real de e-mail e entrada em guilda Discord não foram certificados.
- Administração: **13 cenários passaram**. Pedidos históricos: **nove verificações passaram**, incluindo entrega legada, proteção de concorrência e HTTP 410. Resultados nos JSONs específicos.

Nenhum teste sensível usa Supabase, pagamentos ou destinatários reais. Nenhum teste está sendo apresentado como certificação da Vercel ou dos provedores externos.

## Reprodução

Usar Node 24.x, dependências do lockfile e Chromium do sistema ou instalado pelo Playwright. Executores de build compartilham .next e devem rodar em sequência. Para comparar antes/depois, usar um checkout separado do baseline e a mesma versão das ferramentas de QA; não sobrescrever o código da branch. As baterias browser/desempenho desta entrega foram executadas localmente; não se afirma nova execução remota da CI.

```sh
npm run check
npm run test:storefront -- --report=qa/results/perf-20261112-after-existing.json
npm run test:performance -- --label=after
npm run test:performance -- --label=after --http-only
npm run test:ux -- --report=qa/results/perf-20261112-after-ux.json
npm run test:performance -- --label=after --checks-only --skip-build
node qa/compare-performance.cjs
npm run test:purchase -- --oauth --report=qa/results/perf-20261112-purchase.json
npm run test:admin
npm run test:orders
```

--skip-build só pode ser usado com um build da mesma versão e da mesma URL fictícia do executor. A comparação visual exige as screenshots locais de antes e depois.

## Riscos e revisão

Não se alterou código financeiro, de autenticação, permissões ou schema. Permanecem sem certificação o desempenho de produção, o plano SQL real, cold starts/região Vercel, efetividade da CDN e OAuth real. Busca e ordenação pt-BR ainda podem carregar um conjunto grande para preservar a semântica existente. Recomendamos revisar o PR e, antes de eventual publicação autorizada, repetir medições em hospedagem apropriada e acompanhar dados de campo. O cache por processo tem limites explícitos e pode não trazer ganho se todas as respostas já forem servidas pela CDN. Nenhuma promessa de percentuais de melhoria em produção é feita.

Commits de implementação: `63b25a3` (QA/proteção de deploy), `ca0890b` (imagens), `edee545` (consultas/payload/paginação). A abertura automática do PR depende de acesso à API GitHub; não confundir a preparação do texto/branch com PR remoto já criado.
