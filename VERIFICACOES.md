# Verificações — servidores e atualização das páginas (04/10/2026)

Base: cópia de `cosmic-store-completa - Copia(20261004-132051).zip`. O ZIP original não foi modificado.

## Código e banco

- Instalação limpa com `npm ci`, Node.js 24 e Next.js 16.3.8.
- Lint e TypeScript aprovados.
- 30 testes automatizados aprovados: os 24 existentes e 6 novos.
- Build de produção aprovado, com as rotas `/servidores`, `/servidores/pedir` e `/admin/servidores`.
- Migrações executadas em PostgreSQL/PGlite; nova migração reaplicada com dados já inseridos.
- Testes de pedido para jogo fora do catálogo, validação, criação atômica da conversa e prevenção de duplicação.
- Testes de filtros do suporte, RLS para servidores ocultos e sinais administrativos, permissões das novas funções e publicação Realtime.
- Teste de atualização de sinal ao inserir, ocultar e excluir servidor.
- `package.json` e `package-lock.json` preservados, inclusive a atualização anterior do Next.js para 16.3.8.
- Arquivos de OAuth, confirmação de pagamentos, feature flag e verificação HTML do Google preservados. A metatag de verificação do Google permanece no layout.

## Navegador

20 verificações de telas em 1440 px e 390 px, com respostas 200, sem overflow horizontal e sem erro JavaScript capturado.

- Link de entrada preservado; solicitação exige login e mantém retorno.
- Admin cadastra servidor de jogo livre e limpa formulário.
- Atualização adiada preserva rascunho; descartar libera atualização.
- Ocultar remove servidor da página aberta sem perder busca.
- Servidor oculto pode ser excluído pelo admin.
- Pedido de servidor fora do catálogo abre conversa e limpa rascunho.
- Admin filtra solicitações e abre resposta pelo suporte existente.
- Notificações recebem novos itens e sincronizam leitura de outra aba.
- Preço público atualiza na página de produto aberta.
- Estoque no admin atualiza sem perder o filtro do catálogo.
- Novos pedidos aparecem na lista aberta mantendo o filtro.
- Google continua oculto e Discord disponível.
- Cliente comum não acessa gestão de servidores.

O teste de consultas periódicas no navegador usa intervalos acelerados em ambiente de teste, mantendo a lógica de detecção de alterações e proteção de rascunhos. Em produção, valem os intervalos de 10, 15 e 30 segundos descritos em ATUALIZACAO.md.

## Auditoria de dependências

- `npm audit --omit=dev`: **0 vulnerabilidades** na execução de 04/10/2026.
- `npm audit`: **5 avisos de severidade alta** da mesma cadeia de desenvolvimento: braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next.
- Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm, atualizado em 02/10/2026, sem versão corrigida publicada; braces 3.0.3 é a versão disponível consultada.
- O pacote está na cadeia de ferramentas de lint, sem ocorrência no audit de produção. Esse resultado não significa que toda dependência de desenvolvimento esteja livre de risco.
- `npm audit fix --force` propõe retornar eslint-config-next para 14.2.35. Essa regressão incompatível com a versão atual do projeto não foi aplicada. Não foi feito override artificial apenas para silenciar o aviso.

## Limites

O navegador usou um serviço local com respostas simuladas do Supabase e contas, servidores e pedidos fictícios. Os dados desses testes não estão no banco real nem são cadastrados pelo SQL entregue. Regras do banco foram executadas separadamente em PostgreSQL/PGlite.

Supabase Auth/Storage/Realtime de produção, OAuth real, SMTP, Discord e Pix reais não foram acionados. Nenhum deploy, alteração de banco externo ou mensagem externa foi realizado. Após aplicar o SQL e publicar, confira os fluxos com as variáveis reais da loja.

## Histórico da validação de 30/09/2026

A execução usou uma instalação limpa com `npm ci`, Node.js 24, Next.js 16.3.4 e PostgreSQL local via PGlite. As credenciais usadas na inspeção do navegador eram fictícias.

- Lint sem erros ou avisos.
- TypeScript sem erros.
- 24 testes automatizados aprovados.
- Compilação de produção aprovada.
- Nova migração reaplicada no banco de teste sem perda de dados de estrutura.
- Original ZIP e 12 assets originais conferidos e preservados.

## Navegador

72 verificações em 1440 px e 390 px. Todas as respostas foram 200; nenhuma página apresentou largura maior que a tela. Nenhum erro JavaScript capturado.

Os fluxos verificados foram:

- Google oculto; Discord e cadastro por e-mail disponíveis.
- Carrinho: adicionar, persistir ao recarregar e alterar quantidade.
- Checkout: pedido e Pix criados; recarregar retoma o mesmo pedido.
- Comprovante enviado, pedido atualizado e carrinho correspondente limpo.
- Admin: filtro preservado ao editar e voltar.
- Admin: cadastro com preço brasileiro e salvar outro mantendo categoria.
- Admin: edição de combo conserva a URL.
- Suporte: abertura limpa rascunho; resposta rápida só preenche texto.
- Suporte: encerramento e reabertura atualizam a conversa aberta.
- Cliente sem permissão redirecionado ao tentar abrir admin.
- APIs: conversa própria disponível e pedido inexistente recusado.

## Limites da validação

O navegador usou um servidor local que simula as respostas do Supabase, com produtos, contas e pedidos de teste. Isso permite verificar a interface e os fluxos sem alterar a loja real. As regras transacionais foram executadas separadamente em PostgreSQL/PGlite com as migrações do projeto.

O teste de banco cria estruturas equivalentes de `auth` e `storage`; não executa os serviços externos Supabase Auth/Storage, SMTP, Discord ou bancos Pix. OAuth real, entrega de e-mails, webhook, Storage real e pagamento real devem ser conferidos com as variáveis do ambiente da loja. Nenhum deploy ou mensagem externa foi realizado.
