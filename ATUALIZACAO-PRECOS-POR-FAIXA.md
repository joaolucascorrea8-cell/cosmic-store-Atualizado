# Cosmic Store — contas com preços por quantidade

Revisão de 10/10/2026. As novas compras de contas usam a mesma tabela de quantidades de **Produtos → Preços**, com o K base dinâmico já configurado. Este guia substitui a fórmula proporcional abaixo de 1.000 Robux dos guias anteriores.

## Como ficou

| Quantidade | Conta com K base R$34 |
| ---: | ---: |
| 350 Robux | R$15,00 |
| 400 Robux | R$16,00 |
| 450 Robux | R$17,00 |
| 500 Robux | R$18,55 |
| 750 Robux | R$26,27 |
| 1.000 Robux | R$34,00 |
| 1.990 Robux | R$67,66 |

O K base continua sendo o maior entre o mínimo configurado e o K público da cotação mais o acréscimo. Com mínimo 34 e acréscimo 5: fornecedor até 29 mantém K base 34; acima de 29, acompanha a subida somando 5. Esta migration preserva os valores que você já configurou.

Abaixo de 1.000 Robux, a curva histórica usa, na referência K34: até 350, `quantidade × 15 / 350`; de 351 a 450, `15 + (quantidade − 350) × 0,02`; de 451 a 999, `17 × (quantidade + 100) / 550`. O resultado é multiplicado por `K base / 34`, arredondando somente o valor final. A partir de 1.000, continua `quantidade / 1.000 × K base`. Não há arredondamento artificial para ,90 ou ,99.

Produtos e contas compartilham a mesma função. Os preços coincidem quando usam a mesma quantidade e o mesmo K base; preços de produtos editados manualmente não são regravados. O Quick Buy/GamePass continua com sua configuração, cálculo e modalidade de taxa próprios. Esta alteração não promete igualar ofertas com Ks diferentes nem saldo em conta e Robux líquidos de GamePass.

O catálogo, o resumo e os pedidos passam a exibir **K base Cosmic**. O catálogo abre do **menor preço total para o maior**, com essa opção selecionada. A ordenação alternativa **Melhor valor por 1K** considera o preço final por Robux. Somente o Admin vê custo, origem e configuração. Pedidos anteriores mantêm valores, itens, Pix e snapshots originais; a regra usada fica identificada no snapshot privado.

## O que baixar

- `cosmic-store-contas-precos-por-faixa.zip`: patch para copiar na raiz do projeto. É cumulativo desde a correção enviada no commit `936b73c`, incluindo a atualização automática do Admin mesmo se você ainda não a copiou.
- `cosmic-store-contas-robux-20261009.zip`: projeto completo atualizado. O nome original do arquivo foi mantido; seu conteúdo inclui esta revisão. Use como alternativa ao patch.
- `cosmic-store-antes-precos-por-faixa.zip`: checkpoint do código imediatamente anterior a esta mudança.

O patch pressupõe a versão desta conversa com catálogo, política, entrega por usuário/senha, mínimo de K e correção dos avisos. Se seu projeto teve outras alterações locais depois disso, compare os arquivos antes de substituí-los. Não apague seu projeto nem a pasta `.git`.

## Instalação no VS Code, Supabase e Vercel

1. Guarde uma cópia do projeto atual e faça o backup de banco conforme seu procedimento existente. Extraia o patch; copie **seu conteúdo** sobre a raiz onde está `package.json`, substituindo somente os arquivos correspondentes. No ZIP completo, copie o conteúdo de `cosmic-store`. Preserve `.git`, `.env.local` e suas configurações.
2. Se as migrations de contas `202610090001`, `202610090002` e `202610100001` já foram aplicadas, **não as execute de novo**. Se alguma falta, aplique-a uma única vez na ordem, conforme `CONTAS-COM-ROBUX.md`.
3. Abra **Supabase → SQL Editor → New query**. Copie todo o conteúdo de `supabase/migrations/202610100002_robux_account_price_table.sql` e clique em **Run**, uma única vez. Aplique este SQL antes do deploy do código novo. Ele acrescenta a regra privada ao snapshot e altera somente a precificação de novos pedidos de contas.
4. Em outra query, execute `supabase/verificacoes/202610100002_check.sql`. Todos os `confere` devem ser `true`; `tabela_instalada`, `snapshot_protegido`, `regra_no_snapshot` e `rls_enabled` também. Nas permissões, clientes não executam as funções, e `service_role` só executa `create_robux_account_order_with_policy`. A contagem de pedidos pode estar vazia se ainda não houver compras. A segunda consulta usa sua configuração atual, sem alterá-la.
5. No VS Code, abra **Terminal → Novo terminal**, na pasta que contém `package.json`, e execute:

