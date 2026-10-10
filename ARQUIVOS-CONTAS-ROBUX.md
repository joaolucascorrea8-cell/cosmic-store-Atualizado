# Arquivos — entrega completa de Contas com Robux

Comparação com o ZIP original de 09/10/2026, incluindo entrega por credenciais, política, mínimo de K, avisos, atualização automática e preços por faixa de 10/10/2026. **50 arquivos criados, 17 modificados; nenhum arquivo de código removido.**

## Criados

| Arquivo | Finalidade |
| --- | --- |
| `ARQUIVOS-AJUSTE-CONTAS.md` | Lista os arquivos desta revisão e a finalidade de cada alteração. |
| `ARQUIVOS-ATUALIZACAO-AUTOMATICA.md` | Lista dos arquivos desta revisão com finalidade e comparação ao checkpoint. |
| `ARQUIVOS-CONTAS-ROBUX.md` | Manifesto completo comparado ao ZIP original, sem remoção de código. |
| `ARQUIVOS-CORRECAO-PEDIDOS.md` | Manifesto dos arquivos criados/modificados nesta correção, comparado ao checkpoint anterior. |
| `ARQUIVOS-K-CONTAS.md` | Lista desta atualização de preços e arquivos incluídos por compatibilidade. |
| `ARQUIVOS-PRECOS-POR-FAIXA.md` | Manifesto cumulativo desde o último push confirmado e identificação dos arquivos desta revisão. |
| `ATUALIZACAO-AUTOMATICA-CONTAS.md` | Explica funcionamento, limites, instalação do patch, Git/deploy, validação e roteiro de testes. |
| `ATUALIZACAO-ENTREGA-E-POLITICA.md` | Instalação desta revisão, chave, SQL, política, operação e testes. |
| `ATUALIZACAO-K-CONTAS.md` | Regra 34/5, instalação, migrations, Git, deploy, entrega por credenciais e roteiro de testes. |
| `ATUALIZACAO-PRECOS-POR-FAIXA.md` | Guia desta revisão: tabela, SQL, VS Code, Git, deploy, testes e limites. |
| `CONTAS-COM-ROBUX.md` | Guia consolidado com quatro migrations, tabela, K base, histórico, instalação e operação automática. |
| `CORRECAO-ERROS-PEDIDOS.md` | Explica React #441, instalação do patch, configuração exata da chave, Git, deploy e testes. |
| `VALIDACAO-CONTAS-ROBUX.md` | Registra 105 testes/build, 7.007 comparações de preços, HTTP real simulado e limites de validação visual/produção. |
| `app/admin/pedidos/OrderStatusActions.tsx` | Formulário com useActionState, avisos acessíveis, bloqueio durante envio e confirmação de cancelamento. |
| `app/admin/robux/contas/AccountDeliveryForm.tsx` | Campos de usuário, senha oculta e instruções; salvamento com retorno amigável. |
| `app/admin/robux/contas/AccountOrderPanel.tsx` | Mostra a regra histórica do snapshot e o K base, preservando link de aquisição e entrega por credenciais. |
| `app/admin/robux/contas/AccountPolicyForm.tsx` | Editor da política pública com controle de versão e conflito. |
| `app/admin/robux/contas/actions.ts` | Valida e salva mínimo e acréscimo apenas com autenticação administrativa; mantém política e credenciais. |
| `app/admin/robux/contas/page.tsx` | Explica configuração/curva e exemplos; usa K base no quadro de ofertas e inicia consulta automática sem botão. |
| `app/api/maintenance/robux-accounts/route.ts` | Endpoint opcional de sincronização protegido pelo CRON_SECRET existente. |
| `app/api/robux/accounts/catalog/route.ts` | Catálogo seguro; sincronização com after() sem bloquear filtros. |
| `app/api/robux/accounts/delivery/[id]/route.ts` | Entrega de credenciais apenas ao dono de pedido entregue, sem cache. |
| `app/api/robux/accounts/orders/route.ts` | Usa mínimo e acréscimo ao revalidar o preço antes de criar pedido/Pix. |
| `app/pedidos/[id]/AccountDelivery.tsx` | Primeiro acesso, mostrar/copiar dados e link para relatar problema. |
| `app/reembolso/contas/page.tsx` | Página pública da política vigente com orientações e suporte. |
| `app/robux/contas/AccountCatalog.tsx` | Exibe K base Cosmic e explica a tabela abaixo de 1.000 Robux no catálogo e resumo; inclui rótulo de atualização automática. |
| `app/robux/contas/page.tsx` | Introdução, navegação das modalidades e etapas da compra. |
| `lib/providers/byrobux/accounts-catalog.ts` | Descobre cotações/páginas e preserva estado nas falhas parciais. |
| `lib/providers/byrobux/accounts-parser.ts` | Precifica contas pela tabela compartilhada usando o K base dinâmico; parser público e campos privados permanecem separados. |
| `lib/providers/byrobux/accounts.ts` | Coleta anônima, timeout, limites e deduplicação. |
| `lib/robux-accounts/credentials-crypto.ts` | AES-256-GCM, validação, nonce aleatório e vínculo ao pedido. |
| `lib/robux-accounts/delivery.ts` | Autorização, consulta e decifragem das entregas no servidor. |
| `lib/robux-accounts/policy.ts` | Leitura explícita dos campos seguros da política vigente. |
| `lib/robux-accounts/presentation.ts` | Compara preço final por Robux com aritmética exata para ordenar Melhor valor por 1K. |
| `lib/robux-accounts/service.ts` | Usa a comparação efetiva de preço por Robux; coleta, cache, validação e snapshots continuam integrados ao fluxo existente. |
| `lib/robux-price-table.ts` | Cálculo compartilhado da tabela por quantidade, com centavos inteiros e arredondamento somente do preço final. |
| `qa/check-admin-order-actions.cjs` | Regressão HTTP compilada com preços/faixas, DTO público e ordenação; mantém sincronização automática e fluxos de entrega. |
| `supabase/migrations/202610090001_robux_accounts.sql` | Primeira migration aditiva de catálogo, snapshot, reservas e RLS; inalterada nesta revisão. |
| `supabase/migrations/202610090002_robux_account_delivery_policy.sql` | Política, aceite imutável, credenciais cifradas, RLS, RPCs e trava de entrega. |
| `supabase/migrations/202610100001_robux_account_minimum_k.sql` | Mínimo configurável em contas, configuração inicial 34/5 e cálculo transacional com snapshot; preserva pedidos antigos e permissões. |
| `supabase/migrations/202610100002_robux_account_price_table.sql` | Migration nova: identifica a regra no snapshot e calcula novas contas pela tabela no banco, sem reprecificar pedidos/configurações existentes. |
| `supabase/verificacoes/202610090001_check.sql` | Verificação inicial de instalação e estado do catálogo. |
| `supabase/verificacoes/202610090002_check.sql` | Verificação sem escrita e sem exibir senhas ou dados privados. |
| `supabase/verificacoes/202610100001_check.sql` | Verifica configuração, exemplos, colunas, RLS, permissões, fórmula e proteção do snapshot sem escrever no banco. |
| `supabase/verificacoes/202610100002_check.sql` | SQL somente leitura para exemplos, configuração, instalação da regra, snapshot, RLS e permissões. |
| `tests/robux-account-delivery-policy.test.ts` | Ajusta o valor esperado à regra 34/5; mantém testes de entrega sem imagem, credenciais e política. |
| `tests/robux-account-minimum-k.test.ts` | Atualiza um exemplo abaixo de 1.000 para a tabela, preservando a cobertura de mínimo/acréscimo. |
| `tests/robux-account-price-table.test.ts` | Seis testes: preços, 7.007 comparações SQL/TypeScript, criação, upgrade histórico, privacidade, ordenação e permissões. |
| `tests/robux-accounts-database.test.ts` | Configuração explícita por teste; mantém regressões de snapshot, reservas, RLS e Quick Buy. |
| `tests/robux-accounts.test.ts` | Preserva regressões do parser/identidades e cobre configuração sem piso explícita e DTO público. |

