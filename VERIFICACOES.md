# Verificações da atualização

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
