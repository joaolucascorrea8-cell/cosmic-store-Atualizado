# Cosmic Store — Contas com Robux

Atualização de 10/10/2026, feita sobre o ZIP recebido. Não reconstrói a loja nem substitui o Quick Buy.

> Revisão mais recente: leia `ATUALIZACAO-PRECOS-POR-FAIXA.md`. As novas contas abaixo de 1.000 Robux usam a mesma curva de preços de Produtos → Preços. Requer a migration nova `202610100002_robux_account_price_table.sql`; pedidos antigos mantêm seus valores. O patch também inclui a atualização automática do Admin.

> Atualização automática: leia `ATUALIZACAO-AUTOMATICA-CONTAS.md`. A vitrine e o Admin de contas consultam automaticamente durante o uso; o botão é opcional. Sem migration ou variável nova nesta revisão.

> Correção atual do Admin: leia `CORRECAO-ERROS-PEDIDOS.md`. Faltas de print/credenciais passam a gerar avisos no pedido; o guia explica a chave de entrega na Vercel. Esta correção não acrescenta migrations.

> Histórico: `ATUALIZACAO-K-CONTAS.md` documenta a introdução do mínimo de K. A regra proporcional abaixo de 1.000 Robux daquele guia foi substituída pela revisão mais recente. Para usuário/senha e política, consulte `ATUALIZACAO-ENTREGA-E-POLITICA.md`.

## Antes de instalar

Guarde o ZIP original recebido como checkpoint. O arquivo de origem permaneceu intacto durante o trabalho. Faça também backup do banco pelo procedimento já existente em `BACKUP-E-RESTAURACAO.md` antes de aplicar uma migration.

A implementação reaproveita `orders`, `order_items`, Pix, comprovantes, chat privado, notificações, confirmação administrativa e e-mails de pagamento/entrega. A modalidade nova usa `order_type = 'robux_account'`. `robux_orders`, GamePass, saldo e execução do Quick Buy não foram reescritos.

O ZIP atual usa **Gmail** em `lib/notifications.ts` e `lib/gmail.ts` para envio. Isso foi preservado: não foi acrescentado um serviço de e-mail paralelo nem alterada a autenticação.

## Instalação exata

1. Extraia o ZIP atualizado. No seu repositório local, copie o conteúdo da pasta `cosmic-store` por cima dos arquivos correspondentes. Preserve a sua pasta `.git`, seu `.env.local` e as configurações de produção. O ZIP entregue não contém dependências, `.next`, histórico `.git` ou credenciais.
2. Confira se as migrations anteriores, incluindo `202610050001_robux_quick_buy.sql`, já estão aplicadas. **Não reaplique todas as migrations antigas em produção.**
3. No SQL Editor do Supabase, aplique, em ordem e somente se ainda não aplicadas: `202610090001_robux_accounts.sql`, `202610090002_robux_account_delivery_policy.sql`, `202610100001_robux_account_minimum_k.sql` e `202610100002_robux_account_price_table.sql`, em `supabase/migrations`. Quem já instalou as três primeiras aplica somente a quarta. Todas usam transação; não removem produtos/pedidos e não modificam migrations anteriores. Execute cada uma uma única vez, ou use o mecanismo de migrations que você já utiliza. Aplique a nova migration antes de publicar o código correspondente.
4. Execute os SQLs correspondentes em `supabase/verificacoes`. As tabelas devem existir com RLS; a criação interna fica sem chamada direta, inclusive por `service_role`, e somente o wrapper com aceite da política é executável pelo servidor. A tabela segura tem somente `order_id`, `robux`, `cosmic_k`, `sale_price`, `fulfillment_status`. A configuração inicial é mínimo 34/acréscimo 5; ajustes posteriores seus são preservados pela quarta migration. Em `202610100002_check.sql`, todos os exemplos de preço devem ter `confere = true`, e `tabela_instalada`, `snapshot_protegido`, `regra_no_snapshot` e `rls_enabled` também devem ser verdadeiros.
5. Mantenha as variáveis atuais de Supabase, Pix, Gmail, Discord e Quick Buy. **Configure `ROBUX_ACCOUNT_DELIVERY_KEY` para a entrega protegida de usuário/senha, seguindo `ATUALIZACAO-ENTREGA-E-POLITICA.md`.** A coleta de contas não utiliza `BYROBUX_API_KEY`, cookies, login ou sua sessão.
6. Mantenha `NEXT_PUBLIC_SITE_URL=https://www.cosmicstore.com.br` no seu ambiente, de acordo com o domínio oficial. O domínio, callbacks de autenticação e configurações do projeto não foram alterados.
7. No terminal do projeto:

