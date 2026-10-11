# Cosmic Store — reformulação da página inicial

## Revisão — retirada de Combos da loja pública

- Removido dos menus desktop/mobile, rodapé, atalhos da home, busca por serviços e link no catálogo.
- /combos e /combo/[slug] agora redirecionam permanentemente para /jogos; /combos saiu do sitemap.
- Administração, banco e histórico de pedidos permanecem disponíveis para compatibilidade com registros existentes.
- Nenhuma migração ou variável nova.
- Validação: build e lint aprovados, dois testes de busca aprovados e navegação desktop/mobile conferida; redirecionamentos HTTP 308 e sitemap verificados localmente.
- Arquivos: app/components/StoreNav.tsx, app/components/HeaderMobileMenu.tsx, app/components/SiteFooter.tsx, app/produtos/page.tsx, app/sitemap.ts, app/combos/page.tsx, app/combo/[slug]/page.tsx, lib/storefront-search.ts, next.config.ts e tests/storefront-search.test.ts.


## Revisão final — home como apresentação da loja

Esta revisão substitui a organização da home descrita no histórico abaixo.

- Prévia com até quatro jogos ativos, na ordem do Admin, e botão “Ver todos os jogos”.
- Removidas da home a grade de produtos, os atalhos de categorias, o produto em destaque e a grade de combos. Combos continuam acessíveis pelos links existentes.
- Robux e Contas com Robux ocupam dois blocos lado a lado.
- Busca, avaliações, benefícios, ajuda e privacidade preservados.
- A home consulta apenas jogos e avaliações; o catálogo completo continua nas páginas próprias.
- Arquivos desta revisão: app/page.tsx, app/components/home/HomeOffers.tsx e app/components/home/Storefront.module.css.
- Verificação: lint e build aprovados; navegação e busca verificadas com dados locais de teste; layouts 320, 390, 768, 1024 e 1440 sem overflow. Não houve teste de pagamento real.

## Histórico da primeira entrega

Entrega: 11/10/2026. Base: o ZIP fornecido nesta conversa.

A página inicial foi transformada em uma vitrine: busca, formas de compra e jogos aparecem antes dos blocos institucionais. A identidade escura com roxo/lilás foi mantida, com mais espaço para as artes do catálogo.

## O que mudou

- **Primeira tela:** abertura curta, busca visível e atalhos para itens de jogos, Robux, Contas com Robux, Combos e Servidores.
- **Jogos:** até seis jogos na home, seguindo a ordenação do Admin. Os cinco jogos atualmente cadastrados cabem na seleção. O link “Todos os jogos” dá acesso ao catálogo completo. Nomes, imagens, slugs e contagens vêm do Supabase.
- **Desktop:** capas maiores em uma faixa de cards, com nome e quantidade de produtos abaixo. Hover discreto, contraste e foco visível.
- **Celular:** jogos em uma faixa horizontal com rolagem por toque e navegação por teclado; busca e opções comerciais aparecem cedo. O menu comporta telas baixas e inclui Contas com Robux e busca.
- **Robux e contas:** blocos com acessos diretos aos fluxos já implementados. Sem preços ou disponibilidade inventados.
- **Destaque:** o produto escolhido no Admin continua sendo exibido, agora em um bloco compacto após os jogos. O fallback de seleção existente foi mantido.
- **Produtos:** grid mais compacto na home, com imagens, preços, favoritos, estoque e botão de adicionar. O card compartilhado de produto foi reutilizado; os ajustes de densidade estão restritos à home.
- **Categorias:** atalhos com o nome do jogo para diferenciar categorias com nomes iguais.
- **Busca:** além do nome do produto, reconhece o jogo e a categoria. Aceita prefixos, acentos e termos combinados, como “dr”, “frutas permanentes” e “dragon blox”. Consultas por Robux, contas, combos e servidores mostram links para os serviços existentes.
- **Confiança:** pagamento, acompanhamento, suporte e avaliações ficam após a vitrine. As informações de privacidade do login Google foram preservadas.
- **Estados de erro:** falhas ao consultar jogos/produtos recebem mensagens próprias; catálogo vazio, ausência de avaliações/combos e jogo sem imagem têm tratamento.

## Decisões do redesign

O antigo hero foi substituído por uma abertura curta. As artes dos jogos passam a ser o principal elemento visual, e o roxo destaca busca, ações e a compra de Robux.

A faixa mobile usa rolagem CSS, sem biblioteca de carrossel. A home e a nova busca de entrada são renderizadas no servidor. O formulário envia para `/produtos?q=...` e funciona sem JavaScript; filtros, favoritos e carrinho continuam usando os componentes existentes.

A home não faz chamadas adicionais ao fornecedor de Robux ou ao catálogo de contas. Os links levam às páginas responsáveis por consultar preços e disponibilidade. Não foram incluídas estatísticas de “mais vendidos” ou promessas de prazo sem dados.

O CSS novo fica em um módulo próprio. Não foi necessário alterar o CSS global, reconstruir a loja ou adicionar dependências ao projeto.

## Arquivos alterados

