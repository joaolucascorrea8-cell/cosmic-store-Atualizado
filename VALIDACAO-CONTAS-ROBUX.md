# Validação — Contas com Robux

## Resultado

- `npm run lint`: passou, sem erros ou avisos finais.
- `npm run typecheck`: passou.
- `npm test`: **105 testes passaram**, zero falhas. Inclui os 99 testes anteriores e seis novos testes da tabela, banco, histórico e privacidade.
- `npm run build`: passou com Next.js 16.3.8, gerando as rotas atuais e novas.
- As migrations foram executadas somente em um PostgreSQL isolado com PGlite. As quatro migrations de contas e seus SQLs de verificação foram testados, incluindo atualização sobre um pedido existente.
- Testes das RPCs cobrem preço/margem, ausência de pedidos órfãos, snapshot, imutabilidade, reserva, expiração, RLS, limite/lease, aquisição manual, entrega e concorrência lógica de duas criações. O motor de teste serializa suas transações; não substitui um teste de carga multi-instância em PostgreSQL de produção.
- Quick Buy original teve teste adicional de criação de pedido/GamePass e confirmação de pagamento; os testes antigos de loja, estoque, cupons, suporte, importação, relatórios e servidores continuam passando.

## Ordenação inicial — revisão mais recente de 10/10/2026

A vitrine inicia com Menor preço total selecionado; a API já suportava esse filtro e seu padrão sem parâmetro também é menor preço. A única alteração de código desta revisão é a seleção inicial e a posição da opção no componente público. As demais opções, atualização automática, cálculo, banco e pedidos permanecem.

`npm run check` passou com lint, TypeScript e 105 testes. O build completo e as regressões HTTP existentes em `qa/check-admin-order-actions.cjs` também passaram. Não foram criados testes novos para esta troca de padrão. A verificação visual da seleção no celular/navegador deve ser feita após o deploy; o navegador continua indisponível neste ambiente.

## Preços por faixa — revisão anterior de 10/10/2026

`npm run check` e o build completo passaram. `tests/robux-account-price-table.test.ts` cobre:

- Exemplos da tabela K34 (350/400/450/500/750/1.000/1.990), limites entre faixas e igualdade com o cálculo de Produtos → Preços usando o mesmo K base. Os limites de validação anteriores dos produtos foram preservados.
- **7.007 comparações** de preço entre TypeScript e SQL (1.001 quantidades × sete Ks), mais quantidades grandes. Aritmética exata e arredondamento somente no final.
- Criação de conta de 500 Robux por R$18,55; recusa do valor antigo R$17 sem criar pedido órfão; snapshot privado da regra; alteração de configuração e retry idempotente.
- Atualização do banco com pedido antigo de 500 Robux a R$17: total, itens, dados seguros, política, configuração customizada e funções de Quick Buy/entrega permanecem. A regra histórica é identificada, sem recalcular o pedido.
- Ordenação pelo preço final por Robux, DTO público com campos explícitos, imutabilidade da regra e verificações SQL/RLS.

O teste `node qa/check-admin-order-actions.cjs` executou o build e conferiu por HTTP a API real do catálogo com Supabase simulado: tabela de preços, K base, ordenação e ausência de custos, IDs mascarados, margem, fornecedor, URLs e regra privada no retorno. As regressões HTTP de atualização automática do Admin, avisos no formulário, chave, dados cifrados e entrega sem imagem também passaram.

A lógica própria do Quick Buy continua proporcional ao valor bruto do GamePass: os testes mantêm 500 × K34 → R$17 e 1.429 × K34 → R$48,59, sem confundir esse fluxo com o catálogo de contas. Não foram alterados preços salvos de produtos ou pedidos antigos.

Não houve nova captura visual/mobile nesta revisão: o executável de navegador não está disponível. As alterações visuais são rótulos e explicações no layout existente; conferir sua leitura em celular e desktop faz parte do roteiro após o deploy. Nenhuma chamada real ao fornecedor, alteração em produção, Pix, e-mail ou deploy foi feita nesta revisão.