```bash
npm ci
npm run check
npm run build
npm run dev
```

8. Acesse `/admin/robux/contas`, usando uma conta com role `owner` ou `admin`. O acesso já inicia a consulta automaticamente; **Consultar agora (opcional)** permite uma consulta manual respeitando o intervalo/cache. Confira mínimo de K em 34 e acréscimo em 5, ou ajuste conforme desejado.
9. Confira `/robux/contas` e faça um pedido controlado antes de abrir a modalidade ao público. A opção **Aceitar novas compras de contas** permite pausar somente esta modalidade.

Não foi executada nenhuma migration no seu banco de produção, nenhum pagamento real, aquisição no fornecedor ou deploy.

## Git e deploy

Na raiz do seu repositório, depois de copiar os arquivos e validar:

```bash
git add .
git commit -m "Adiciona contas com Robux"
git push origin main
```

A Vercel deve continuar ligada ao mesmo repositório e branch. Confira as variáveis já configuradas, acompanhe o build e mantenha o domínio oficial existente. A migration precisa estar aplicada antes de testar as novas rotas.

As rotas de coleta/validação e ações administrativas relevantes declaram `maxDuration = 300`. Verifique se os limites efetivos do seu projeto de hospedagem comportam essa duração. Cada requisição ao fornecedor tem timeout de 15 segundos; uma coleta completa tem limites de 240 segundos, 500 páginas/requisições e 200 cotações. Limites excedidos geram diagnóstico e preservação do último estado conhecido.

A sincronização é **automática durante o uso**, agendada com `after()` após a resposta do catálogo em cache ou da página administrativa de contas. O cache é compartilhado no banco e respeita o intervalo mínimo de 90 segundos entre coletas. A vitrine e o Admin verificam novidades a cada 90 segundos quando visíveis; o Admin adia a atualização da tela durante edições não salvas. Não exige cadastro diário nem cliques no botão. Sem visitantes, Admin aberto ou chamadas ao endpoint, o cache só volta a atualizar no próximo acesso. O tempo total depende da quantidade de páginas e da resposta externa; 90 segundos é o intervalo de verificação da tela, não uma promessa de concluir a coleta nesse tempo.

Para manter consultas mesmo sem visitantes, há o endpoint opcional:

```text
GET https://www.cosmicstore.com.br/api/maintenance/robux-accounts
Authorization: Bearer <seu CRON_SECRET existente>
```

Um agendador compatível com sua hospedagem pode chamá-lo aproximadamente a cada dois minutos. Use a variável secreta existente; nunca publique o token. O `vercel.json` e o cron de manutenção já existente foram preservados. Nenhum agendador externo foi criado nesta entrega.

## Preços

O K base das contas continua dinâmico:

```text
K base Cosmic = maior entre (mínimo configurado) e (K público da cotação + acréscimo configurado)
Menos de 1.000 Robux: tabela por quantidade dos produtos, ajustada por K base / 34
A partir de 1.000 Robux: (Robux / 1.000) × K base Cosmic
Arredondamento: somente o preço final, para duas casas
```

Configuração inicial atual: mínimo 34 e acréscimo 5. Exemplo: 1.990 Robux, K fornecedor 26,93 → K Cosmic 34 → R$67,66. K fornecedor 29,50 → K Cosmic 34,50 → R$68,66. Até fornecedor 29, o K fica em 34; acima, soma 5. Ambos os valores são configuráveis no Admin. O fornecedor continua dinâmico e não há ajuste para ,90/,99.

