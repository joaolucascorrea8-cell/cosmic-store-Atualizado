# Cosmic Store — Gmail automático de pagamento e entrega

Este patch foi feito em cima do ZIP `cosmic-store-completa - Copia(7).zip`.

## O que muda

- Mensagens comuns de pedido e suporte **não enviam Gmail para o cliente**.
- Ao clicar em **Confirmar pagamento**, o cliente recebe um e-mail bonito de pagamento confirmado.
- Ao clicar em **Marcar como entregue**, a loja exige que a equipe tenha enviado uma imagem no chat do pedido. A imagem mais recente enviada por owner/admin é anexada ao e-mail de entrega.
- Notificações do site e DMs do Discord continuam funcionando.
- Se o Gmail falhar depois que o status do pedido já tiver sido atualizado, o painel mostra **E-mail pendente** e permite reenviar sem alterar o pedido novamente.
- O histórico administrativo mostra o título de cada aviso/e-mail enviado.

## 1. Copiar os arquivos do patch

Copie as pastas/arquivos para a raiz da Cosmic Store e permita mesclar/substituir quando o Windows perguntar.

Arquivos alterados/criados:

- `lib/gmail.ts` (novo)
- `lib/order-emails.ts` (novo)
- `lib/notifications.ts`
- `app/admin/pedidos/actions.ts`
- `app/admin/pedidos/[id]/page.tsx`
- `supabase/migrations/202609240003_order_transactional_emails.sql` (novo)
- `.env.example` (somente referência; não substitui `.env.local`)

Não é necessário instalar pacote npm novo. O SMTP usa APIs nativas do Node.js.

## 2. Supabase — obrigatório ANTES do deploy

Abra Supabase > SQL Editor > New query e execute o conteúdo de:

`supabase/migrations/202609240003_order_transactional_emails.sql`

Ele adiciona apenas dois campos no pedido:

- `payment_email_sent_at`
- `delivery_email_sent_at`

Eles servem para registrar que cada e-mail já foi enviado e evitar duplicidade.

## 3. Variáveis

Você informou que já configurou estas duas no `.env.local` e na Vercel:

```env
GMAIL_USER=cosmicstoreteam@gmail.com
GMAIL_APP_PASSWORD=SUA_SENHA_DE_APP
```

Opcional:

```env
GMAIL_FROM_NAME=Cosmic Store
```

Se quiser continuar recebendo por e-mail os alertas administrativos que já existem no projeto:

```env
ADMIN_NOTIFICATION_EMAIL=cosmicstoreteam@gmail.com
```

`GMAIL_APP_PASSWORD` deve continuar Secret/Sensitive na Vercel. Não use `NEXT_PUBLIC_` em nenhuma credencial do Gmail.

## 4. Teste recomendado

1. Entre com uma conta de cliente que possua e-mail.
2. Faça um pedido e envie o comprovante Pix.
3. No admin, clique em **Confirmar pagamento**.
4. Confira se chegou o e-mail `Pagamento confirmado`.
5. No chat do pedido, envie uma print da entrega pela conta owner/admin.
6. Clique em **Marcar como entregue**.
7. Confira se chegou o e-mail `Pedido entregue` com a imagem anexada.
8. Responda uma mensagem comum no chat/suporte e confirme que isso gera apenas notificação no site/Discord, sem Gmail para o cliente.

Se o Gmail falhar, abra novamente o pedido no admin. O bloco **E-mail pendente** permitirá reenviar.

## 5. Ordem recomendada para publicar

Primeiro rode a migration no Supabase. Depois, no VS Code:

```bash
npm run build
git add .
git commit -m "Adiciona emails automaticos via Gmail"
git push origin main
```

## Segurança importante

O `.env.example` do ZIP recebido continha um valor preenchido em `CRON_SECRET`. Neste patch ele foi removido do exemplo. Se aquele valor for o mesmo que está atualmente na Vercel, gere um `CRON_SECRET` novo e atualize a Vercel, porque segredos não devem ficar em `.env.example` nem ser enviados ao GitHub.
