# Configuração completa da Cosmic Store

## 1. Supabase

No painel do Supabase, abra **SQL Editor > New query** e execute, nesta ordem:

1. `supabase/migrations/202609200001_create_profiles.sql`
2. `supabase/migrations/202609200002_store_complete.sql`

O primeiro arquivo cria perfis, nickname, avatar e o bucket `avatars`. O segundo cria pedidos, itens, comprovantes, notificações, chats, moderação, feedbacks e o bucket privado `payment-proofs`.

## 2. Variáveis do projeto

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE
NEXT_PUBLIC_SITE_URL=http://localhost:3000

PIX_KEY=SUA_CHAVE_PIX
PIX_RECEIVER_NAME=SEU NOME
PIX_RECEIVER_CITY=SUA CIDADE
```

`PIX_RECEIVER_NAME` aceita no máximo 25 caracteres e `PIX_RECEIVER_CITY` no máximo 15. O sistema remove acentos automaticamente no código Pix.

Nunca envie `.env.local` ao GitHub. A chave `SUPABASE_SERVICE_ROLE_KEY` é secreta.

## 3. E-mails automáticos (opcional)

Crie uma conta no Resend, valide o domínio e acrescente:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Cosmic Store <pedidos@seudominio.com>
ADMIN_NOTIFICATION_EMAIL=seuemail@gmail.com
```

Sem essas variáveis, a loja continua funcionando, mas não envia e-mails externos. As notificações internas continuam ativas.

## 4. Discord (opcional)

Para avisos administrativos, crie um webhook em um canal privado:

```env
DISCORD_ADMIN_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_ADMIN_MENTION=<@SEU_ID>
```

Para mensagens privadas e entrada automática no servidor:

```env
DISCORD_BOT_TOKEN=TOKEN_DO_BOT
DISCORD_GUILD_ID=ID_DO_SERVIDOR
```

O bot precisa estar no servidor. O login solicita `identify`, `email` e `guilds.join`. Se o usuário bloquear mensagens privadas, o e-mail e as notificações do site continuam funcionando.

## 5. URLs de autenticação

Em **Supabase > Authentication > URL Configuration**, durante os testes, permita:

```text
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
```

Quando publicar, acrescente as mesmas rotas usando o domínio oficial.

## 6. Rodar e testar

```powershell
npm install
npm run dev
```

Ordem recomendada de teste:

1. Criar uma conta e alterar nickname/avatar.
2. Adicionar um produto ao carrinho.
3. Finalizar, informar o nickname do jogo e gerar o Pix.
4. Enviar um comprovante de teste.
5. Abrir `/admin/pedidos` com a conta owner.
6. Abrir o comprovante e confirmar o pagamento.
7. Testar o chat particular do pedido.
8. Marcar como entregue e enviar um feedback.
9. Testar `/chat` com duas contas.
10. Conferir os três feedbacks na página inicial.

## 7. Situações dos pedidos

- `Aguardando pagamento`
- `Comprovante enviado`
- `Em análise`
- `Pago`
- `Preparando entrega`
- `Entregue`
- `Comprovante recusado`
- `Cancelado`

O envio do comprovante nunca confirma o pagamento. Somente owner/admin pode marcar como pago.

