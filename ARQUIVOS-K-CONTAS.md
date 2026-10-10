# Arquivos — mínimo de K das contas

Comparado ao checkpoint imediatamente anterior: **5 criados, 13 modificados; nenhum removido.**

## Criados

| Arquivo | Alteração |
| --- | --- |
| `ARQUIVOS-K-CONTAS.md` | Lista desta atualização de preços e arquivos incluídos por compatibilidade. |
| `ATUALIZACAO-K-CONTAS.md` | Regra 34/5, instalação, migrations, Git, deploy, entrega por credenciais e roteiro de testes. |
| `supabase/migrations/202610100001_robux_account_minimum_k.sql` | Mínimo configurável em contas, configuração inicial 34/5 e cálculo transacional com snapshot; preserva pedidos antigos e permissões. |
| `supabase/verificacoes/202610100001_check.sql` | Verifica configuração, exemplos, colunas, RLS, permissões, fórmula e proteção do snapshot sem escrever no banco. |
| `tests/robux-account-minimum-k.test.ts` | Seis testes de limites, arredondamento, mudança de configuração, imutabilidade, privacidade e atualização de banco com pedido antigo. |

## Modificados

| Arquivo | Alteração |
| --- | --- |
| `ARQUIVOS-CONTAS-ROBUX.md` | Manifesto completo atualizado em comparação com o ZIP original. |
| `CONTAS-COM-ROBUX.md` | Guia consolidado com as três migrations, mínimo 34/acréscimo 5, segurança e operação. |
| `VALIDACAO-CONTAS-ROBUX.md` | 99 testes, build, verificação funcional local, resultados anteriores e limites da validação atual. |
| `app/admin/robux/contas/AccountOrderPanel.tsx` | Exibe mínimo e acréscimo históricos; identifica regra anterior sem mínimo nos pedidos antigos. |
| `app/admin/robux/contas/actions.ts` | Valida e salva mínimo e acréscimo apenas com autenticação administrativa; mantém política e credenciais. |
| `app/admin/robux/contas/page.tsx` | Dois campos configuráveis, explicação do limite resultante e ofertas com a nova fórmula. |
| `app/api/robux/accounts/orders/route.ts` | Usa mínimo e acréscimo ao revalidar o preço antes de criar pedido/Pix. |
| `lib/providers/byrobux/accounts-parser.ts` | Calcula K com mínimo e acréscimo em centavos, mantendo o parser público e a saída segura. |
| `lib/robux-accounts/service.ts` | Lê mínimo do banco e o aplica aos preços do catálogo, preservando cache e validação externa. |
| `tests/fixture.ts` | Permite testar a aplicação das migrations até uma versão anterior, seguida da nova migration. |
| `tests/robux-account-delivery-policy.test.ts` | Ajusta o valor esperado à regra 34/5; mantém testes de entrega sem imagem, credenciais e política. |
| `tests/robux-accounts-database.test.ts` | Configuração explícita por teste; mantém regressões de snapshot, reservas, RLS e Quick Buy. |
| `tests/robux-accounts.test.ts` | Preserva regressões do parser/identidades e cobre configuração sem piso explícita e DTO público. |

## Incluídos no patch por compatibilidade

Estes arquivos estão iguais ao checkpoint e não recebem mudanças nesta revisão:

- `app/robux/contas/AccountCatalog.tsx`: inclui a troca já entregue para “Disponível para compra”.
- `202610090002_robux_account_delivery_policy.sql`, seu SQL de verificação e `ATUALIZACAO-ENTREGA-E-POLITICA.md`: permitem instalar a entrega por usuário/senha se ainda estiver pendente. **Não reaplique a migration se já foi executada.**

A migration nova é `202610100001_robux_account_minimum_k.sql`; a anterior permanece byte a byte igual. O parser/coleta, identificação das cotações, autenticação, Pix, Quick Buy, produtos e credenciais existentes foram preservados.
