# Auditoria da compra na Cosmic Store

A regressão de compra consecutiva foi corrigida sobre a revisão `2985dc9` da `main`. Um cliente pode cancelar um pedido, adicionar outro produto, clicar em **Ir para pagamento** e gerar um Pix para o novo pedido na mesma aba. O teste também cobre a compra do mesmo produto, com o mesmo nickname, após a entrega anterior.

## Erros e correções

| Área | Causa e efeito | Correção |
| --- | --- | --- |
| Entrada no checkout | `restore()` usava o `orderId` de `cosmic-checkout-draft-v2` quando a URL não continha pedido. Um rascunho antigo podia abrir outro Pix ou redirecionar para um pedido encerrado. | A entrada pelo carrinho abre uma compra nova. A retomada de um pedido criado usa `/checkout?pedido=<id>`, consulta o servidor e verifica o titular e a situação. A recarga preserva o pedido explícito. |
| Comprovante e carrinho | O sucesso do envio podia limpar um carrinho montado depois, se os itens e o nickname coincidissem. | Somente a criação confirmada consome o carrinho que originou o pedido, se a assinatura ainda coincidir. Retomar um pedido ou enviar seu comprovante preserva compras posteriores. A API distingue falha de armazenamento, pedido inexistente e mudança de status. |
| Resposta perdida e cupom | A reserva podia usar a última unidade ou o último uso do cupom antes de a resposta chegar ao navegador. Uma nova cotação podia recusar a própria tentativa. | A tentativa guarda token, seleção, nickname, cupom e total por conta. O retry recupera o resultado da transação original. O servidor compara os dados do pedido antes de devolver uma resposta reaproveitada. |
| Preço e disponibilidade | O carrinho usava preço e limite de estoque salvos no navegador. Atualizar a página podia repetir os valores antigos. | O carrinho consulta o catálogo, atualiza valores e quantidades e sinaliza itens indisponíveis. Falhas de leitura preservam a seleção e permitem tentar novamente. A RPC confere preços, estoque, cupom e total sob trava antes de reservar. |
| Troca de conta | O carrinho e o rascunho geral do suporte usavam chaves compartilhadas. Respostas de preferências podiam chegar durante uma troca de identidade. | Carrinho, tentativa e rascunho de suporte passam a ter titular. O carrinho de visitante criado pelo novo fluxo acompanha o login. A interface troca os dados de preferências quando a identidade muda. |
| Pix e situação do pedido | Um checkout aberto mantinha o QR após uma mudança de status. Respostas podiam conter o código copia e cola mesmo sem QR. Um crédito excepcional em conferência também podia deixar visível outro Pix. | A tela reconfirma a situação ao voltar ao primeiro plano e periodicamente enquanto está visível. A API omite o código de pedidos sem pagamento disponível. Um crédito excepcional encaminha o cliente ao acompanhamento. |
| Reserva e cancelamento | A expiração automática verificava comprovante e confirmação, mas não o recebimento excepcional já registrado. | A rotina mantém o pedido e a reserva para conferência manual. Cancelamento, confirmação, crédito tardio e devolução continuam sendo operações distintas. |
| Game Pass | A aritmética de ponto flutuante calculava um passe de 31 para 21 Robux líquidos, ou 62 líquidos para um passe de 90. Valores padrão habilitavam vendas se a configuração falhasse. | A taxa usa razões inteiras. Validação, criação e execução verificam a cotação e o custo efetivo. Falhas nas configurações, no saldo ou na cotação interrompem a etapa pertinente. A calculadora vincula a tentativa à conta, quantidade, modalidade e passe, inclusive após uma resposta perdida. |
| Comunicação de entrega | O histórico e o e-mail usavam um prazo fixo para Robux mesmo quando a equipe alterava o prazo configurado. | O pedido entregue e a mensagem de entrega usam a estimativa configurada. A situação de cancelamento tem precedência sobre rótulos antigos do fornecedor. |
| Permissões | Havia privilégios de execução mais amplos que o fluxo administrativo exigia e leitura de colunas internas do fornecedor junto com os dados do pedido. | As migrations restringem as RPCs administrativas, aplicam as permissões do chamador à consulta de cargo e limitam as colunas do Game Pass disponíveis ao cliente. A equipe mantém o acesso operacional pelo servidor. |

## Validação

| Verificação | Resultado |
| --- | --- |
| ESLint, TypeScript e build de produção do Next.js | Aprovados com configuração isolada. |
| Testes unitários e de integração | 172 aprovados, zero falhas e zero ignorados. Incluem preço de produtos abaixo e acima de 1K, igualdade entre a tabela em TypeScript e SQL, prazos, cupons, permissões e estoque. |
| Compra por HTTP e navegador | 24 cenários aprovados. Incluem cancelamento, entrega, resposta perdida após commit, duas compras idênticas de Game Pass, troca de conta, comprovante recusado e reenviado, crédito tardio e devolução parcial. |
| PostgreSQL 17.12 em contêiner efêmero | 13 cenários aprovados. Incluem conexões concorrentes disputando a última unidade, último uso de cupom, tentativa de fornecedor, privilégios por papel e coluna, expiração com crédito e restauração de backup. |
| Administração e vitrine | 13 cenários de catálogo administrativo e 9 verificações HTTP administrativas aprovados. Vitrine, UX e suíte de desempenho passaram. As verificações de compra e painel usaram Chromium com larguras de 390 e 1440 pixels. |
| Dependências de produção | A consulta `npm audit --omit=dev` reportou zero vulnerabilidades conhecidas na execução. |

Os fluxos de compra usaram o Next.js compilado, pedidos sintéticos, API Supabase local e fornecedor simulado. O teste de perda de conexão descartou a resposta depois de o servidor confirmar a transação. Ao recarregar e retomar, as asserções encontraram um pedido, um desconto e uma baixa de estoque. Os testes de compras consecutivas mantiveram o armazenamento do navegador durante a sequência. As operações financeiras foram registros fictícios no banco de teste.

## Limites e liberação

- O armazenamento antigo compartilhado não identifica o titular do carrinho ou do nickname. Ele permanece no navegador e a nova interface não o atribui automaticamente a uma conta. Na primeira visita após a atualização, pode ser preciso adicionar novamente os itens de um carrinho antigo. Pedidos já criados continuam no histórico.
- A cobertura móvel usa viewport de celular em Chromium. Liquidação bancária, entrega comercial da ByRobux, e-mails reais e aparelhos físicos ficaram fora da homologação. Um Pix copiado anteriormente pode ser pago fora da loja mesmo após o cancelamento. Esse caso continua a exigir conferência do extrato e registro de recebimento tardio.
- O PR contém três migrations novas. A primeira protege a reserva de pedidos com crédito excepcional. A segunda restringe colunas internas do Game Pass. A terceira restringe permissões administrativas. A versão da aplicação que consulta somente as colunas públicas do Game Pass deve estar disponível antes de aplicar a restrição de colunas.
- A entrega é para revisão. A implantação e a aplicação das migrations no banco ativo dependem de confirmação do responsável. O build de teste contém endereços locais.
