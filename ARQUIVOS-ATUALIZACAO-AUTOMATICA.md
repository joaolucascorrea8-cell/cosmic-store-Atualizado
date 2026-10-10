# Arquivos — atualização automática das contas

Comparação com o checkpoint anterior (correção de avisos enviada pelo usuário no commit `936b73c`): **2 criados, 8 modificados; nenhum removido.**

## Criados

| Arquivo | Alteração |
| --- | --- |
| `ARQUIVOS-ATUALIZACAO-AUTOMATICA.md` | Lista dos arquivos desta revisão com finalidade e comparação ao checkpoint. |
| `ATUALIZACAO-AUTOMATICA-CONTAS.md` | Explica funcionamento, limites, instalação do patch, Git/deploy, validação e roteiro de testes. |

## Modificados

| Arquivo | Alteração |
| --- | --- |
| `ARQUIVOS-CONTAS-ROBUX.md` | Manifesto completo das alterações desde o ZIP original. |
| `CONTAS-COM-ROBUX.md` | Guia consolidado atualizado com início automático e verificações durante uso da vitrine ou Admin. |
| `VALIDACAO-CONTAS-ROBUX.md` | Registra 99 testes/build e comprovação HTTP de início automático; informa limites de inspeção visual. |
| `app/admin/robux/contas/page.tsx` | Painel/configurações privados; inicia a consulta pública após a resposta, com instruções sobre atualização automática e botão opcional. |
| `app/robux/contas/AccountCatalog.tsx` | Mantém catálogo, filtros, compra e política; informa Atualização automática e renomeia o botão opcional para Atualizar agora. |
| `lib/live-pages.ts` | Inclui somente /admin/robux/contas na atualização a cada 90 segundos, usando a proteção de campos em edição já existente. |
| `qa/check-admin-order-actions.cjs` | Regressão HTTP: acesso/renderização do Admin inicia verificação sem botão; preserva testes de avisos, credenciais e entrega. |
| `tests/servers.test.ts` | Mantém regressões de servidores e garante que o Admin de contas participe das atualizações automáticas. |

Sem migrations/SQL ou variáveis novas. O serviço de sincronização, parser, banco, cache e lease são os existentes. Nenhuma alteração de preços, dados de pedidos, autenticação, pagamentos, entrega, e-mails ou lógica do Quick Buy. O botão é opcional; vitrine e Admin visíveis mantêm verificações automáticas. Com ambos fechados, a leitura retoma no próximo acesso.
