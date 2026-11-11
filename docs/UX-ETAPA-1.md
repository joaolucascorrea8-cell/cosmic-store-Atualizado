# UX 1 — jogo e categoria na compra

Cards (catálogo, categoria, relacionados, favoritos), detalhe, carrinho, checkout e confirmação exibem jogo/categoria. Acessibilidade de links/botões de compra distingue nomes iguais. A regra continua sendo um nickname para todo o pedido; a explicação orienta conferir os jogos e falar com a equipe se precisar de nicknames diferentes. Não foi adicionado nickname por item nem divisão automática de pedidos.

Carrinhos antigos: nenhum campo obrigatório foi acrescentado ao armazenamento ou à assinatura de checkout. Uma leitura em lote, por UUID (máximo 40), resolve o contexto público atual. Não se infere jogo pelo slug nem se alteram preço, quantidade, identidade, validade do carrinho ou disponibilidade. Contexto inacessível é informado como indisponível, sem apagar itens. Novos metadados são apenas apresentação; o servidor continua calculando pagamentos.

Confirmação/retomada do pedido: nomes, valores e quantidades vêm dos order_items já registrados e protegidos por RLS. Jogo/categoria são consultas atuais e aparecem explicitamente como catálogo atual. Pedidos antigos não tinham snapshot imutável desses dois campos; não foi inventado histórico nem alterado seu conteúdo. Snapshot histórico de jogo/categoria exigiria proposta separada e autorização de migração. Falhas de metadados não desfazem pedido criado nem invalidam idempotência.

Validação: 126 testes passam (incluindo preservação de carrinho/assinatura e snapshot antigo), lint e TypeScript sem avisos/erros; build fictício passa. Executor UX testa dois Dragons em jogos diferentes a 390/1440 px, carrinho legado e checkout, incluindo confirmação por resposta interceptada fictícia (nenhum pedido ou Pix é criado no servidor real ou de produção). 19 verificações de interface passaram, zero imagens quebradas/overflow/erros JS. Capturas antes em /workspace/scratch/cosmic-ux-review/before e após esta etapa em /workspace/scratch/cosmic-ux-review/etapa1/after. O QR da confirmação é ilustrativo, sem valor de pagamento.

Nenhuma regra de negócio, migração, escrita real ou publicação. Branch audit/cosmic-store-20261111. O build aponta para fixture e NÃO deve ser implantado.
