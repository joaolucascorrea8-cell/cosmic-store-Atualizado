# Cosmic Store — atualização completa

Esta versão foi reconstruída sobre uma cópia do ZIP original. O arquivo original foi preservado. O projeto mantém a estrutura Next.js App Router, TypeScript e Supabase, com a identidade da Cosmic Store e as integrações existentes.

Domínio oficial: **https://cosmic-store-blush.vercel.app**.

## Atualizar a loja existente

1. Extraia o projeto em uma pasta nova. Mantenha suas variáveis locais e as variáveis já configuradas na Vercel; o ZIP não contém credenciais reais.
2. Antes de publicar o código, execute **somente** esta nova migração no SQL Editor do Supabase:

   `supabase/migrations/202609300001_store_refinement.sql`

   O arquivo está inteiro dentro de uma transação e pode ser executado novamente. Ele preserva as tabelas existentes e acrescenta as operações usadas pelo painel e pelo checkout. Não é necessário executar novamente todas as migrações antigas em um banco que já estava funcionando.
3. Confira estas variáveis na Vercel:

   ```env
   NEXT_PUBLIC_SITE_URL=https://cosmic-store-blush.vercel.app
   NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=false
   ```

   Mantenha suas chaves Supabase, Pix, Gmail e Discord atuais. A chave secreta do Supabase continua restrita ao servidor.
4. No projeto extraído, use Node.js 20.9 ou superior e execute:

   ```bash
   npm ci
   npm run check
   npm run build
   ```

5. Suba o projeto atualizado ao GitHub e faça o deploy pela Vercel, seguindo o fluxo que você já utiliza.

O novo SQL é necessário: sem ele, o painel informa que não conseguiu carregar os indicadores e as novas operações de pedidos, combos e suporte não funcionam. Ele inclui `store_settings`, `order_stock_items`, o identificador de tentativa de suporte e as funções de banco correspondentes.

## Google, Discord e e-mail

O botão **Continuar com Google** fica oculto por padrão. O código Google, o handler, o callback e a identificação do provider permanecem implementados. Nenhuma configuração externa de provider, Client ID, Client Secret ou Search Console foi removida.

Quando o Branding for aprovado, altere `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED` para `true` na Vercel e faça um novo deploy. Essa variável pública é incorporada durante a compilação; mudar o valor sem recompilar não atualiza o botão.

Discord e e-mail continuam disponíveis. O login mantém a confirmação do endereço digitado no cadastro, mostrar/ocultar senha, sugestões para erros comuns de e-mail e retorno à página de origem depois de autenticar e concluir o perfil. O nickname fica na finalização do perfil.

O cadastro com entrada imediata por e-mail depende de **Confirm Email desligado no Supabase**, conforme o fluxo definido para a loja. Recuperação de senha continua por e-mail.

Foram preservados:

- A metatag de verificação em `app/layout.tsx`.
- `public/google36e3b47d67177414.html`.
- Sitemap com as nove rotas públicas principais.
- Home e política explicando o uso dos dados básicos do Google apenas para autenticação.
- Callback que diferencia Google e Discord, mantendo a integração com o servidor Discord apenas no login Discord.

## Loja e navegação

- Home organizada em destaque real do catálogo, jogos, categorias, produtos, combos, funcionamento da compra, avaliações e ajuda.
- Layout mais limpo, com carvão e violeta, espaçamentos consistentes, ícones e foco de teclado visível.
- Fonte local: a compilação não depende de buscar a fonte no Google.
- Grade de produtos com duas colunas em celulares, três em tablets e quatro em telas maiores.
- Busca por início das palavras, sem diferenciar acentos, com jogo, categoria, disponibilidade e ordenação.
- Paginação do catálogo e leitura das páginas do Supabase para não truncar silenciosamente listas maiores.
- Página de jogos com busca e contagem de categorias/produtos; página individual com navegação e categorias.
- Página de produto com localização no catálogo, itens relacionados, disponibilidade, preço e instruções claras de compra.
- Títulos específicos, endereços canônicos e dados estruturados do produto. Páginas privadas ficam fora da indexação.
- Menus de conta e mobile fecham com Escape e clique fora.
- Link para pular ao conteúdo e suporte a movimento reduzido.

## Produtos e catálogo no admin

O **Catálogo de produtos** reúne ordem, busca, filtros, preço, estoque e visibilidade. A gestão começa recolhida e abre quando solicitada.

- Filtros de busca, jogo, categoria e status preservados na sessão ao editar e voltar.
- Edição rápida de preço, estoque, estoque ilimitado e publicação por produto.
- Seleção de vários produtos para publicar, ocultar, definir estoque ou ajustar preços por percentual.
- Ordenação por arrastar, setas ou posição, preservando os itens fora do filtro.
- Destaque da Home escolhido pelo painel.
- Editor único para criar, editar e duplicar, com seleção de jogo/categoria, preço em formato brasileiro, prévia e feedback de gravação.
- **Salvar e voltar** e **Salvar e cadastrar outro**, mantendo a categoria no segundo caso.
- Duplicação gera um rascunho com estoque zero; não publica automaticamente a cópia.
- Identificadores gerados automaticamente com tratamento de colisões. A opção manual continua disponível.
- Imagens com seleção, arrastar/soltar e colar; gravação do produto aguarda o upload.
- Aviso ao fechar a página com alterações não salvas.
- Exclusão de produto inativo bloqueada se houver pedido em andamento; produtos usados por combos precisam ser retirados deles antes da exclusão.

Jogos e categorias continuam concentrados em uma gestão recolhível, com capas, edição e ordem manual. Foram adicionadas busca e filtragem de categorias por jogo, preservadas na sessão.

