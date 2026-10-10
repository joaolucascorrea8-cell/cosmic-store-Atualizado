# Arquivos — correção dos avisos nos pedidos

Comparação com o checkpoint imediatamente anterior à correção do React #441: **4 criados, 6 modificados; nenhum removido.**

## Criados

| Arquivo | Alteração |
| --- | --- |
| `ARQUIVOS-CORRECAO-PEDIDOS.md` | Manifesto dos arquivos criados/modificados nesta correção, comparado ao checkpoint anterior. |
| `CORRECAO-ERROS-PEDIDOS.md` | Explica React #441, instalação do patch, configuração exata da chave, Git, deploy e testes. |
| `app/admin/pedidos/OrderStatusActions.tsx` | Formulário com useActionState, avisos acessíveis, bloqueio durante envio e confirmação de cancelamento. |
| `qa/check-admin-order-actions.cjs` | Regressão HTTP dos formulários reais: faltas de print/dados, SQL, concorrência, chave, cifragem e conclusão sem imagem, com Supabase fictício. |

## Modificados

| Arquivo | Alteração |
| --- | --- |
| `ARQUIVOS-CONTAS-ROBUX.md` | Manifesto completo atualizado em comparação com o ZIP original. |
| `CONTAS-COM-ROBUX.md` | Guia consolidado de contas, preços, migrations, operação, segurança e referência à correção de avisos. |
| `VALIDACAO-CONTAS-ROBUX.md` | 99 testes, build e resultados dos formulários reais por HTTP; registra as limitações de validação visual e produção. |
| `app/admin/pedidos/[id]/page.tsx` | Integra o painel privado de contas e o formulário de atualização com avisos inline, preservando o fluxo dos demais pedidos. |
| `app/admin/pedidos/actions.ts` | Mantém transições atômicas e proteções da loja; retorna recusas esperadas ao formulário, preservando avisos/e-mails após mudança válida. |
| `app/admin/robux/contas/AccountOrderPanel.tsx` | Snapshot, fornecedor e entrega privados; instruções da chave na Vercel junto à configuração ausente. |

Não há migration nova ou alteração de variáveis nesta revisão. `ROBUX_ACCOUNT_DELIVERY_KEY` já fazia parte da entrega por credenciais e agora tem instruções na tela. A configuração 34/5, o catálogo, o Pix, a autenticação, os e-mails e o Quick Buy permanecem iguais.

O patch contém os arquivos desta lista, com seus caminhos relativos à raiz do projeto. O projeto completo inclui todas as revisões anteriores. Checkpoint: `cosmic-store-antes-correcao-erros-pedidos.zip`.
