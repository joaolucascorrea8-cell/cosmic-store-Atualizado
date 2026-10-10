# Cosmic Store — mínimo de K para contas

Atualização de 10/10/2026, sobre a versão mais recente desta conversa, incluindo a entrega por usuário/senha e o texto “Disponível para compra”.

## Regra aplicada

```text
K Cosmic = maior entre (K Cosmic mínimo) e (K fornecedor + acréscimo)
Preço da conta = arredondar((Robux / 1.000) × K Cosmic, 2 casas)
```

Configuração inicial desta atualização: **mínimo R$34,00; acréscimo R$5,00 por 1K**.

| K fornecedor | K Cosmic | Conta com 1.990 Robux |
| ---: | ---: | ---: |
| R$25,00 | R$34,00 | R$67,66 |
| R$27,00 | R$34,00 | R$67,66 |
| R$29,00 | R$34,00 | R$67,66 |
| R$29,01 | R$34,01 | R$67,68 |
| R$29,50 | R$34,50 | R$68,66 |
| R$30,00 | R$35,00 | R$69,65 |
| R$32,00 | R$37,00 | R$73,63 |

Esses valores são exemplos de cálculo, não cotações atuais do fornecedor. O K fornecedor continua vindo das páginas públicas. Não há arredondamento para ,90 ou ,99.

O limite de R$29 resulta de **mínimo − acréscimo**. Ambos são configuráveis em **Admin → Robux → Contas → Preço das contas**. Ao mudar um deles, esse limite também muda. Enquanto o mínimo é aplicado, a diferença entre os Ks pode ser maior que o acréscimo configurado; isso não é uma taxa nem uma margem líquida garantida.

## Instalação e deploy

1. Faça backup do projeto e do banco. Foi preservado um checkpoint do código antes desta alteração: `cosmic-store-antes-k-minimo.zip`.
2. Extraia o patch na raiz do seu projeto e substitua os arquivos correspondentes. Como alternativa, copie o conteúdo da pasta `cosmic-store` do ZIP completo. Preserve `.git`, `.env.local` e suas configurações de produção.
3. Se já instalou catálogo, política e entrega de contas, aplique **somente** `supabase/migrations/202610100001_robux_account_minimum_k.sql` no SQL Editor do Supabase. Não reaplique migrations antigas.
4. Se a revisão de usuário/senha ainda não foi instalada, aplique primeiro `202610090002_robux_account_delivery_policy.sql`, seguindo `ATUALIZACAO-ENTREGA-E-POLITICA.md`. A instalação inicial de contas também precisa de `202610090001_robux_accounts.sql`. Execute cada migration apenas uma vez, na ordem indicada.
5. Execute `supabase/verificacoes/202610100001_check.sql`. Deve mostrar mínimo **34**, acréscimo **5**, limite **29**, fórmula instalada, snapshot protegido e RLS ativo. Clientes não devem executar as funções; somente o servidor executa a função com aceite de política. A função interna continua bloqueada para chamada direta.
6. Em **Admin → Robux → Contas**, confira os dois campos. A migration já ativa os valores 34/5 e preserva a opção anterior de habilitar/pausar compras. O botão **Salvar configuração** permite alterações futuras.
7. Valide localmente com `npm ci`, `npm run check` e `npm run build`.
8. Envie os arquivos:

```bash
git status
git add .
git commit -m "Configura K minimo das contas com Robux"
git push origin main
```

9. Aplique a migration antes do deploy. Se a Vercel estiver ligada a `main`, o push inicia o deploy. Acompanhe o build e confira a loja no domínio já configurado.

Não há variável de ambiente nova nesta alteração de preços. Para a entrega de usuário/senha, mantenha **a mesma `ROBUX_ACCOUNT_DELIVERY_KEY`** já configurada na revisão anterior. Se ainda não configurou, siga o guia daquela revisão. Não regenere uma chave que já protege entregas existentes e não envie segredos ao Git.

Nenhuma migration, compra, pagamento, envio de e-mail ou deploy foi executado em produção nesta tarefa.

## Entrega de contas

O fluxo da versão entregue mantém:

