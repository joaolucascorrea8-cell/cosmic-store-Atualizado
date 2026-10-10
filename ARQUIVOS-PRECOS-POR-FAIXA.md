# Arquivos — preços por faixa das contas

Patch cumulativo desde a correção enviada no commit `936b73c`: **8 criados, 15 modificados; nenhum removido.** Inclui os arquivos da atualização automática anteriormente entregue, pois sua instalação ainda não foi confirmada.

Em relação ao checkpoint imediatamente anterior aos preços por faixa: **6 criados e 13 modificados**.

## Criados no patch cumulativo

| Arquivo | Alteração |
| --- | --- |
| `ARQUIVOS-ATUALIZACAO-AUTOMATICA.md` | Lista dos arquivos desta revisão com finalidade e comparação ao checkpoint. |
| `ARQUIVOS-PRECOS-POR-FAIXA.md` | Manifesto cumulativo desde o último push confirmado e identificação dos arquivos desta revisão. |
| `ATUALIZACAO-AUTOMATICA-CONTAS.md` | Explica funcionamento, limites, instalação do patch, Git/deploy, validação e roteiro de testes. |
| `ATUALIZACAO-PRECOS-POR-FAIXA.md` | Guia desta revisão: tabela, SQL, VS Code, Git, deploy, testes e limites. |
| `lib/robux-price-table.ts` | Cálculo compartilhado da tabela por quantidade, com centavos inteiros e arredondamento somente do preço final. |
| `supabase/migrations/202610100002_robux_account_price_table.sql` | Migration nova: identifica a regra no snapshot e calcula novas contas pela tabela no banco, sem reprecificar pedidos/configurações existentes. |
| `supabase/verificacoes/202610100002_check.sql` | SQL somente leitura para exemplos, configuração, instalação da regra, snapshot, RLS e permissões. |
| `tests/robux-account-price-table.test.ts` | Seis testes: preços, 7.007 comparações SQL/TypeScript, criação, upgrade histórico, privacidade, ordenação e permissões. |

## Modificados no patch cumulativo

| Arquivo | Alteração |
| --- | --- |
| `ARQUIVOS-CONTAS-ROBUX.md` | Manifesto completo comparado ao ZIP original, sem remoção de código. |
| `CONTAS-COM-ROBUX.md` | Guia consolidado com quatro migrations, tabela, K base, histórico, instalação e operação automática. |
| `VALIDACAO-CONTAS-ROBUX.md` | Registra 105 testes/build, 7.007 comparações de preços, HTTP real simulado e limites de validação visual/produção. |
| `app/admin/robux/contas/AccountOrderPanel.tsx` | Mostra a regra histórica do snapshot e o K base, preservando link de aquisição e entrega por credenciais. |
| `app/admin/robux/contas/page.tsx` | Explica configuração/curva e exemplos; usa K base no quadro de ofertas e inicia consulta automática sem botão. |
| `app/pedidos/[id]/page.tsx` | Na seção segura de contas, identifica o K como base; preserva total histórico e demais fluxos do pedido. |
| `app/robux/contas/AccountCatalog.tsx` | Exibe K base Cosmic e explica a tabela abaixo de 1.000 Robux no catálogo e resumo; inclui rótulo de atualização automática. |
| `lib/live-pages.ts` | Inclui o Admin de contas no ciclo existente de 90 segundos, com proteção de campos em edição; revisão automática incluída no patch. |
| `lib/providers/byrobux/accounts-parser.ts` | Precifica contas pela tabela compartilhada usando o K base dinâmico; parser público e campos privados permanecem separados. |
| `lib/robux-accounts/presentation.ts` | Compara preço final por Robux com aritmética exata para ordenar Melhor valor por 1K. |
| `lib/robux-accounts/service.ts` | Usa a comparação efetiva de preço por Robux; coleta, cache, validação e snapshots continuam integrados ao fluxo existente. |
| `lib/robux-pricing.ts` | Produtos → Preços delega à função compartilhada, preservando resultados, validações e a lógica própria de GamePass/Quick Buy. |
| `qa/check-admin-order-actions.cjs` | Regressão HTTP compilada com preços/faixas, DTO público e ordenação; mantém sincronização automática e fluxos de entrega. |
| `tests/robux-account-minimum-k.test.ts` | Atualiza um exemplo abaixo de 1.000 para a tabela, preservando a cobertura de mínimo/acréscimo. |
| `tests/servers.test.ts` | Confere a participação do Admin de contas nas atualizações automáticas; revisão incluída no patch. |

## Incluídos da revisão automática anterior

- `ARQUIVOS-ATUALIZACAO-AUTOMATICA.md`
- `ATUALIZACAO-AUTOMATICA-CONTAS.md`
- `lib/live-pages.ts`
- `tests/servers.test.ts`

## Compatibilidade

A única migration desta revisão é `202610100002_robux_account_price_table.sql`, com SQL de verificação correspondente. Nenhuma migration aplicada foi editada, nenhuma variável foi acrescentada, e nenhum preço de pedido/produto existente é regravado. Quick Buy, autenticação, Pix, e-mails, aquisição manual e entrega mantêm seus fluxos. Leia `ATUALIZACAO-PRECOS-POR-FAIXA.md` antes de publicar.