## Atualização automática no Admin — revisão anterior de 10/10/2026

ESLint, TypeScript, os 99 testes e o build completo passaram após incluir a página administrativa no mecanismo de atualização automática existente. A regressão de rotas em `tests/servers.test.ts` cobre a nova rota. O teste HTTP compilado `qa/check-admin-order-actions.cjs` confirmou que abrir o Admin chama `robux_account_claim_sync` após a resposta sem submissão de formulário, e que uma nova renderização consulta novamente o mesmo controle. O banco simulado recusou a aquisição do lease, conferindo que esse caminho não depende de acesso ao fornecedor. Os testes de banco existentes cobrem exclusão mútua, intervalo e preservação do cache em falhas.

As regressões anteriores dos avisos, credenciais e entrega sem imagem também passaram. Não houve nova inspeção visual, espera de timer em navegador, uso de produção ou alteração de agendadores externos. O agendamento visual reutiliza `LivePageRefresh`, incluindo a proteção de campos em edição. Confira o ciclo no navegador após o deploy, conforme `ATUALIZACAO-AUTOMATICA-CONTAS.md`.

## Avisos no pedido e configuração da chave — revisão de 10/10/2026

ESLint, TypeScript, os 99 testes e o build completo passaram novamente após a correção. O teste reproduzível `qa/check-admin-order-actions.cjs` exercitou as Server Actions reais da aplicação compilada, por HTTP, com Supabase simulado localmente:

- Recusas de entrega sem imagem e sem credenciais aparecem em `role="alert"`, com HTTP 200 e o pedido ainda visível; não alteram status nem criam notificação de entrega.
- Pedido alterado por outro Admin não é sobrescrito. Recusa de comprovante sem motivo é exibida no formulário. Falha de SQL apresenta orientação genérica, sem detalhes técnicos da exceção.
- Sem chave, a página explica a configuração; com chave válida, mostra usuário/senha. Gravação vazia é recusada. Dados completos são enviados cifrados ao banco simulado e permitem concluir a conta sem imagem.
- Nenhum serviço externo, banco de produção, mensagem real ou compra foi utilizado. Os testes isolados do banco continuam verificando os guards reais de imagem/credenciais; o teste HTTP verifica o transporte e a renderização dos formulários.

A validação visual em navegador/celular não foi repetida nesta revisão porque o executável não está disponível. O layout usa os mesmos formulários e classes responsivas; confirme a leitura dos novos avisos e instruções no aparelho após o deploy.

## Preços com mínimo — revisão de 10/10/2026

A fórmula `max(mínimo, K fornecedor + acréscimo)` foi conferida em TypeScript e PostgreSQL nos limites 28,99 / 29 / 29,01 e em quantidades fracionárias de 1K. A atualização preserva pedidos, itens, política e funções de entrega/Quick Buy anteriores. Alterações de mínimo/acréscimo recalculam novas compras, recusam preço antigo e não reescrevem snapshots. A coluna privada nova também é imutável e não aparece nos detalhes seguros do cliente.



Na revisão de preços, a aplicação compilada também foi testada por HTTP com Supabase simulado: catálogo público com valores 34/34,50/35, ausência de dados internos, formulário real do Admin salvando os dois campos por Server Action e recálculo sem nova consulta ao fornecedor. A inspeção visual em navegador não foi repetida nesta revisão porque o executável não estava disponível e o download não pôde ser concluído. A estrutura pública aprovada não foi alterada; confira o novo formulário no celular após o deploy.

## Segurança adicional da revisão de entrega

A suite cobre AES-256-GCM com nonce aleatório, senha com espaços preservada, recusa de chave errada/adulteração/troca de pedido, pagamento e aquisição obrigatórios, entrega sem imagem com credenciais, recusa de edição concorrente, ausência de senhas em auditoria, RLS/grants, aceite obrigatório, versão expirada e snapshot imutável da política. Os testes de itens comuns continuam exigindo imagem; Quick Buy preserva sua lógica.

## Fonte pública real