| Quantidade | Preço com K base R$34 |
| ---: | ---: |
| 350 Robux | R$15,00 |
| 400 Robux | R$16,00 |
| 450 Robux | R$17,00 |
| 500 Robux | R$18,55 |
| 750 Robux | R$26,27 |
| 1.000 Robux | R$34,00 |

O mesmo cálculo é compartilhado com Produtos → Preços, sem reescrever produtos já cadastrados ou valores manuais. Os preços coincidem quando a quantidade e o K base usados são iguais. Quick Buy/GamePass conserva seu cálculo próprio, incluindo o modo de taxa; comparar saldo de conta com Robux líquidos de GamePass exige considerar essa diferença. O rótulo público é **K base Cosmic**, pois abaixo de 1.000 o preço segue a tabela, e a ordenação **Melhor valor por 1K** compara o preço final por Robux.

O mínimo e o acréscimo só alteram novas ofertas/pedidos. Um pedido criado mantém o preço e a configuração do snapshot, mesmo que o Admin altere a configuração depois. O banco recalcula o valor durante a criação e rejeita divergência de preço, inclusive uma alteração de mínimo/acréscimo ocorrida entre a validação e a transação.

## Catálogo e falhas

- A página inicial pública é lida sem autenticação. Links de cotações são identificados pelo HTML; as próprias páginas podem revelar outras cotações. A coleta percorre essa descoberta e todas as páginas anunciadas.
- URL, parâmetro `catalog` e identificador público da oferta compõem a identidade. `alternate` e `fourth` com o mesmo K não se misturam. Ordenação/paginação não alteram a identidade da cotação.
- O parser cruza ID público, Robux e preço com a linha visível. Os tokens de compra existentes no HTML são descartados e nunca usados ou armazenados.
- HTML inválido, login, bloqueio, redirects, paginação inconsistente ou erro de rede não equivalem a estoque zero. A integração não contorna proteções e não consulta rotas de API/auth/inventário/pagamentos do fornecedor.
- Uma cotação consultada com sucesso substitui somente seu estoque anterior. Se falhar, seu último estado é preservado. Se a descoberta ficou incompleta, as cotações antigas não descobertas também são preservadas. Uma falha global mantém todo o cache anterior.
- Linhas inválidas são ignoradas com diagnóstico. Dados conflitantes ou identidade ambígua entre cotações bloqueiam a atualização correspondente/geral.
- Há limite de três consultas externas simultâneas, deduplicação de requisições em andamento, timeout, lease compartilhado com token e bloqueio entre instâncias. Uma instância não pode concluir uma gravação usando o token de outra sincronização.
- Cada oferta tem horário próprio. Acima de 10 minutos sem leitura válida, seu botão de compra fica desabilitado. Toda criação de pedido exige consulta externa nova, independentemente do cache.
- Um desaparecimento confirmado no checkout é registrado e suprime imediatamente o card antigo até uma leitura válida posterior; falha técnica não faz isso.

O Admin mostra última atualização com dados válidos, última coleta completa, próxima consulta permitida, erros, diagnósticos, contas/Robux encontrados, margem e pedidos recentes.

## Limitações reais detectadas no ByRobux

1. Há cotações com mesmo K e mesmo ID de página em **catálogos diferentes**. Por isso o parâmetro `catalog` é preservado no link e na chave.
2. `alternate` expõe IDs públicos individuais; `fourth` pode expor **IDs sintéticos repetidos** para diversas linhas de mesmo saldo/custo. Nesse caso não existe uma identidade pública única por conta física. Linhas indistinguíveis são agrupadas em uma oferta, e o Admin vê a contagem/diagnóstico. Não se promete identificar uma conta física específica além do que é público.
3. Alguns grupos de `fourth` não têm paginação; grupos maiores têm. Ambas as estruturas foram reconhecidas. O mesmo grupo pode atravessar várias páginas e suas unidades são agregadas.
4. Uma reserva local bloqueia um grupo/oferta inteiro durante um pedido ativo. Para grupos `fourth`, uma próxima unidade só pode gerar novo pedido depois da entrega manual do anterior e de nova validação pública. Para IDs individuais, uma conta já adquirida continua bloqueada.
5. O estoque pode mudar durante uma coleta, alterando número de páginas ou repetindo IDs individuais. O estado dessa cotação é preservado e a próxima consulta tenta novamente. Não há garantia externa de estoque durante o Pix.
6. Não foi identificado link individual público utilizável para cada conta. O botão do Admin abre a **cotação exata**, preservando o catálogo, e exibe máscara, Robux e custo para localizar a linha. A compra e a conferência continuam manuais.
7. Se o fornecedor mudar o HTML/stream público ou exigir login, a coleta pode deixar de reconhecer dados. A integração interrompe a atualização afetada, registra erro e não tenta contornar a restrição.

