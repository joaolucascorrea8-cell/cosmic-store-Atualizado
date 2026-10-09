# Validação — Contas com Robux

## Resultado

- `npm run lint`: passou, sem erros ou avisos finais.
- `npm run typecheck`: passou.
- `npm test`: **85 testes passaram**, zero falhas. Inclui os 63 testes anteriores e 22 novos.
- `npm run build`: passou com Next.js 16.3.8, gerando as rotas atuais e novas.
- As migrations foram executadas somente em um PostgreSQL isolado com PGlite. A migration de contas e o SQL de verificação foram testados.
- Testes das RPCs cobrem preço/margem, ausência de pedidos órfãos, snapshot, imutabilidade, reserva, expiração, RLS, limite/lease, aquisição manual, entrega e concorrência lógica de duas criações. O motor de teste serializa suas transações; não substitui um teste de carga multi-instância em PostgreSQL de produção.
- Quick Buy original teve teste adicional de criação de pedido/GamePass e confirmação de pagamento; os testes antigos de loja, estoque, cupons, suporte, importação, relatórios e servidores continuam passando.

## Fonte pública real

Foram realizadas somente requisições GET anônimas ao domínio público. A coleta descobriu 42 cotações e percorreu 73 páginas/requisições na captura. A primeira passagem identificou diferenças de estrutura/formatação; o parser foi corrigido e a releitura de **todas as páginas capturadas** reconheceu **559 linhas agrupadas em 381 ofertas únicas, sem erros**.

Esses números são um registro da consulta de 09/10/2026, não estoque atual nem valores hardcoded. As capturas brutas, que contêm tokens públicos descartados pelo parser, não fazem parte do ZIP.

`alternate` e `fourth` são reconhecidos, com e sem paginação. Valores monetários acima de mil funcionam nos formatos 2,633.05 e 2.633,05. IDs compostos repetidos são agrupados e registrados no diagnóstico; IDs individuais repetidos entre páginas são tratados como leitura instável.

## Navegador e API local

Foi usada a aplicação compilada, em servidor local, com respostas simuladas de Supabase e dados fictícios, sem banco/credenciais de produção.

- Chromium headless: celular **390×844** e desktop **1440×1000**, sem rolagem horizontal e sem erros JavaScript.
- Renderização: 24 cards por página, segunda página de 7 cards no cenário de 31 ofertas.
- Filtro de quantidade e ordenação por Robux: passaram.
- Mudança de preço no checkout (resposta 409 simulada): o novo valor aparece, o próximo clique usa esse valor e preserva o token idempotente.
- API real do catálogo, com cache local simulado: HTTP 200; campos de oferta somente `id`, `robux`, `cosmicK`, `price`, `available`. Nenhum fornecedor, margem, custo, máscara ou URL operacional na resposta.
- API real de criação sem sessão: HTTP 401.
- Capturas mobile/desktop foram inspecionadas visualmente.

## O que depende do seu ambiente

Não foi feito login na sua loja/Supabase/fornecedor, Pix real, confirmação real de comprovante, aquisição real de conta ou envio real de e-mail/Discord. O fluxo autenticado completo deve ser validado com usuários/pedido controlados após instalar o SQL e manter suas variáveis atuais. Não houve deploy nem alterações em produção.

Acesso Admin e ações usam a autenticação existente. Banco/RLS foram testados isoladamente; não houve inspeção do banco de produção. O teste de navegador cobriu catálogo/UX pública, e não uma sessão administrativa real.

A coleta depende da estrutura pública externa e de acesso de rede no ambiente da Vercel. Bloqueios/HTML alterado/timeout deixam diagnóstico e preservam estado; não são contornados. A reserva local não garante reserva no fornecedor. Agrupamento em `fourth` não fornece uma identidade física individual que o fornecedor não torna pública.

## Integridade do checkpoint

O ZIP de origem não foi alterado. SHA-256 do ZIP recebido:

```text
b9a97778ae0f63f7e2f89affd40c8f6a68bcae947543ee75086501c75f26f4cd
```

Nenhuma migration anterior ou arquivo original de integração Quick Buy foi modificado. Não há remoção de arquivos de código da fonte recebida. O pacote final exclui apenas dependências/artefatos de execução/histórico Git, que não são necessários para transportar o código.