Foram realizadas somente requisições GET anônimas ao domínio público. A coleta descobriu 42 cotações e percorreu 73 páginas/requisições na captura. A primeira passagem identificou diferenças de estrutura/formatação; o parser foi corrigido e a releitura de **todas as páginas capturadas** reconheceu **559 linhas agrupadas em 381 ofertas únicas, sem erros**.

Esses números são um registro da consulta de 09/10/2026, não estoque atual nem valores hardcoded. As capturas brutas, que contêm tokens públicos descartados pelo parser, não fazem parte do ZIP.

`alternate` e `fourth` são reconhecidos, com e sem paginação. Valores monetários acima de mil funcionam nos formatos 2,633.05 e 2.633,05. IDs compostos repetidos são agrupados e registrados no diagnóstico; IDs individuais repetidos entre páginas são tratados como leitura instável.

## Navegador e API local — revisão anterior de organização/entrega

Foi usada a aplicação compilada, em servidor local, com respostas simuladas de Supabase e dados fictícios, sem banco/credenciais de produção.

- Chromium headless: celular **390×844** e desktop **1440×1000**, sem rolagem horizontal e sem erros JavaScript.
- Renderização: 12 linhas por página; 32 ofertas fictícias formam 31 opções após agrupar duas equivalentes. Filtros e segunda página verificados.
- Filtro de quantidade e ordenação por Robux: passaram.
- Mudança de preço no checkout (resposta 409 simulada): o novo valor aparece, a leitura deve ser confirmada novamente, o próximo clique usa esse valor e preserva o token idempotente.
- API real do catálogo, com cache local simulado: HTTP 200; campos de oferta somente `id`, `robux`, `cosmicK`, `price`, `available`, `options`. A resposta também inclui texto/versão da política pública e prazo de entrega. Nenhum fornecedor, margem, custo, máscara ou URL operacional na resposta.
- API real de criação sem sessão: HTTP 401.
- Capturas do catálogo, resumo, Admin e entrega ao cliente foram inspecionadas visualmente.
- Com autenticação/Supabase simulados locais, o Admin salvou usuário/senha pelo Server Action real; a requisição ao banco continha somente credenciais cifradas.
- A rota real de credenciais retornou 401 sem sessão, 404 para outro cliente, 404 antes da entrega e 200 para o dono após a entrega, com `private, no-store`.
- A senha não apareceu no HTML inicial do pedido. O cliente abriu os dados e alternou a exibição da senha. O link de relato abriu o suporte com código e horário do pedido preenchidos.

## O que depende do seu ambiente

Não foi feito login na sua loja/Supabase/fornecedor, Pix real, confirmação real de comprovante, aquisição real de conta ou envio real de e-mail/Discord. O fluxo autenticado completo deve ser validado com usuários/pedido controlados após instalar o SQL e manter suas variáveis atuais. Não houve deploy nem alterações em produção.

Acesso Admin e ações usam a autenticação existente. Banco/RLS foram testados isoladamente; não houve inspeção do banco de produção. O teste de navegador cobriu catálogo e fluxos de Admin/cliente com sessões fictícias locais, não uma sessão real de produção.

A coleta depende da estrutura pública externa e de acesso de rede no ambiente da Vercel. Bloqueios/HTML alterado/timeout deixam diagnóstico e preservam estado; não são contornados. A reserva local não garante reserva no fornecedor. Agrupamento em `fourth` não fornece uma identidade física individual que o fornecedor não torna pública.

## Integridade do checkpoint

O ZIP de origem não foi alterado. SHA-256 do ZIP recebido:

```text
b9a97778ae0f63f7e2f89affd40c8f6a68bcae947543ee75086501c75f26f4cd
```

Nenhuma migration anterior foi modificada. A integração do Quick Buy mantém sua lógica; o módulo compartilhado `lib/robux-pricing.ts` apenas delega a curva de produtos à função reutilizada pelas contas. Não há remoção de arquivos de código da fonte recebida. O pacote final exclui apenas dependências/artefatos de execução/histórico Git, que não são necessários para transportar o código.