1. Confirmar o pagamento do pedido.
2. Comprar a conta manualmente e registrar a aquisição no Admin.
3. Preencher **Usuário da conta Roblox**, **Senha da conta** e, se necessário, **Instruções para o cliente**.
4. Clicar em **Salvar dados da conta**.
5. Concluir a entrega para liberar os dados ao cliente na área privada do pedido.

**Contas com Robux não exigem imagem de entrega.** Os campos de usuário e senha são obrigatórios. A senha permanece cifrada no banco; o e-mail de entrega leva ao pedido, sem expor credenciais. Os outros produtos continuam com sua exigência de imagem. O Quick Buy/Game Pass mantém sua implementação e configuração próprias.

## Histórico e compatibilidade

- Só novas compras usam a configuração nova. Valores, Pix, itens e snapshots dos pedidos já criados são preservados, inclusive ao repetir uma requisição com o mesmo token.
- O banco recalcula com o mínimo e o acréscimo atuais e bloqueia a criação se o valor apresentado divergir. A verificação pública da oferta antes da compra continua obrigatória.
- Novos snapshots privados guardam `min_cosmic_k` junto com os dados já existentes. Pedidos anteriores têm esse campo nulo, indicando a regra antiga, sem inventar um mínimo retroativo.
- O cliente vê apenas K Cosmic, saldo, preço final e disponibilidade. Mínimo, acréscimo, custo e origem continuam restritos ao Admin.
- A lista aprovada, os filtros, as 12 opções por página e o texto “Disponível para compra” permanecem. Ofertas equivalentes podem se agrupar visualmente; a conta selecionada mantém sua identidade e a URL correta para aquisição.
- Nenhuma migration antiga foi editada. A nova migration acrescenta duas colunas privadas e atualiza apenas o cálculo de criação de pedidos de contas.

## Verificação realizada e roteiro

`npm run check`: **99 testes passaram**, sem falhas de lint ou TypeScript. `npm run build`: passou com Next.js 16.3.8.

Os seis testes novos cobrem o limite 29, variação acima dele, arredondamento, configuração inicial, acordo entre cálculo TypeScript e SQL, mudança de mínimo/acréscimo, preço desatualizado recusado sem pedidos órfãos, retry, snapshot imutável, privacidade e agrupamento sem perder a origem. Um teste aplica a nova migration sobre um banco com pedido antigo e verifica a preservação do pedido, itens, política e funções do Quick Buy/entrega.

A suite também confirmou novamente: entrega de contas com credenciais e **sem imagem**, bloqueio sem usuário/senha, e exigência de imagem para produtos comuns.

Após o deploy, confira:

- K fornecedor até 29 → K Cosmic 34; acima de 29 → K fornecedor + 5, usando as cotações realmente disponíveis no Admin.
- Mudar mínimo/acréscimo no Admin atualiza o catálogo sem exigir nova coleta do fornecedor. Recarregue a página para ver imediatamente; páginas abertas também têm atualização periódica.
- Uma tentativa com preço antigo pede nova conferência. Um pedido já criado continua com o preço contratado.
- O Admin mostra o mínimo histórico dos pedidos novos e a regra anterior nos pedidos antigos.
- O cliente recebe somente os dados de entrega de seu próprio pedido, após a entrega concluída.
- Game Pass e pedidos de outros jogos seguem seus fluxos existentes.

Os testes de banco usaram PGlite isolado; não representam teste de carga em produção. O fluxo real de Pix/e-mail deve ser validado em ambiente controlado. As limitações do catálogo público continuam documentadas em `CONTAS-COM-ROBUX.md`.



Na revisão de preços, a aplicação compilada também foi testada por HTTP com Supabase simulado: catálogo público com valores 34/34,50/35, ausência de dados internos, formulário real do Admin salvando os dois campos por Server Action e recálculo sem nova consulta ao fornecedor. A inspeção visual em navegador não foi repetida nesta revisão porque o executável não estava disponível e o download não pôde ser concluído. A estrutura pública aprovada não foi alterada; confira o novo formulário no celular após o deploy.

A lista de arquivos desta alteração está em `ARQUIVOS-K-CONTAS.md`.