A comparação abaixo usa os arquivos do ZIP recebido como referência.

| Arquivo | Mudança |
| --- | --- |
| `app/page.tsx` | Nova composição da home, contagens por jogo e estados de falha/vazio. |
| `app/produtos/page.tsx` | Busca por produto, categoria e jogo; links de descoberta para jogos/categorias/serviços. |
| `app/produtos/CatalogToolbar.tsx` | Rótulos da busca global; busca por nome mantida nas páginas de categoria. |
| `app/components/SiteHeader.tsx` | Atalho de busca aponta para o campo da home. |
| `app/components/HeaderMobileMenu.tsx` | Links de contas e busca; altura e rolagem adequadas a telas pequenas. |
| `app/components/SiteFooter.tsx` | Links diretos para Contas com Robux e Combos. |

## Arquivos criados

| Arquivo | Função |
| --- | --- |
| `app/components/home/HomeGameCard.tsx` | Card de jogo com arte, contagem e fallback sem imagem. |
| `app/components/home/HomeOffers.tsx` | Blocos de Robux, contas e produto em destaque. |
| `app/components/home/StoreSearch.tsx` | Formulário acessível de busca da home. |
| `app/components/home/Storefront.module.css` | Estilos isolados da nova vitrine e seus breakpoints. |
| `lib/storefront-search.ts` | Correspondência de busca e rotas dos serviços existentes. |
| `tests/storefront-search.test.ts` | Testes da busca por prefixo/contexto e serviços. |
| `docs/REFORMULACAO-HOME-20261011.md` | Este relatório e instruções de aplicação. |

## Verificações

- `npm run check`: lint, TypeScript e **107 testes aprovados**, sem falhas.
- `npm run build`: **build de produção aprovado**, com as rotas existentes compiladas.
- Revisão em navegador Chromium nas larguras **320, 390, 768, 1024 e 1440 px**: jogos na primeira tela, imagens, navegação e ausência de overflow horizontal da página.
- Links de jogo/categoria/produto, busca por prefixo/jogo/categoria/serviço e busca sem resultado.
- Carrinho: adicionar produtos, alterar quantidade, persistir após recarregar, remover e limpar.
- Formulário de login, botões Google/Discord, modo de cadastro e redirecionamentos de páginas protegidas.
- Robux, Contas com Robux, Combos, Servidores, avaliações, ajuda e páginas legais: abertura das interfaces.

### Limites da validação

O ZIP não contém credenciais reais de execução. O build e os testes de interface usaram configuração local e respostas simuladas do backend; as artes e uma amostra do catálogo público foram usadas para verificar o layout. Dados simulados, credenciais de teste e ferramentas temporárias não fazem parte da entrega.

Não foi possível concluir autenticação real com Google/Discord/e-mail, um pagamento Pix, entrega pelo fornecedor, envio de e-mail/notificação ou ações de Admin autenticado. Essas integrações exigem o ambiente configurado. Os respectivos códigos e migrations foram preservados, e os testes automatizados existentes passaram.

A consulta do orçamento do checkout sem sessão retorna o 401 esperado e não libera a confirmação do pedido. Isso não representa uma compra concluída. O catálogo de contas foi verificado como interface, sem consultar/comprar contas reais.

## Banco, dependências e ambiente

- **Migration nova: nenhuma.** Não é necessário executar SQL por causa deste redesign.
- **Variável de ambiente nova: nenhuma.** Use as mesmas configurações do projeto atual.
- `package.json` e `package-lock.json` permanecem iguais aos do ZIP recebido.
- A configuração de metadata, sitemap e autenticação permanece igual. A variável já existente `NEXT_PUBLIC_SITE_URL` deve continuar com `https://www.cosmicstore.com.br` no ambiente de produção.
- Jogos/produtos/categorias/preços não foram substituídos por dados fixos. Novos cadastros continuam aparecendo conforme a ordenação e os limites de exibição.

## Como aplicar no seu projeto

1. Guarde o checkpoint original antes de copiar os arquivos.
2. Extraia o ZIP atualizado e copie o **conteúdo da pasta `cosmic-store`** para a pasta do projeto no VS Code.
3. Preserve a sua pasta `.git` e o seu `.env.local`. O ZIP atualizado contém o código-fonte completo, sem `.git`, `node_modules`, `.next`, credenciais locais ou caches de compilação.
4. No terminal da pasta do projeto, execute:

```bash
npm ci
npm run check
npm run build
```

Para conferir localmente:

```bash
npm run dev
```

Para enviar ao GitHub:

```bash
git add .
git commit -m "Reformula pagina inicial da Cosmic Store"
git push origin main
```

O deploy da sua Vercel seguirá a integração que já estiver configurada com o GitHub. Esta entrega fornece os arquivos; não houve publicação no domínio de produção.

## Checkpoint original

`cosmic-store-original-checkpoint-20261011.zip` é uma cópia exata do ZIP recebido, preservando o estado anterior à reformulação.

SHA-256 do checkpoint:

```text
adcb0c5d2bf9bbf216b9b1d56c7eb67a1094ac0705239a3bbaaf23e3079c2aa8
```
