# Arquivos — entrega completa de Contas com Robux

Comparação com o ZIP original anexado em 09/10/2026, incluindo a revisão de preços de 10/10/2026. **38 arquivos criados, 14 modificados; nenhum arquivo de código removido.**

## Criados

| Arquivo | Finalidade |
| --- | --- |
| `ARQUIVOS-AJUSTE-CONTAS.md` | Lista os arquivos desta revisão e a finalidade de cada alteração. |
| `ARQUIVOS-CONTAS-ROBUX.md` | Manifesto completo atualizado em comparação com o ZIP original. |
| `ARQUIVOS-K-CONTAS.md` | Lista desta atualização de preços e arquivos incluídos por compatibilidade. |
| `ATUALIZACAO-ENTREGA-E-POLITICA.md` | Instalação desta revisão, chave, SQL, política, operação e testes. |
| `ATUALIZACAO-K-CONTAS.md` | Regra 34/5, instalação, migrations, Git, deploy, entrega por credenciais e roteiro de testes. |
| `CONTAS-COM-ROBUX.md` | Guia consolidado com as três migrations, mínimo 34/acréscimo 5, segurança e operação. |
| `VALIDACAO-CONTAS-ROBUX.md` | 99 testes, build, verificação funcional local, resultados anteriores e limites da validação atual. |
| `app/admin/robux/contas/AccountDeliveryForm.tsx` | Campos de usuário, senha oculta e instruções; salvamento com retorno amigável. |
| `app/admin/robux/contas/AccountOrderPanel.tsx` | Exibe mínimo e acréscimo históricos; identifica regra anterior sem mínimo nos pedidos antigos. |
| `app/admin/robux/contas/AccountPolicyForm.tsx` | Editor da política pública com controle de versão e conflito. |
| `app/admin/robux/contas/actions.ts` | Valida e salva mínimo e acréscimo apenas com autenticação administrativa; mantém política e credenciais. |
| `app/admin/robux/contas/page.tsx` | Dois campos configuráveis, explicação do limite resultante e ofertas com a nova fórmula. |
| `app/api/maintenance/robux-accounts/route.ts` | Endpoint opcional de sincronização protegido pelo CRON_SECRET existente. |
| `app/api/robux/accounts/catalog/route.ts` | Catálogo seguro; sincronização com after() sem bloquear filtros. |
| `app/api/robux/accounts/delivery/[id]/route.ts` | Entrega de credenciais apenas ao dono de pedido entregue, sem cache. |
| `app/api/robux/accounts/orders/route.ts` | Usa mínimo e acréscimo ao revalidar o preço antes de criar pedido/Pix. |
| `app/pedidos/[id]/AccountDelivery.tsx` | Primeiro acesso, mostrar/copiar dados e link para relatar problema. |
| `app/reembolso/contas/page.tsx` | Página pública da política vigente com orientações e suporte. |
| `app/robux/contas/AccountCatalog.tsx` | Lista de 12 opções, faixas, filtros, resumo e leitura obrigatória antes do Pix. |
| `app/robux/contas/page.tsx` | Introdução, navegação das modalidades e etapas da compra. |
| `lib/providers/byrobux/accounts-catalog.ts` | Descobre cotações/páginas e preserva estado nas falhas parciais. |
| `lib/providers/byrobux/accounts-parser.ts` | Calcula K com mínimo e acréscimo em centavos, mantendo o parser público e a saída segura. |
| `lib/providers/byrobux/accounts.ts` | Coleta anônima, timeout, limites e deduplicação. |
| `lib/robux-accounts/credentials-crypto.ts` | AES-256-GCM, validação, nonce aleatório e vínculo ao pedido. |
| `lib/robux-accounts/delivery.ts` | Autorização, consulta e decifragem das entregas no servidor. |
| `lib/robux-accounts/policy.ts` | Leitura explícita dos campos seguros da política vigente. |
| `lib/robux-accounts/presentation.ts` | Agrupa opções equivalentes sem alterar a identidade da oferta comprada. |
| `lib/robux-accounts/service.ts` | Lê mínimo do banco e o aplica aos preços do catálogo, preservando cache e validação externa. |
| `supabase/migrations/202610090001_robux_accounts.sql` | Primeira migration aditiva de catálogo, snapshot, reservas e RLS; inalterada nesta revisão. |
| `supabase/migrations/202610090002_robux_account_delivery_policy.sql` | Política, aceite imutável, credenciais cifradas, RLS, RPCs e trava de entrega. |
| `supabase/migrations/202610100001_robux_account_minimum_k.sql` | Mínimo configurável em contas, configuração inicial 34/5 e cálculo transacional com snapshot; preserva pedidos antigos e permissões. |
| `supabase/verificacoes/202610090001_check.sql` | Verificação inicial de instalação e estado do catálogo. |
| `supabase/verificacoes/202610090002_check.sql` | Verificação sem escrita e sem exibir senhas ou dados privados. |
| `supabase/verificacoes/202610100001_check.sql` | Verifica configuração, exemplos, colunas, RLS, permissões, fórmula e proteção do snapshot sem escrever no banco. |
| `tests/robux-account-delivery-policy.test.ts` | Ajusta o valor esperado à regra 34/5; mantém testes de entrega sem imagem, credenciais e política. |
| `tests/robux-account-minimum-k.test.ts` | Seis testes de limites, arredondamento, mudança de configuração, imutabilidade, privacidade e atualização de banco com pedido antigo. |
| `tests/robux-accounts-database.test.ts` | Configuração explícita por teste; mantém regressões de snapshot, reservas, RLS e Quick Buy. |
| `tests/robux-accounts.test.ts` | Preserva regressões do parser/identidades e cobre configuração sem piso explícita e DTO público. |

## Modificados

| Arquivo | Finalidade |
| --- | --- |
| `.env.example` | Documenta a chave secreta de criptografia das entregas; não contém chave real. |
| `app/admin/pedidos/[id]/page.tsx` | Integra painel da conta e atualiza botões, orientações e rótulos de auditoria. |
| `app/admin/pedidos/actions.ts` | Revalida somente pedidos de conta antes das etapas críticas. |
| `app/admin/robux/page.tsx` | Link para a área administrativa de contas. |
| `app/api/orders/[id]/route.ts` | Revalida a conta ao retomar o Pix, preservando o fluxo de outros pedidos. |
| `app/checkout/CheckoutContent.tsx` | Aviso específico de conta e acesso à política do pedido antes do Pix. |
| `app/components/LegalPage.tsx` | Permite data de atualização específica mantendo o padrão das outras páginas. |
| `app/pedidos/[id]/page.tsx` | Dados seguros, política lida, entrega privada e textos de e-mail por modalidade. |
| `app/reembolso/page.tsx` | Inclui acesso à política específica de contas mantendo o conteúdo geral. |
| `app/robux/page.tsx` | Adiciona a escolha entre GamePass e contas sem substituir a calculadora. |
| `app/suporte/SupportForm.tsx` | Preenche contexto do pedido e preserva rascunhos separados por atendimento. |
| `app/suporte/page.tsx` | Confere propriedade do pedido antes de preencher o suporte. |
| `lib/order-emails.ts` | Reutiliza e-mail existente: contas recebem link para acesso privado, sem senha/imagem. |
| `tests/fixture.ts` | Permite testar a aplicação das migrations até uma versão anterior, seguida da nova migration. |

Migrations anteriores à revisão de preços não foram editadas. Os ZIPs excluem dependências, build, cache de TypeScript, histórico Git e credenciais; preserve seus arquivos privados e a pasta Git.
