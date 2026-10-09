# Cosmic Store — organização das contas, entrega e política

Atualização de 09/10/2026 sobre a versão de Contas com Robux já entregue. O ZIP anterior foi preservado como checkpoint. Não houve acesso ao seu banco, deploy, pagamento ou compra real.

## Instalar em quem já aplicou a primeira atualização

1. Faça backup e copie os arquivos deste pacote para a pasta atual do projeto. Preserve `.git`, `.env.local` e demais configurações privadas. Se usar o ZIP completo, copie o conteúdo de `cosmic-store`; o ZIP de ajuste contém apenas os arquivos desta revisão, na raiz.
2. No SQL Editor do Supabase execute **uma única vez** `supabase/migrations/202610090002_robux_account_delivery_policy.sql`. Não reaplique `202610090001_robux_accounts.sql` se já a executou. A migration nova depende dela, preserva pedidos e não altera SQL antigo.
3. Execute `supabase/verificacoes/202610090002_check.sql`. As três tabelas devem existir com RLS; as três RPCs novas devem indicar `false / false / true`; acesso direto às credenciais e acesso à criação antiga devem indicar `false`. O script não mostra senhas, dados de clientes ou conteúdo cifrado.
4. Gere **uma vez** a chave de entrega no terminal do VS Code:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

5. Copie os 64 caracteres gerados para a variável **`ROBUX_ACCOUNT_DELIVERY_KEY`**, na Vercel em Settings → Environment Variables, nos ambientes que usam esse banco. Para rodar localmente contra o mesmo banco, coloque a mesma chave no `.env.local`. Nunca use prefixo `NEXT_PUBLIC_`, nunca publique a chave no Git e nunca a envie junto das credenciais ao cliente. Não há chave real dentro do pacote.
6. Guarde a chave em um gerenciador de senhas/backup separado. **Mantenha a mesma chave nos próximos deploys.** Trocá-la ou perdê-la impede a leitura das entregas já cifradas; rotação exige recifrar esses registros e não foi automatizada nesta revisão. O backup do banco contém apenas o conteúdo cifrado.
7. Valide e envie:

```bash
npm ci
npm run check
npm run build
git add .
git commit -m "Organiza contas com Robux, entrega e politica"
git push origin main
```

8. Aguarde o deploy no projeto Vercel existente. Mantenha as demais variáveis, domínio, Supabase, Pix, Quick Buy e e-mail como estão. A migration deve entrar antes do código novo. Durante a troca, abas antigas do catálogo precisam ser atualizadas para apresentar a política; o endpoint antigo deixa de criar pedidos sem aceite.
9. Confira `/admin/robux/contas`, revise o texto público de reembolso e faça um pedido controlado.

Se ainda não instalou a primeira atualização: aplique primeiro `202610090001_robux_accounts.sql`, depois `202610090002_robux_account_delivery_policy.sql`. Em quem já usa Contas com Robux, aplique somente a segunda.

## O que muda para o cliente

- Lista compacta com 12 opções por página, faixas de saldo, mínimo/máximo e ordenação por melhor K, menor preço total, mais ou menos Robux.
- Ofertas com exatamente o mesmo saldo, K Cosmic e preço são agrupadas visualmente. Nenhuma cotação é excluída: cada compra continua vinculada a uma oferta real, validada novamente. Se uma estiver reservada, outra oferta disponível pode representar o grupo.
- O catálogo em cache é exibido imediatamente. A coleta usa `after()` do Next para executar depois da resposta, mantendo o bloqueio compartilhado no banco e o intervalo existente. Filtros não esperam uma coleta inteira terminar.
- Ao clicar **Escolher**, um resumo explica que a compra é de uma conta Roblox, e não de saldo para a conta atual. Mostra preço, prazo, reserva e política de reembolso.
- A confirmação de leitura é obrigatória e validada no servidor/banco. Se preço ou política mudar, o cliente precisa conferir novamente. O pedido guarda versão, texto e data da leitura. Alterações posteriores não modificam esse registro.
- Após a entrega, o cliente abre **Ver dados da conta** no próprio pedido. Há usuário, senha oculta, opções de mostrar/copiar e instruções. A senha não vem no HTML inicial, em e-mail, catálogo, armazenamento local ou sessão do navegador.
- O botão **Relatar problema ou solicitar reembolso** usa o suporte existente, com código do pedido e horário da entrega preenchidos. Não depende de o chat estar aberto e permanece disponível após 10 minutos. O ticket só é enviado quando o cliente confirma o formulário.

## Como entregar pelo Admin

1. Confira o Pix e confirme o pagamento pelo fluxo atual.
2. No painel da conta, abra a cotação, confira máscara/saldo/custo e compre manualmente.
3. Marque **Já adquiri manualmente...** e **Registrar aquisição**.
4. Preencha **Usuário da conta Roblox**, **Senha da conta** e, se necessário, **Instruções para o cliente**. Clique em **Salvar dados da conta**.
5. Se o pedido ainda estiver em Pago, use **Iniciar preparação**. Depois clique em **Liberar conta e concluir entrega**.
6. O cliente recebe a notificação/e-mail existentes com link para consultar os dados no pedido. Para **contas**, não é mais exigido mandar print no chat; usuário e senha salvos substituem essa exigência. Produtos comuns continuam exigindo a imagem e Quick Buy continua com a entrega própria.

