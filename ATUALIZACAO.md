# Cosmic Store — favoritos, cupons e admin mais prático

Entrega de 04/10/2026. Esta versão foi feita em uma nova cópia de `cosmic-store-servidores-atualizada.zip`, a entrega mais recente disponível, que já continha os servidores e a atualização automática das páginas. Os ZIPs anteriores e o arquivo original enviado foram preservados.

## Como atualizar a loja que já está funcionando

1. Extraia o ZIP. Copie o conteúdo da pasta `cosmic-store` para a pasta do seu projeto conectado ao GitHub, substituindo os arquivos correspondentes. Preserve sua pasta `.git`, seu `.env.local` e as variáveis da Vercel.
2. **Antes de publicar o código, execute no SQL Editor do Supabase o arquivo inteiro:**

   `supabase/migrations/202610040002_customer_tools.sql`

   Ele depende da atualização anterior `202610040001_servers_live_pages.sql`. Se você já aplicou a atualização dos servidores, execute somente o novo arquivo `002`. Se pulou aquela entrega, aplique primeiro `001`, depois `002`. Não reaplique todas as migrações antigas em um banco já funcionando. O novo arquivo é transacional e pode ser reaplicado sem apagar contas, produtos, pedidos, cupons ou favoritos.
3. No terminal do projeto, execute:

   ```bash
   npm ci
   npm run check
   npm run build
   ```

4. Depois envie ao GitHub usando o fluxo habitual:

   ```bash
   git add .
   git commit -m "Adiciona favoritos cupons e melhorias no admin"
   git push
   ```

   Se o Git informar `fetch first`, integre o remoto com `git pull --rebase origin main`. Havendo conflito, resolva os arquivos antes de continuar o rebase e enviar. Não use envio forçado para contornar o conflito.
5. Após o deploy, abra **Admin → Atendimento e entrega**, confira o prazo e salve os horários reais da equipe. O prazo padrão inicial continua em 24 horas e os horários começam ocultos. Não foram cadastrados cupons ou servidores fictícios no banco de produção.
6. Confira um produto, salve um favorito, crie um cupom de teste e verifique o resumo antes de gerar um pedido. As verificações desta entrega usaram banco local e integrações simuladas; seu ambiente real precisa receber o SQL e o novo deploy.

A loja permanece em português e BRL/Pix. As integrações, o domínio oficial, a verificação Google/Search Console e o botão Google oculto foram preservados. Nenhuma nova variável de ambiente ou dependência foi adicionada. Mantenha `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=false` enquanto aguarda a aprovação.

## O que foi acrescentado e onde usar

### Produtos e modelos de descrição

A loja já tinha **Duplicar** no catálogo administrativo. Essa função foi reaproveitada: o novo item continua como rascunho, com estoque zero e identificador próprio. A cópia agora carrega também o prazo específico do produto, se existir.

Em **Admin → Jogos e categorias → Gerenciar categorias**, abra a categoria e preencha **Modelo de descrição da categoria**. Há sugestões para item digital, fruta permanente, fruta física e gamepass. Personalize antes de salvar. `{{produto}}` e `{{jogo}}` são substituídos pelos nomes no editor.

No cadastro/edição do produto, escolha a categoria e clique em **Usar modelo da categoria**. Se já houver uma descrição, o editor pede confirmação para substituí-la. Salvar um modelo não altera descrições já publicadas.

### Central de pendências

A visão geral do admin ganhou filas com atalhos diretos para conferir pagamentos, preparar entregas, responder suporte, atender pedidos de servidor e revisar problemas relatados. As filas mostram até quatro itens e um link para a lista completa; os números consideram todos os registros. Entregas com prazo ultrapassado recebem destaque.

### Favoritos e reposição

O coração nos produtos salva a seleção na conta. **Minha conta → Favoritos e reposição** concentra os itens e avisos solicitados, sem acrescentar outro item ao menu público principal.

