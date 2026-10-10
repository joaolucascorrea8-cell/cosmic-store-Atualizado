# Cosmic Store — Contas com Robux

Atualização de 10/10/2026, feita sobre o ZIP recebido. Não reconstrói a loja nem substitui o Quick Buy.

> Correção atual do Admin: leia `CORRECAO-ERROS-PEDIDOS.md`. Faltas de print/credenciais passam a gerar avisos no pedido; o guia explica a chave de entrega na Vercel. Esta correção não acrescenta migrations.

> Revisão atual de preços: leia primeiro `ATUALIZACAO-K-CONTAS.md`. Quem já instalou catálogo, política e entrega aplica somente `202610100001_robux_account_minimum_k.sql`. Para a revisão anterior de usuário/senha e política, consulte `ATUALIZACAO-ENTREGA-E-POLITICA.md`.

## Antes de instalar

Guarde o ZIP original recebido como checkpoint. O arquivo de origem permaneceu intacto durante o trabalho. Faça também backup do banco pelo procedimento já existente em `BACKUP-E-RESTAURACAO.md` antes de aplicar uma migration.

A implementação reaproveita `orders`, `order_items`, Pix, comprovantes, chat privado, notificações, confirmação administrativa e e-mails de pagamento/entrega. A modalidade nova usa `order_type = 'robux_account'`. `robux_orders`, GamePass, saldo e execução do Quick Buy não foram reescritos.

O ZIP atual usa **Gmail** em `lib/notifications.ts` e `lib/gmail.ts` para envio. Isso foi preservado: não foi acrescentado um serviço de e-mail paralelo nem alterada a autenticação.

## Instalação exata

1. Extraia o ZIP atualizado. No seu repositório local, copie o conteúdo da pasta `cosmic-store` por cima dos arquivos correspondentes. Preserve a sua pasta `.git`, seu `.env.local` e as configurações de produção. O ZIP entregue não contém dependências, `.next`, histórico `.git` ou credenciais.
2. Confira se as migrations anteriores, incluindo `202610050001_robux_quick_buy.sql`, já estão aplicadas. **Não reaplique todas as migrations antigas em produção.**
3. No SQL Editor do Supabase, execute `supabase/migrations/202610090001_robux_accounts.sql` somente se ainda não aplicada e, em seguida, as migrations `202610090002_robux_account_delivery_policy.sql` e `202610100001_robux_account_minimum_k.sql`, se ainda não aplicadas. O arquivo usa uma transação e acrescenta as estruturas abaixo; não remove produtos/pedidos e não modifica migrations anteriores. Aplique uma única vez, ou use o mecanismo de migrations que você já utiliza.
4. Execute `supabase/verificacoes/202610090001_check.sql`. As tabelas devem existir com RLS. Após a segunda migration, execute também `202610090002_check.sql`: as RPCs novas são exclusivas do servidor; a criação antiga de conta fica sem chamada direta, inclusive por `service_role`. A tabela segura tem somente `order_id`, `robux`, `cosmic_k`, `sale_price`, `fulfillment_status`. Execute também `202610100001_check.sql`: a configuração atual deve mostrar mínimo 34 e acréscimo 5.
5. Mantenha as variáveis atuais de Supabase, Pix, Gmail, Discord e Quick Buy. **Configure `ROBUX_ACCOUNT_DELIVERY_KEY` para a entrega protegida de usuário/senha, seguindo `ATUALIZACAO-ENTREGA-E-POLITICA.md`.** A coleta de contas não utiliza `BYROBUX_API_KEY`, cookies, login ou sua sessão.
6. Mantenha `NEXT_PUBLIC_SITE_URL=https://www.cosmicstore.com.br` no seu ambiente, de acordo com o domínio oficial. O domínio, callbacks de autenticação e configurações do projeto não foram alterados.
7. No terminal do projeto:

```bash
npm ci
npm run check
npm run build
npm run dev
```

8. Acesse `/admin/robux/contas`, usando uma conta com role `owner` ou `admin`. Clique em **Consultar catálogo** para fazer a primeira leitura. Confira mínimo de K em 34 e acréscimo em 5, ou ajuste conforme desejado. O botão respeita o intervalo e o bloqueio de sincronização; não força consultas repetidas.
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

A sincronização é **sob demanda**, agendada com `after()` após a resposta do catálogo em cache, com intervalo de 90 segundos entre coletas, cache compartilhado no banco e atualização da página aberta a cada 90 segundos. Não exige cadastro diário. Sem visitantes ou chamadas ao endpoint, o cache só volta a atualizar no próximo acesso. O tempo total depende da quantidade de páginas e da resposta externa; 90 segundos é o intervalo configurado, não uma promessa de concluir a coleta nesse tempo.

Para manter consultas mesmo sem visitantes, há o endpoint opcional:

```text
GET https://www.cosmicstore.com.br/api/maintenance/robux-accounts
Authorization: Bearer <seu CRON_SECRET existente>
```

Um agendador compatível com sua hospedagem pode chamá-lo aproximadamente a cada dois minutos. Use a variável secreta existente; nunca publique o token. O `vercel.json` e o cron de manutenção já existente foram preservados. Nenhum agendador externo foi criado nesta entrega.

## Preços

Para contas, a fórmula é exclusivamente:

```text
K Cosmic = maior entre (mínimo configurado) e (K público da cotação + acréscimo configurado)
Preço = arredondar((Robux / 1.000) × K Cosmic, 2 casas)
```

Configuração inicial atual: mínimo 34 e acréscimo 5. Exemplo: 1.990 Robux, K fornecedor 26,93 → K Cosmic 34 → R$67,66. K fornecedor 29,50 → K Cosmic 34,50 → R$68,66. Até fornecedor 29, o K fica em 34; acima, soma 5. Ambos os valores são configuráveis no Admin. O fornecedor continua dinâmico e não há ajuste para ,90/,99.

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

O snapshot não pode ser editado: só podem mudar disponibilidade, última consulta e aquisição manual. Alterar catálogo/configuração não altera pedidos históricos. Dados de login são inseridos manualmente em campos próprios, cifrados e liberados apenas ao dono do pedido entregue; não são parte do catálogo. As tabelas adicionais de política e entrega estão documentadas no guia da revisão.

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

A relação completa está em `ARQUIVOS-CONTAS-ROBUX.md`; a revisão de entrega está em `ARQUIVOS-AJUSTE-CONTAS.md`, a revisão de preços em `ARQUIVOS-K-CONTAS.md` e a correção de avisos em `ARQUIVOS-CORRECAO-PEDIDOS.md`. Nenhuma migration anterior ou arquivo de lógica Quick Buy foi alterado.