Os campos exigem pagamento confirmado e aquisição registrada. A entrega não conclui sem dados salvos. Alterações concorrentes por administradores são recusadas em vez de sobrescrever silenciosamente. Os eventos registram a ação, sem incluir usuário/senha.

Pedidos antigos entregues por chat mantêm seu histórico. A atualização não inventa aceite de política nem preenche credenciais antigas. Se necessário, um Admin pode salvar os dados em um pedido antigo já entregue, desde que a aquisição esteja registrada; nesse caso o cliente passa a vê-los imediatamente.

## Política enviada pelo lojista e ajuste aplicado

O texto recebido, com data de 04/03/2026, exige vídeo desde a compra externa até o login, login imediato e report em até 10 minutos da compra externa. Lista saldo ausente, Robux já gastos e senha inválida como problemas elegíveis, e exclui ausência de vídeo, login tardio ou report após o prazo. Essas exigências foram mantidas em **Regras operacionais do fornecedor**, dentro do Admin do pedido, identificadas como informação fornecida pelo lojista. Não foram verificadas novamente no fornecedor.

No site público não aparece o nome do fornecedor ou seu Order ID. O cliente recebe as orientações de gravação do primeiro acesso, conferência do saldo e comunicação preferencial nos primeiros 10 minutos **após a liberação dos dados na Cosmic**, pois o pagamento e a aquisição manual podem anteceder a entrega. O Admin deve guardar o vídeo de sua compra e o Order ID original para eventual contestação externa.

**O prazo de 10 minutos não foi transformado em perda automática de direitos legais.** A ausência de vídeo ou relato posterior também não bloqueia automaticamente suporte/reembolso. A política contempla o direito de arrependimento, falhas de acesso/saldo e indisponibilidade, preservando os direitos aplicáveis. O texto é editável no Admin e deve ser revisado para a operação real; orientações jurídicas específicas dependem da análise do caso.

Fontes oficiais consultadas em 09/10/2026: [CDC, arts. 35, 49 e 51](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm) e [Decreto 7.962/2013, arts. 4 e 5](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm).

Não existe estorno bancário automático novo nem upload de vídeo nesta revisão. O cliente preserva o vídeo e informa o problema pelo suporte; a equipe orienta o recebimento privado e processa a devolução cabível pelo procedimento existente. Nenhuma senha deve ser exposta em canais públicos.

## Banco, segurança e compatibilidade

- `robux_account_policy`: texto público, versão e data. Autoria administrativa não é disponibilizada na leitura pública.
- `robux_account_policy_acceptances`: cópia imutável da política, dono do pedido e data. Leitura somente dono/Admin; escrita pela transação do pedido.
- `robux_account_deliveries`: credenciais cifradas com AES-256-GCM, nonce aleatório e vínculo criptográfico ao ID do pedido. RLS habilitado, sem acesso direto por `anon`/`authenticated`; senha só é decifrada no servidor após verificar Admin ou dono de pedido entregue.
- `/api/robux/accounts/delivery/[id]`: exige usuário autenticado, propriedade e entrega concluída; resposta `private, no-store`.
- A criação anterior de conta permanece como implementação interna, sem permissão direta para `service_role`. A nova RPC valida a política e cria pedido e registro de leitura atomicamente.
- A migration substitui a função compartilhada de transição mantendo as regras existentes, com uma mudança limitada: contas usam a trava de credenciais em lugar da imagem. Quick Buy e itens comuns mantêm seus controles.
- Nenhuma migration anterior foi editada. A coleta pública, preços, reserva, snapshots privados e compra manual continuam ativos.

## Testes e conferência após deploy

1. Abra catálogo em celular e desktop. Confira agrupamento, faixas, 12 opções/página e ausência de dados do fornecedor.
2. Escolha uma conta. Sem marcar a leitura, o botão de Pix fica desabilitado. Após marcar, o pedido deve guardar a política.
3. Em duas abas, altere a política no Admin e tente confirmar o resumo antigo: deve exigir releitura. Preço alterado também exige nova confirmação.
4. No Admin, verifique que não é possível salvar credenciais antes de confirmar pagamento/aquisição.
5. Salve dados de teste. Antes da entrega o cliente não pode acessá-los; depois da entrega, somente o dono pode abrir e copiar.
6. Confira o e-mail: link para o pedido, sem senha e sem exigência de imagem para contas. Valide o envio real com um pedido controlado.
7. Abra o suporte pelo pedido. Código e horário devem vir preenchidos; envio cria um atendimento normal. Depois de 10 minutos o botão continua funcionando.
8. Confira um pedido comum com imagem e um Quick Buy no fluxo original.
9. Execute o SQL de verificação. Confira `ROBUX_ACCOUNT_DELIVERY_KEY` e guarde seu backup fora do Git.

Consulte `VALIDACAO-CONTAS-ROBUX.md` para resultados e limites dos testes locais. A lista desta revisão está em `ARQUIVOS-AJUSTE-CONTAS.md`.