Em um produto esgotado, **Avise quando voltar** registra um pedido de aviso. Quando o estoque voltar e o produto/jogo estiver publicado, o banco cria uma notificação no site para quem solicitou e desativa aquele aviso. A operação é atômica e não envia notificações repetidas a cada edição. Um novo aviso exige nova solicitação. Não há envio de e-mail em massa ou reserva de estoque. É possível cancelar o aviso na conta.

As preferências são privadas por usuário. Produtos que forem ocultados aparecem como indisponíveis na seleção, com opção de remover a preferência. Excluir o produto remove suas preferências associadas.

### Servidores

Os servidores públicos agora ficam agrupados pelo nome do jogo. Buscas continuam disponíveis. No admin, **Estado do servidor** permite escolher Disponível, Em manutenção ou Temporariamente indisponível. O estado é manual e não representa lotação monitorada. A manutenção mantém o cartão visível e desativa o link de entrada; Oculto retira o cartão da lista.

**Reportar problema** exige login. O usuário escolhe o motivo e pode explicar o ocorrido. A equipe recebe notificação interna e acompanha os avisos em **Admin → Servidores → Problemas relatados**, com paginação. Um usuário não gera vários avisos abertos para o mesmo servidor; há limite de cinco novos relatos por dia. Depois de conferir/corrigir, a equipe marca como resolvido.

### Atendimento e prazo de entrega

**Admin → Atendimento e entrega** configura o prazo padrão, horários por dia e um aviso opcional. Os horários usam Brasília; não bloqueiam compras fora do atendimento.

O prazo pode ser definido em três níveis: produto → jogo → padrão da loja. Campo vazio no produto ou jogo utiliza o próximo nível. São aceitas de 1 a 720 horas corridas após a confirmação do pagamento. Em um carrinho com vários itens ou combos, vale o maior prazo dos produtos envolvidos. O horário de atendimento não pausa essa contagem.

O resumo do checkout consulta o prazo antes do Pix. Ao criar o pedido, o prazo fica salvo. Alterações posteriores não mudam pedidos existentes; a confirmação do pagamento calcula a data prevista usando o prazo salvo. Pedidos antigos mantêm o fluxo anterior. Termos e reembolso foram alinhados ao prazo registrado, preservando os direitos e regras restantes.

### Cupons

Em **Admin → Cupons**, crie um código, escolha percentual (até 99%) ou valor fixo em reais, compra mínima, limite total, limite por cliente, início/fim opcionais e status ativo. Os horários de validade são informados em Brasília (UTC−3).

Pode valer para todos os produtos, produtos de um jogo ou um produto específico. Cupons de jogo/produto não incluem combos. Nos cupons gerais, você escolhe se combos também participam. O desconto afeta apenas os itens elegíveis; a compra mínima considera o subtotal inteiro. O desconto não ultrapassa o valor elegível e preserva o total mínimo de R$ 0,01.

No checkout, o cliente informa o código e clica em Aplicar. O desconto aparece no resumo, no Pix, nos detalhes do pedido do cliente/admin e nos e-mails de confirmação/entrega. É permitido um cupom por pedido. Não é possível aplicar cupom a um Pix já criado.

O banco recalcula valores e limita usos dentro da transação de criação do pedido. O uso conta ao gerar o pedido, mesmo antes do pagamento, e é liberado se a equipe cancelar o pedido. Pedidos aguardando pagamento não expiram automaticamente. Repetir o mesmo envio não cria outro pedido nem consome outro uso. Editar/pausar/expirar o cupom não altera os valores de pedidos já criados.

### Extras

- **Compartilhar produto:** usa o compartilhamento do aparelho, quando disponível, ou copia o link.
- **Comprar novamente:** aparece nos pedidos entregues/cancelados, consulta os produtos e combos atuais, ajusta quantidades ao estoque e adiciona ao carrinho sem apagar os itens que já estavam lá. Preços atuais são utilizados e cupons antigos não são reaplicados. Itens indisponíveis são informados ao cliente.
- A Central de Ajuda e a Política de Privacidade explicam os novos recursos.
- Atualizações automáticas também cobrem favoritos e as novas áreas administrativas, preservando campos em edição.

