# Cosmic Store — atualização de operação e preços por Robux

Preparada sobre uma cópia do ZIP `cosmic-store-completa - Copia(20261004-183945).zip`. O arquivo original foi preservado. A loja continua em português e reais, com Pix manual. Servidores continuam sem vencimento automático. Google permanece oculto pela feature flag; Discord e e-mail foram preservados.

## Instalar na loja atual

1. Guarde o ZIP anterior e faça uma cópia dos dados do Supabase (guia `BACKUP-E-RESTAURACAO.md`).
2. Esta versão parte da atualização anterior `202610040002_customer_tools.sql`. No Supabase → SQL Editor, execute **somente a nova atualização** `supabase/migrations/202610040003_store_operations.sql` se as anteriores já estão aplicadas. Execute o arquivo inteiro, uma vez; ele é reaplicável e não muda os preços atuais.
3. Rode `supabase/verificacoes/202610040003_check.sql`. Todas as linhas devem mostrar `ok = true`. Ele confere os recursos desta atualização; não afirma que credenciais e provedores externos foram testados.
4. Use o conteúdo deste projeto na sua pasta de trabalho e mantenha seu próprio `.env.local`. O ZIP não contém suas credenciais. Não substitua valores de produção pelos valores fictícios dos testes.
5. Confira localmente:

```powershell
npm install
npm run check
npm run build
npm audit
```

6. Suba para seu repositório e aguarde o deploy da Vercel. Mantenha o domínio oficial `https://cosmic-store-blush.vercel.app` e `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=false`.
7. Faça um pedido de teste e confira login, Pix/comprovante, confirmação, entrega, notificações e e-mails no ambiente real. Os testes desta entrega usam banco local e integrações simuladas; não acessam seus clientes nem efetuam pagamentos reais.

Se reaplicar um SQL antigo depois deste, execute novamente o `202610040003` para preservar as definições atuais de relatórios e painel. Não use `npm audit fix --force` sem analisar o impacto.

## Reajustar preços: Produtos → Reajustar pelo Robux

**A instalação não altera nenhum preço.** Todas as categorias começam manuais. Os preços cadastrados são a referência comercial de cada produto, inclusive os que têm um valor por K maior por custarem menos de 1.000 Robux.

1. Abra “Categorias que acompanham a cotação”. Habilite apenas categorias ligadas a Robux, como Frutas Permanentes e Gamepasses. Deixe Frutas Físicas manuais. Isso só habilita a seleção.
2. Escolha as categorias de um ou vários jogos. Pode marcar todas as habilitadas de um jogo sem envolver os outros.
3. Informe a nova cotação do K, por exemplo **40**. No campo “Cotação atual dos produtos ainda sem referência”, use **34** para o catálogo atual, conforme combinado. Se uma categoria tiver sido precificada usando outra cotação, processe-a separadamente com a cotação correta.
4. Calcule a prévia. Confira nome, preço atual e novo de cada produto. Os ocultos também entram; itens protegidos ficam excluídos.
5. Aplique o lote conferido. Se qualquer produto elegível mudar desde a prévia — inclusive estoque ou categoria — o lote inteiro é recusado e deve ser recalculado. Prévias expiram após 30 minutos; o limite é 5.000 produtos por lote.

A primeira aplicação salva uma referência de preço por produto. As seguintes calculam sempre a partir dela, sem multiplicar repetidamente os valores arredondados. Voltar à cotação anterior recupera a proporção original. O histórico conserva os lotes; a tela mostra os últimos 30.

Exemplos preservando os preços comerciais já existentes:

| Preço atual em K34 | Preço em K40 |
|---:|---:|
| R$15,00 | R$17,65 |
| R$17,00 | R$20,00 |
| R$34,00 | R$40,00 |
| R$170,00 | R$200,00 |

“Desfazer lote” restaura preços e referências anteriores **somente se todos os produtos continuarem na revisão resultante daquele lote**. Se houve mudança posterior, nada é revertido. Nesse caso, confira a situação atual e calcule uma nova prévia. Pedidos antigos e preços independentes dos combos não são alterados.

### Calculadora para novos produtos

Dentro do cadastro/edição, abra “Preço por Robux e estoque”. Informe a quantidade e a cotação; “Usar preço calculado” preenche o preço, sem salvar sozinho. A curva foi reproduzida do bot enviado:

- Até 350 Robux: proporção de R$15 por 350, em K34.
- De 350 a 450: R$15 mais R$0,02 por Robux adicional, em K34.
- De 450 a 999: evolução de R$17 em 450 até R$34 em 1.000, em K34.
- De 1.000 em diante: quantidade × cotação / 1.000.
- Ao trocar o K, toda a curva acompanha a proporção. Arredondamento no final, para centavos.

Na calculadora, 500 Robux em K40 dá R$21,82. Se um produto existente foi fixado comercialmente em R$18,55 no K34, o reajuste proporcional desse **preço salvo** dá R$21,82 também; outros valores podem diferir por um centavo da curva calculada diretamente, devido ao arredondamento do preço antigo. A prévia mostra o valor efetivo.

Editar um preço manualmente ativa a proteção daquele produto, inclusive no editor rápido e em ajustes percentuais já existentes. Para voltar a incluí-lo, salve a edição e depois desmarque “proteger” no cadastro e salve novamente. A categoria também precisa estar habilitada. Uma cotação registrada pela calculadora é preservada no produto; informar apenas a quantidade de Robux não altera o preço sozinho.