## Modificados

| Arquivo | Finalidade |
| --- | --- |
| `.env.example` | Documenta a chave secreta de criptografia das entregas; não contém chave real. |
| `app/admin/pedidos/[id]/page.tsx` | Integra o painel privado de contas e o formulário de atualização com avisos inline, preservando o fluxo dos demais pedidos. |
| `app/admin/pedidos/actions.ts` | Mantém transições atômicas e proteções da loja; retorna recusas esperadas ao formulário, preservando avisos/e-mails após mudança válida. |
| `app/admin/robux/page.tsx` | Link para a área administrativa de contas. |
| `app/api/orders/[id]/route.ts` | Revalida a conta ao retomar o Pix, preservando o fluxo de outros pedidos. |
| `app/checkout/CheckoutContent.tsx` | Aviso específico de conta e acesso à política do pedido antes do Pix. |
| `app/components/LegalPage.tsx` | Permite data de atualização específica mantendo o padrão das outras páginas. |
| `app/pedidos/[id]/page.tsx` | Na seção segura de contas, identifica o K como base; preserva total histórico e demais fluxos do pedido. |
| `app/reembolso/page.tsx` | Inclui acesso à política específica de contas mantendo o conteúdo geral. |
| `app/robux/page.tsx` | Adiciona a escolha entre GamePass e contas sem substituir a calculadora. |
| `app/suporte/SupportForm.tsx` | Preenche contexto do pedido e preserva rascunhos separados por atendimento. |
| `app/suporte/page.tsx` | Confere propriedade do pedido antes de preencher o suporte. |
| `lib/live-pages.ts` | Inclui o Admin de contas no ciclo existente de 90 segundos, com proteção de campos em edição; revisão automática incluída no patch. |
| `lib/order-emails.ts` | Reutiliza e-mail existente: contas recebem link para acesso privado, sem senha/imagem. |
| `lib/robux-pricing.ts` | Produtos → Preços delega à função compartilhada, preservando resultados, validações e a lógica própria de GamePass/Quick Buy. |
| `tests/fixture.ts` | Permite testar a aplicação das migrations até uma versão anterior, seguida da nova migration. |
| `tests/servers.test.ts` | Confere a participação do Admin de contas nas atualizações automáticas; revisão incluída no patch. |

Migrations anteriores não foram editadas. A lógica de GamePass/Quick Buy foi preservada; o módulo de preços compartilhado delega a curva histórica de produtos à função reutilizada pelas contas. ZIPs excluem dependências, build, cache de TypeScript, histórico Git e credenciais; preserve seus arquivos privados e a pasta Git.