## Verificações desta entrega

- `npm run check`: lint e TypeScript aprovados, 41 testes passando.
- `npm run build`: build de produção aprovado.
- Navegador: 30 combinações de tela/largura (1440 e 390 px) e 11 fluxos completos, sem erros JavaScript observados e sem transbordamento horizontal nos casos conferidos.
- SQL real em PostgreSQL local (PGlite): limites e idempotência de cupons, desconto por item elegível, prazos congelados, privacidade, reposição única, relatos e reaplicação da migração.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas.
- `npm audit` completo: permanecem 5 alertas altos na cadeia de desenvolvimento `braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next`. A sugestão automática seria reduzir `eslint-config-next` para 14.2.35; essa alteração incompatível com a stack atual não foi aplicada. Os arquivos de dependências foram preservados.

O ZIP contém todo o código, assets, migrações e testes. Não contém `.next`, `node_modules`, credenciais, dados de teste do navegador ou histórico Git. As integrações de produção (Supabase, OAuth, Storage, SMTP, Discord e Pix real) não foram acionadas por esta execução.

---

## Histórico da entrega anterior: servidores e atualização automática

As instruções abaixo pertencem à entrega anterior. Para instalar esta versão, siga primeiro o procedimento no início deste documento.

# Cosmic Store — atualização completa

A atualização de 04/10/2026 foi feita sobre uma cópia do ZIP mais recente enviado, cosmic-store-completa - Copia(20261004-132051).zip. A versão anterior foi reconstruída sobre uma cópia do ZIP original. O arquivo original foi preservado. O projeto mantém a estrutura Next.js App Router, TypeScript e Supabase, com a identidade da Cosmic Store e as integrações existentes.

Domínio oficial: **https://cosmic-store-blush.vercel.app**.

## Atualizar a loja existente

1. Extraia o projeto em uma pasta nova. Mantenha suas variáveis locais e as variáveis já configuradas na Vercel; o ZIP não contém credenciais reais.
2. Antes de publicar o código, execute **somente** esta nova migração no SQL Editor do Supabase:

   `supabase/migrations/202610040001_servers_live_pages.sql`

   O arquivo está inteiro dentro de uma transação e pode ser executado novamente. Ele acrescenta servidores, solicitações e sinais de atualização das páginas. Este passo pressupõe que as migrações anteriores, incluindo 202609300001_store_refinement.sql, já foram aplicadas no banco que está funcionando. Não execute novamente todas as migrações antigas. Para uma instalação nova, aplique todas em ordem cronológica.
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

O novo SQL é necessário para a área de servidores e o filtro atualizado de suporte. Ele cria game_servers, acrescenta requested_game aos atendimentos e cria store_live_updates com sinais públicos do catálogo e sinais administrativos protegidos por RLS. Pedidos, pagamentos, estoque e atendimentos existentes são preservados.

## Novidades de 04/10/2026 — servidores e páginas atualizadas

A loja permanece em português, com preços em reais e checkout Pix. Não foi adicionada versão em inglês nem cobrança internacional.

### Servidores

- `/servidores`: lista pública, busca por jogo/nome, nomes clicáveis e botão de entrada. O endereço não aparece como texto, mas está associado ao link e não é segredo.
- `/servidores/pedir`: exige login, aceita um nome de jogo livre e a descrição do pedido. Não depende de jogo cadastrado no catálogo. O rascunho fica na sessão do navegador e é apagado após envio bem-sucedido.
- `/admin/servidores`: cadastro, edição, capa opcional (mesmo upload já usado na loja), posição numérica e visibilidade. Para excluir, oculte primeiro. Alterações concorrentes em outra tela são recusadas até atualizar os dados.
- Pedidos de servidor usam os atendimentos existentes. Recebem categoria própria, notificação administrativa e aviso via webhook Discord quando configurado. A equipe responde em `/admin/suporte`; o cliente acompanha em `/suporte`.
- O suporte administrativo ganhou filtro **Pedidos de servidor**, também acessível pela nova área do admin.
- A solicitação não cobra nem cria automaticamente um servidor no Roblox. O admin deve disponibilizar um link válido e responder à pessoa.

