# Arquivos — organização, entrega e política

Comparação com o checkpoint da primeira entrega de Contas com Robux. **14 arquivos criados, 22 modificados; nenhum arquivo de código removido.**

## Criados

| Arquivo | Finalidade |
| --- | --- |
| `ARQUIVOS-AJUSTE-CONTAS.md` | Lista os arquivos desta revisão e a finalidade de cada alteração. |
| `ATUALIZACAO-ENTREGA-E-POLITICA.md` | Instalação desta revisão, chave, SQL, política, operação e testes. |
| `app/admin/robux/contas/AccountDeliveryForm.tsx` | Campos de usuário, senha oculta e instruções; salvamento com retorno amigável. |
| `app/admin/robux/contas/AccountPolicyForm.tsx` | Editor da política pública com controle de versão e conflito. |
| `app/api/robux/accounts/delivery/[id]/route.ts` | Entrega de credenciais apenas ao dono de pedido entregue, sem cache. |
| `app/pedidos/[id]/AccountDelivery.tsx` | Primeiro acesso, mostrar/copiar dados e link para relatar problema. |
| `app/reembolso/contas/page.tsx` | Página pública da política vigente com orientações e suporte. |
| `lib/robux-accounts/credentials-crypto.ts` | AES-256-GCM, validação, nonce aleatório e vínculo ao pedido. |
| `lib/robux-accounts/delivery.ts` | Autorização, consulta e decifragem das entregas no servidor. |
| `lib/robux-accounts/policy.ts` | Leitura explícita dos campos seguros da política vigente. |
| `lib/robux-accounts/presentation.ts` | Agrupa opções equivalentes sem alterar a identidade da oferta comprada. |
| `supabase/migrations/202610090002_robux_account_delivery_policy.sql` | Política, aceite imutável, credenciais cifradas, RLS, RPCs e trava de entrega. |
| `supabase/verificacoes/202610090002_check.sql` | Verificação sem escrita e sem exibir senhas ou dados privados. |
| `tests/robux-account-delivery-policy.test.ts` | Oito testes de criptografia, agrupamento, política, entrega, concorrência e RLS. |

## Modificados

| Arquivo | Finalidade |
| --- | --- |
| `.env.example` | Documenta a chave secreta de criptografia das entregas; não contém chave real. |
| `ARQUIVOS-CONTAS-ROBUX.md` | Manifesto completo comparado ao ZIP original recebido. |
| `CONTAS-COM-ROBUX.md` | Guia consolidado da modalidade, com instalação da revisão. |
| `VALIDACAO-CONTAS-ROBUX.md` | Resultados dos 93 testes, build, navegador e limites da validação. |
| `app/admin/pedidos/[id]/page.tsx` | Integra painel da conta e atualiza botões, orientações e rótulos de auditoria. |
| `app/admin/robux/contas/AccountOrderPanel.tsx` | Organiza aquisição, dados de entrega, snapshot e regras operacionais privadas. |
| `app/admin/robux/contas/actions.ts` | Admin salva margem, política versionada e credenciais cifradas com autenticação. |
| `app/admin/robux/contas/page.tsx` | Sincronização/margem/ofertas/pedidos, com editor da política integrado. |
| `app/api/robux/accounts/catalog/route.ts` | Catálogo seguro; sincronização com after() sem bloquear filtros. |
| `app/api/robux/accounts/orders/route.ts` | Autenticação, nova validação externa, preço, aceite e criação transacional. |
| `app/checkout/CheckoutContent.tsx` | Aviso específico de conta e acesso à política do pedido antes do Pix. |
| `app/components/LegalPage.tsx` | Permite data de atualização específica mantendo o padrão das outras páginas. |
| `app/pedidos/[id]/page.tsx` | Dados seguros, política lida, entrega privada e textos de e-mail por modalidade. |
| `app/reembolso/page.tsx` | Inclui acesso à política específica de contas mantendo o conteúdo geral. |
| `app/robux/contas/AccountCatalog.tsx` | Lista de 12 opções, faixas, filtros, resumo e leitura obrigatória antes do Pix. |
| `app/robux/contas/page.tsx` | Introdução, navegação das modalidades e etapas da compra. |
| `app/suporte/SupportForm.tsx` | Preenche contexto do pedido e preserva rascunhos separados por atendimento. |
| `app/suporte/page.tsx` | Confere propriedade do pedido antes de preencher o suporte. |
| `lib/order-emails.ts` | Reutiliza e-mail existente: contas recebem link para acesso privado, sem senha/imagem. |
| `lib/robux-accounts/service.ts` | Cache, filtros agrupados, margem, revalidação e dados públicos mínimos. |
| `tests/fixture.ts` | Aplica migrations na ordem real, testando reexecução antiga sem sobrescrever funções novas. |
| `tests/robux-accounts-database.test.ts` | Adapta a criação ao aceite e verifica entrega, reservas e Quick Buy. |

Migrations antigas não foram editadas. O ZIP exclui dependências, build, histórico Git e credenciais; preserve os arquivos privados e a pasta Git no seu repositório.