## Fluxo operacional

1. Cliente abre `/robux/contas`, filtra mínimo/máximo de Robux, ordena por preço ou quantidade e escolhe uma oferta. São 12 opções por página, agrupadas por saldo/K/preço iguais. Ao escolher, o cliente confere o resumo e confirma a leitura da política.
2. O servidor consulta novamente a cotação até localizar a oferta, conferindo identidade, saldo e K atuais. Se o preço mudar um centavo ou mais, o cliente vê o novo valor e precisa clicar novamente.
3. Uma RPC cria atomicamente `orders`, `order_items`, snapshot privado, detalhes seguros e registro imutável da política lida. O token evita pedido duplicado em retry. Advisory locks impedem pedidos simultâneos da mesma oferta/grupo.
4. A reserva para pagamento dura 20 minutos. Sem comprovante, um pedido com reserva vencida não pode enviar novo comprovante nem retomar o Pix; uma nova tentativa da oferta pode cancelar esse pedido vencido. Não cancela pedidos com comprovante. Se o cliente já pagou, deve falar com a equipe para revisão.
5. O cliente usa o checkout/Pix/comprovante existente. A retomada do Pix revalida a conta e recusa alterações de cotação/custo; não altera silenciosamente um pedido já criado.
6. O Admin confere o comprovante. Antes de confirmar pagamento ou iniciar preparação, a disponibilidade é validada novamente. Falha/ausência bloqueia essa etapa e marca a entrega em revisão; o comprovante/pedido/snapshot não são apagados.
7. Cliente vê **Aguardando aquisição da conta**. O Admin abre **Abrir oferta no fornecedor**, confere os dados e compra manualmente. A Cosmic não clica, não gasta saldo nem obtém credenciais por automação.
8. O Admin marca a confirmação **Já comprei manualmente...** e registra a aquisição. A etapa de aquisição gera evento administrativo. Depois preenche **Usuário**, **Senha** e **Instruções** nos campos próprios do Admin e salva os dados.
9. Só então marca como entregue. Para contas, os dados salvos substituem a exigência de imagem. Os e-mails existentes são reutilizados; o aviso de conta entregue leva ao pedido, sem senha. Produtos comuns continuam com a exigência de imagem. Após a aquisição manual, não se exige que a conta ainda esteja anunciada no fornecedor para concluir a entrega.

Nunca coloque credenciais em notas públicas, catálogo ou e-mail de anúncio. A entrega de credenciais é na seção privada do pedido; o chat continua disponível para atendimento.

## Banco e segurança

| Estrutura nova | Finalidade / acesso |
| --- | --- |
| `robux_account_settings` | Mínimo de K, acréscimo e pausa desta modalidade; leitura Admin, escrita servidor. |
| `robux_account_catalog` | Cotações, ofertas, horários, diagnósticos e lease; privado. |
| `robux_account_orders` | Snapshot imutável e estado operacional de aquisição/reserva; Admin. |
| `robux_account_order_details` | Somente Robux, K Cosmic, preço e etapa; cliente dono/Admin. |
| `robux_account_request_limits` | Controle de frequência por cliente/cotação; servidor. |
| `robux_account_offer_checks` | Desaparecimento confirmado para suprimir cards antigos; servidor. |

Os custos, margem, URLs, IDs operacionais e K fornecedor não estão na tabela do cliente. As APIs usam DTOs explícitos. RPCs de criação/aquisição/lease/rate limit são exclusivas de `service_role`. Actions administrativas verificam o sistema existente de roles. Não foram adicionados segredos client-side.