### Atualização automática

- Home, jogos, produtos, categorias, combos, avaliações e servidores recebem avisos do banco e atualizam os dados sem recarregar a página inteira.
- Painel, pedidos, suporte, servidores, catálogo e avaliações do admin também são atualizados, com proteção para campos e operações pendentes.
- Sinais públicos avisam inclusive quando um produto/servidor é ocultado ou excluído; não expõem linhas privadas. Sinais de movimentações administrativas exigem permissão de admin.
- Consultas de apoio ocorrem a cada 15 segundos para listas privadas e algumas áreas do admin, e 30 segundos para catálogo/servidores. Onde são usados sinais, a leitura de dados completos só acontece quando o sinal muda ou após até 60 segundos, também para refletir combos que expiram pelo horário.
- A sincronização retoma ao voltar para a aba ou recuperar a conexão. Atualizações automáticas ficam suspensas em abas ocultas e quando estiver sem conexão.
- Filtros, busca, paginação e posições de rolagem são preservados. Campos em edição e rascunhos ficam protegidos; um aviso informa quando há novidades aguardando. Salve ou descarte a edição para liberar a atualização.
- A lista de notificações agora sincroniza mensagens novas e leitura feita em outra aba, com consulta de apoio a cada 10 segundos.
- Os chats e o acompanhamento individual do pedido mantêm seus mecanismos existentes. A regra de som para comprovantes e novos pedidos foi preservada.

### Publicar esta versão

1. Aplique o novo SQL no Supabase **antes** de publicar o código.
2. Copie os arquivos do projeto atualizado para o repositório que você já utiliza, mantendo sua pasta `.git` e seu `.env.local`. O ZIP entregue não contém esses dados locais.
3. Rode `npm ci`, `npm run check` e `npm run build`.
4. Envie ao GitHub pelo fluxo habitual. A Vercel deve continuar usando o domínio oficial e as variáveis atuais.
5. Depois do deploy, cadastre um link de teste no admin e teste a entrada e uma solicitação em uma conta comum.

Os comandos usuais, dentro do seu repositório existente, são:

```bash
git status
git add .
git commit -m "Adiciona servidores e melhora atualização das páginas"
git push
```

Não foi feito deploy nem alteração no Supabase de produção durante esta execução.

## Google, Discord e e-mail

O botão **Continuar com Google** fica oculto por padrão. O código Google, o handler, o callback e a identificação do provider permanecem implementados. Nenhuma configuração externa de provider, Client ID, Client Secret ou Search Console foi removida.

Quando o Branding for aprovado, altere `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED` para `true` na Vercel e faça um novo deploy. Essa variável pública é incorporada durante a compilação; mudar o valor sem recompilar não atualiza o botão.

Discord e e-mail continuam disponíveis. O login mantém a confirmação do endereço digitado no cadastro, mostrar/ocultar senha, sugestões para erros comuns de e-mail e retorno à página de origem depois de autenticar e concluir o perfil. O nickname fica na finalização do perfil.

O cadastro com entrada imediata por e-mail depende de **Confirm Email desligado no Supabase**, conforme o fluxo definido para a loja. Recuperação de senha continua por e-mail.

Foram preservados:

- A metatag de verificação em `app/layout.tsx`.
- `public/google36e3b47d67177414.html`.
- Sitemap com as rotas públicas anteriores e a nova página /servidores.
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