A limpeza de imagens de catálogo verifica referências em produtos, jogos, categorias, combos e campanhas antes de excluir uma imagem compartilhada.

## Combos

- Cadastro e edição pelo mesmo editor.
- Nome, preço brasileiro, descrição, capa, produtos e quantidades.
- Validade opcional interpretada no horário de Brasília.
- Busca/filtros preservam os produtos já selecionados.
- Edição conserva o endereço original do combo.
- Combo e componentes são gravados na mesma transação.
- Publicação valida produtos/jogos ativos, preço e prazo.
- Preço anterior só aparece quando representa economia real.
- Divulgação por Discord/e-mail continua opcional. Criar ou editar sem marcar os canais não dispara divulgação.

## Carrinho, checkout e pedidos

- Carrinho com identidade separada para produto e combo, limites de quantidade, validação dos dados armazenados e sincronização entre abas.
- Falhas de armazenamento do navegador não derrubam a interface.
- Checkout em dados, Pix e comprovante, com nickname e tentativa preservados na sessão.
- Recarregar retoma o pedido existente; um pedido aguardando pagamento também pode ser aberto em Meus pedidos para continuar o Pix.
- Tentativas repetidas com o mesmo identificador retornam o mesmo pedido.
- Preços, componentes e estoque são conferidos no servidor e no banco.
- Pedido, itens e fotografia dos componentes de estoque são criados juntos.
- Alterar um combo depois da compra não altera a composição congelada do novo pedido.
- Confirmação de pagamento baixa estoque uma vez; cancelamento devolve exatamente o que foi baixado, uma vez.
- Uma confirmação com estoque insuficiente é desfeita integralmente.
- Transições inválidas e alterações baseadas em uma tela administrativa desatualizada são recusadas.
- Entrega mantém a exigência de imagem da equipe no chat antes do e-mail final.
- Comprovantes ficam privados; upload usa nome único e o registro verifica arquivo, dono, pedido e situação atual.
- O carrinho só é limpo se ainda corresponder à compra. Itens acrescentados posteriormente são preservados.
- Meus pedidos tem busca, filtro, paginação, datas em Brasília e cópia do nickname.
- Histórico administrativo, situação de preparação da entrega e reenvio de e-mail continuam disponíveis.

A fotografia de componentes está disponível nos novos pedidos. Pedidos antigos ainda não pagos recebem a fotografia na confirmação. Pedidos já pagos antes desta versão, sem registro histórico de componentes, usam o comportamento de compatibilidade da composição disponível no banco para restauração; o sistema não inventa uma composição histórica que não foi registrada.

## Admin, suporte e avaliações

- Visão geral com pagamentos do dia/mês no horário de Brasília, comprovantes pendentes, fila de entrega, suporte e estoque.
- Pedidos e suporte pesquisados e paginados no banco, inclusive além da primeira página, com prioridades e indicadores globais.
- Barra compacta de pendências e navegação mobile com rolagem própria.
- Cópia de nickname/código, confirmação de cancelamento e retorno ao histórico do pedido.
- Ticket e primeira mensagem criados atomicamente, com identificador de tentativa para evitar duplicação.
- Rascunho de suporte mantido durante falhas e removido quando a abertura é concluída.
- Respostas rápidas no chat administrativo: apenas preenchem o rascunho; a equipe revisa e envia.
- Encerramento e reabertura atualizam a conversa já aberta por Realtime ou polling.
- Mensagens comuns na conversa visível podem ser marcadas como lidas sem som. Comprovantes e eventos importantes continuam avisando.
- Avaliações com busca, origem, visibilidade, nota e paginação; importador Discord recolhido.
- Selos **✓ Compra verificada** e **✓ Compra verificada • Discord** preservados.
- Imagens de avaliações continuam privadas, com URL assinada, e fora da limpeza dos anexos de chat.
- Moderação com denúncias legíveis, resolução de denúncia, restrições ativas e remoção de banimento/silenciamento. Administradores não podem ser banidos ou silenciados por essa tela.

## Verificações

- `npm run check`: lint, TypeScript e 24 testes automatizados.
- `npm run build`: compilação de produção do Next.js.
- Migrações executadas em PostgreSQL local via PGlite, incluindo repetição da nova migração.
- Cenários de idempotência, estoque insuficiente, rollback, combos editados, estoque ilimitado, pedidos anteriores, paginação e permissões das funções.
- 72 verificações de páginas no Chromium em 1440 px e 390 px, com dados fictícios: todas abriram e nenhuma apresentou rolagem lateral indevida.
- 11 verificações de fluxos no navegador: Google oculto, carrinho, retomada do checkout, envio de comprovante, filtros do admin, cadastro com salvar outro, edição de combo, suporte, respostas rápidas, fechamento/reabertura e restrição de acesso ao admin.
- Nenhum erro JavaScript nas páginas inspecionadas.
- Conferência de integridade do ZIP e do arquivo original.

A validação local não utiliza as credenciais privadas da loja. Login OAuth real, SMTP, webhook Discord, upload no Storage real e um Pix real precisam ser conferidos no ambiente com suas configurações. O código dessas integrações foi preservado; os testes locais não enviaram e-mails, publicações ou pagamentos reais.

## Conteúdo do ZIP

Projeto completo, assets existentes, fonte local e licença, migrações, `.env.example`, testes e documentação. Não inclui `node_modules`, `.next`, histórico `.git`, credenciais locais ou dados fictícios usados na inspeção visual. Os dados reais do catálogo e dos pedidos permanecem no Supabase.