O snapshot não pode ser editado: só podem mudar disponibilidade, última consulta e aquisição manual. A coluna privada `pricing_rule` identifica pedidos anteriores como `proportional_v1` e os novos como `product_table_v1`, sem recalcular o histórico. Alterar catálogo/configuração não altera pedidos históricos. Dados de login são inseridos manualmente em campos próprios, cifrados e liberados apenas ao dono do pedido entregue; não são parte do catálogo. As tabelas adicionais de política e entrega estão documentadas no guia da revisão.

## Roteiro de testes antes de liberar

Use ambiente de teste e usuários controlados. Não precisa comprar contas reais para validar parser, preços, RLS e banco.

| Teste | Resultado esperado |
| --- | --- |
| Abrir `/robux` | Calculadora/GamePass e fluxo Quick Buy permanecem. Link para contas aparece. |
| Abrir `/robux/contas` | Lista sem fornecedor, máscara, margem/custo ou URL externa. |
| Celular 390 px / desktop 1440 px | Filtros usáveis, lista ajustada, sem rolagem horizontal. |
| Ordenar preço/Robux e filtrar faixa | Lista corresponde ao filtro; paginação de 12. |
| Duas cotações com mesmo K | Ofertas e links preservam `catalog` e não se misturam. |
| Inserção/remoção pública | Próxima leitura válida atualiza a cotação. |
| Fornecedor offline/HTML quebrado | Cache preservado, erro no Admin, sem dados apagados. |
| Cotação sem sucesso por mais de 10 min | Compra desabilitada para suas ofertas. |
| Mínimo 34 → 36 ou acréscimo 5 → 8 | Novos preços seguem o maior entre mínimo e K + acréscimo; snapshots antigos permanecem. |
| Contas abaixo de 1.000 com K base 34 | 350 → 15; 400 → 16; 450 → 17; 500 → 18,55; 750 → 26,27. |
| Melhor valor por 1K | Ordena por preço final dividido pelos Robux, considerando as faixas. |
| Pedido criado antes da tabela | Mantém total, Pix, itens e snapshot originais; repetir a requisição não recalcula. |
| Oferta desaparece ao clicar | Pedido não é criado; mensagem amigável, card antigo suprimido. |
| Preço muda ao clicar | Novo preço visível, novo clique necessário. |
| Duas sessões na mesma oferta | Apenas um pedido ativo; segunda recebe conflito. |
| Reserva de 20 min vencida | Não permite retomar pagamento/registrar comprovante atrasado sem revisão. |
| Cliente tenta ler snapshot/config/cache | RLS retorna nenhuma linha / acesso negado conforme a tabela. |
| Cliente lê seu pedido | Só dados seguros da conta e itens; snapshot não é consultado. |
| Confirmação com estoque indisponível | Bloqueio e revisão; pedido/comprovante não desaparecem. |
| Aquisição manual | Registra evento; dados são salvos nos campos protegidos e liberados ao concluir. |
| Entrega sem aquisição/dados | Recusada. Com ambos, usa o fluxo existente e e-mail com link para o pedido. |
| Botão fornecedor no Admin | Abre página/catálogo do snapshot, mesmo após mudança de estoque. |
| Loja em geral | Login, carrinho, cupons, produtos, suporte e Quick Buy seguem funcionando. |

Testes executados e limites estão em `VALIDACAO-CONTAS-ROBUX.md`. O fluxo real de Pix, envio de e-mail e acesso às suas contas precisam de teste controlado no seu ambiente: nenhuma sessão/credencial sua foi utilizada nesta entrega.

## Arquivos

A relação completa está em `ARQUIVOS-CONTAS-ROBUX.md` e o patch mais recente em `ARQUIVOS-PRECOS-POR-FAIXA.md`. Os manifestos anteriores documentam suas respectivas revisões. Nenhuma migration anterior foi editada. `lib/robux-pricing.ts` passou a reutilizar o cálculo da tabela em um módulo compartilhado; a lógica do Quick Buy e os resultados da tabela de produtos permanecem preservados.
