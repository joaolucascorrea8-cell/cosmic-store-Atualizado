# Arquivos — Contas com Robux

Comparação por SHA-256 contra os arquivos de código do ZIP recebido. **19 arquivos criados, 6 modificados, nenhum arquivo de código removido.**

## Criados

| Arquivo | O que faz |
| --- | --- |
| `app/admin/robux/contas/AccountOrderPanel.tsx` | Exibe snapshot interno, link exato da cotação, disponibilidade, última validação e aquisição manual no pedido Admin. |
| `app/admin/robux/contas/actions.ts` | Actions protegidas para margem/pausa, consulta de catálogo, revalidação e confirmação de aquisição manual. |
| `app/admin/robux/contas/page.tsx` | Painel de contas, estado/erros da sincronização, margem, ofertas paginadas e pedidos recentes. |
| `app/api/maintenance/robux-accounts/route.ts` | Endpoint opcional de sincronização protegido pelo CRON_SECRET existente. |
| `app/api/robux/accounts/catalog/route.ts` | API pública com DTO sanitizado, paginação/filtros e mensagens amigáveis. |
| `app/api/robux/accounts/orders/route.ts` | Checkout autenticado; revalidação pública, confirmação de preço, criação atômica/idempotente e aviso administrativo. |
| `app/robux/contas/AccountCatalog.tsx` | Catálogo responsivo, filtros, ordenação, atualização a cada 90 s, 24 cards e confirmação de preço. |
| `app/robux/contas/page.tsx` | Página de Contas com Robux, mantendo cabeçalho/rodapé e link para GamePass. |
| `lib/providers/byrobux/accounts-catalog.ts` | Descoberta recursiva de cotações, paginação, agrupamento e preservação por cotação com transporte injetável para testes. |
| `lib/providers/byrobux/accounts-parser.ts` | Parser central puro, normalização/validação, chaves compostas, preço em centavos e DTO seguro. |
| `lib/providers/byrobux/accounts.ts` | Transporte server-only anônimo; timeout, três consultas simultâneas e deduplicação. Sem API Key ou compras. |
| `lib/robux-accounts/service.ts` | Cache persistente/lease, configuração, reservas visíveis, validade das ofertas, revalidações e supressão de ofertas ausentes. |
| `supabase/migrations/202610090001_robux_accounts.sql` | Seis tabelas isoladas, RLS, RPCs exclusivas do servidor, snapshot imutável, controle de concorrência e guards no novo tipo de pedido. |
| `supabase/verificacoes/202610090001_check.sql` | Verificação somente leitura de instalação, privilégios, RLS, colunas seguras e diagnóstico. |
| `tests/robux-accounts-database.test.ts` | Testes isolados de pedidos, margens, reservas/expiração, snapshot, RLS, acquisition/entrega, Quick Buy e SQL de verificação. |
| `tests/robux-accounts.test.ts` | Testes de parser/cotações, moeda, preços, paginação, alterações/remoções, falhas parciais e agrupamento fourth. |
| `CONTAS-COM-ROBUX.md` | Guia de instalação, arquitetura, uso Admin, ambiente, deploy/Git, limites e roteiro de testes. |
| `VALIDACAO-CONTAS-ROBUX.md` | Evidências executadas, checkpoint e limites da validação. |
| `ARQUIVOS-CONTAS-ROBUX.md` | Este inventário completo. |

## Modificados

| Arquivo | Alteração |
| --- | --- |
| `app/admin/pedidos/[id]/page.tsx` | Acrescenta somente o painel de conta quando order_type=robux_account e duração máxima para ações de validação. |
| `app/admin/pedidos/actions.ts` | Revalida contas antes de confirmar pagamento/iniciar preparação. Mantém as transições, e-mails e tratamento de Quick Buy. |
| `app/admin/robux/page.tsx` | Acrescenta link para Admin → Robux → Contas; configurações/balance/API Quick Buy preservados. |
| `app/api/orders/[id]/route.ts` | Retomada do Pix de conta exige disponibilidade/reserva/cotação válidas; demais pedidos seguem o fluxo existente. |
| `app/pedidos/[id]/page.tsx` | Lê apenas detalhes seguros das contas, mostra etapa de aquisição/entrega e evita recompra de oferta dinâmica pelo carrinho convencional. |
| `app/robux/page.tsx` | Acrescenta navegação entre GamePass e contas sem modificar a calculadora/validação Quick Buy. |

## Preservação

`lib/byrobux.ts`, `lib/robux-settings.ts`, `lib/robux-pricing.ts`, `app/robux/RobuxCalculator.tsx`, as rotas existentes `app/api/robux/*`, as migrations anteriores, autenticação, produtos/preços dos jogos, carrinho, Discord, e-mails e `vercel.json` mantêm os bytes recebidos. Os seis pontos compartilhados listados acima receberam integração condicional para o novo tipo de pedido.

O ZIP original é o checkpoint. Nenhuma migration foi aplicada em produção. Para transportar o código, o ZIP final não inclui `.git`, `node_modules` ou `.next`; mantenha o histórico Git da sua pasta local.