## Cadastro por planilha

Produtos → Importar planilha:

- Baixe o modelo CSV; preencha no Excel/Google Planilhas e salve como **CSV UTF-8**. O importador aceita vírgula ou ponto e vírgula, aspas e descrições com múltiplas linhas.
- Até 500 produtos/500 KB por arquivo. Jogos e categorias devem existir; use nome ou slug. Nomes ambíguos exigem o identificador correto.
- Se preencher `preco`, esse valor prevalece. Se deixar vazio, preencha `robux` e informe a cotação na tela. O cálculo acontece também no servidor.
- Confira a prévia e confirme. Todas as linhas são criadas juntas como **produtos ocultos**. Erro em uma linha impede toda a importação. Repetir a confirmação da mesma prévia não duplica a importação.
- Revise imagens, textos, preços e estoque antes de publicar. A planilha cria novos produtos; não atualiza automaticamente produtos existentes. Uma nova importação do mesmo arquivo é uma nova operação: não a repita depois do sucesso.

## Entrega e organização

- Produto → instruções de entrega específicas. Jogo → instruções padrão usadas quando o produto não tiver suas próprias.
- Orientações aparecem na página do produto e são congeladas nos **novos pedidos**, inclusive nos componentes dos combos. Pedidos antigos não recebem instruções inventadas retroativamente.
- Pedido/suporte → “Organização da equipe”: responsável opcional e notas privadas. Você pode selecionar seu próprio nome; a atribuição aparece nas listas. Não altera permissões nem bloqueia outros administradores.
- Somente administradores acessam essa área; as notas não vão para o cliente, e-mail ou Discord. A tela mostra as últimas 20 notas; as anteriores ficam preservadas no banco.
- Atendimento → respostas rápidas: criar/editar, desativar e associar a um jogo. Elas preenchem o rascunho e dependem de revisão e envio pelo atendente.
- Produto → limite de estoque baixo individual. O filtro e o resumo do painel respeitam o limite; estoque ilimitado fica fora do alerta.

## Pedidos sem comprovante

A automação vem **desligada**. Em Atendimento você pode ativar um prazo de 24 a 720 horas; o valor inicial é 72 horas.

Só encerra pedidos em `awaiting_payment`, sem registro de comprovante, sem pagamento, sem estoque baixado, sem anexos na conversa e sem atividade recente, inclusive organização interna recente. Outros estados são preservados. A ativação ou mudança do prazo inicia uma carência nova, inclusive para pedidos antigos.

Usa o cron já existente (`/api/maintenance/chat-attachments`, diário, protegido por `CRON_SECRET`). A configuração de cron e a variável precisam existir na Vercel. O processamento ocorre em lotes de até 200 por execução; se houver mais, continua nas execuções seguintes. O diagnóstico mostra a última execução efetiva com automação habilitada.

O encerramento registra histórico e uma notificação interna ao cliente. **Não torna a chave Pix inválida e não é confirmação automática de pagamento.** Se o cliente pagou sem enviar o comprovante, deve contatar o suporte para conferência manual. Não há disparo de campanha de recuperação de carrinho.

## Relatórios, histórico e diagnóstico

- Relatórios por período: pagamentos, receita recebida, descontos, ticket médio, tempo entre pagamento e entrega, cancelamentos, produtos/combos, jogos e cupons. CSV exporta os produtos do período. Não calcula lucro: a loja não possui um custo confiável cadastrado para todos os itens.
- Receita usa data de pagamento e exclui cancelados. Cancelamentos usam data de criação; a entrega média usa os pedidos pagos no período e já entregues. Horário de Brasília. Descontos são rateados pelos itens; o arredondamento de linhas pode gerar diferença de centavos em somas apresentadas.
- Nomes de itens vêm do pedido; o jogo é associado pelo catálogo atual. Produtos excluídos aparecem como catálogo anterior. Combos aparecem separados para evitar duplicar componentes.
- Interesse mostra os 30 produtos com mais solicitações ativas de reposição/favoritos. Não expõe os clientes dessa lista.
- Cupons mostram usos reservados, pagos e pendentes. Um cancelamento continua liberando a reserva como antes.
- Histórico do catálogo registra antes/depois a partir desta atualização, com administrador quando identificável. Movimentações do sistema/integrações são identificadas separadamente.
- Diagnóstico agrupa erros do servidor, checkout, operações novas, cron e e-mails. A mesma falha aberta incrementa o contador. Também apresenta as últimas 20 tentativas de envio que falharam; uma tentativa antiga não significa que um reenvio posterior falhou.
- Não é monitoramento externo de disponibilidade. Se o banco estiver fora do ar, o diagnóstico pode não registrar a falha; confira os logs da Vercel. URLs, e-mails e credenciais reconhecidas são ocultados antes de registrar mensagens.

## O que foi preservado

Login Discord/e-mail, implementação Google com flag desligada, retorno após autenticação, domínio oficial, metatag e HTML do Search Console, sitemap, menu público sem Produtos, servidores sem vencimento, favoritos, cupons, avaliações e seus arquivos privados, carrinho, estoque de combos, Pix manual, sons de comprovante e retenção de anexos. Nenhuma rotina nova de exclusão de avaliações ou renovação de servidores foi adicionada.

Consulte `VERIFICACOES-OPERACAO.md` para os testes e seus limites. Consulte `BACKUP-E-RESTAURACAO.md` para backup de banco e imagens; guardar apenas este ZIP não copia os dados do Supabase.