```bash
npm ci
npm run check
npm run build
```

6. Se passar, envie ao seu repositório:

```bash
git add .
git commit -m "Unifica preços por faixa das contas com Robux"
git push origin main
```

7. Se a Vercel já estiver conectada a `main`, o push inicia o deploy. Confira o status **Ready** e abra `https://www.cosmicstore.com.br/robux/contas`. Não há variável de ambiente nova. Mantenha a chave de entrega já usada, sem regenerá-la, e as configurações atuais de Pix, autenticação, Gmail, Discord e Quick Buy.

O código e o SQL precisam desta mesma revisão. Durante a troca de versões, uma tela antiga com preço divergente deve ser atualizada antes de criar a compra; o banco recusa a divergência. Nenhuma migration, compra, pagamento, mensagem, push ou deploy foi executado no seu ambiente nesta entrega.

## Atualização automática incluída

A vitrine e o Admin de contas fazem verificações automáticas a cada 90 segundos quando visíveis. Abrir o Admin inicia a consulta sem botão; o botão é opcional. O cache e o controle compartilhado de concorrência continuam evitando coleta duplicada. A tela administrativa adia atualizações enquanto há campos em edição. Sem vitrine/Admin aberto ou agendador chamando o endpoint existente, a coleta retoma no próximo acesso. O tempo de conclusão depende do fornecedor e da quantidade de páginas.

## Testes e conferência após o deploy

Validação executada: lint, TypeScript, **105 testes** e build completo do Next.js. Inclui 7.007 comparações entre preços TypeScript/SQL, migração com pedido antigo preservado, RLS e teste HTTP da API compilada. Os testes de avisos no Admin, entrega por usuário/senha sem imagem, produtos com imagem e Quick Buy continuam passando.

Confira no seu ambiente:

1. Com K base 34, as quantidades disponíveis seguem a tabela acima. Não é preciso existir uma oferta de cada exemplo no estoque para o cálculo funcionar.
2. Se houver cotação cujo K fornecedor ultrapasse 29, o K base acompanha a alta; o preço por faixa acompanha esse K. Alterações de mínimo/acréscimo no Admin afetam somente novas compras.
3. Ao escolher uma conta, o resumo e o pedido novo exibem o mesmo preço. Oferta removida é recusada; preço alterado exige nova conferência antes de criar o pedido.
4. Um pedido feito antes da revisão mantém total, Pix e item originais; o Admin identifica a regra histórica.
5. **Melhor valor por 1K** considera o preço final por Robux; filtros e paginação funcionam. Confira rótulos e explicações em celular e desktop.
6. O Admin atualiza sem clique e não perde edições não salvas. A entrega de contas continua por usuário e senha, após pagamento e aquisição manual.
7. Produtos, Quick Buy/GamePass e pedidos dos demais jogos seguem seus fluxos anteriores.

Banco e autenticação foram simulados localmente; nenhuma credencial sua foi utilizada. A inspeção visual/mobile não foi repetida nesta revisão porque o navegador não está disponível no ambiente. O fluxo real de Pix/e-mail deve ser conferido com pedido controlado. Limitações do catálogo público e do fornecedor seguem em `CONTAS-COM-ROBUX.md`.

A lista completa dos arquivos deste patch está em `ARQUIVOS-PRECOS-POR-FAIXA.md`; a comparação de todo o projeto com o ZIP original está em `ARQUIVOS-CONTAS-ROBUX.md`.
