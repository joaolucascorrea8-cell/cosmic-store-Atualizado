# Avaliações do Discord + avaliações com imagem

## O que este patch faz

- Importa o histórico do canal do Discord em lotes seguros para a Vercel.
- Toda avaliação importada recebe 5 estrelas, nome/display name, data original e selo `Discord · Avaliação importada`.
- Usa `discord_message_id` único para nunca duplicar uma mensagem já importada.
- Se houver imagem, importa a primeira imagem da mensagem, reduz para no máximo 1600 px e converte para WebP.
- A imagem fica no bucket privado `review-attachments` e só abre por URL assinada.
- Avaliações novas do site continuam disponíveis apenas em pedidos entregues, agora com print opcional.
- Imagens de avaliações NÃO entram na limpeza de 60 dias dos chats. Elas permanecem enquanto a avaliação existir, porque são parte do feedback público.

## 1. Discord Developer Portal

No bot que você já usa, em **Bot > Privileged Gateway Intents**, deixe **Message Content Intent** ligado.

O bot já está como administrador no seu servidor, então tem permissões suficientes para a importação. Depois da migração, é recomendado retirar `Administrador` e manter apenas o necessário.

## 2. Variáveis

No `.env.local` e na Vercel:

```env
DISCORD_REVIEWS_CHANNEL_ID=1235674278838669352
DISCORD_REVIEWS_IMPORT_ENABLED=true
```

`DISCORD_BOT_TOKEN` e `DISCORD_GUILD_ID` já existem e continuam iguais. Nunca exponha o bot token.

Depois que terminar a importação, volte `DISCORD_REVIEWS_IMPORT_ENABLED=false` e faça um novo deploy.

## 3. Dependência para otimizar imagens

O patch adiciona `sharp` ao `package.json`. Rode:

```bash
npm install
```

## 4. Supabase

Execute no SQL Editor:

`supabase/migrations/202609250004_discord_reviews_import.sql`

Ele adapta a tabela `feedbacks` e cria o bucket privado `review-attachments`. Não apaga avaliações existentes.

## 5. Importação

Depois do deploy:

**Admin > Avaliações > Importar avaliações do Discord**

1. Clique em **Analisar canal**.
2. Confira a quantidade encontrada.
3. Clique em **Importar avaliações**.
4. Aguarde o contador terminar. O navegador chama o servidor em lotes de 50 mensagens para evitar timeout.
5. Confira as avaliações e imagens.
6. Volte `DISCORD_REVIEWS_IMPORT_ENABLED=false` na Vercel e redeploy.

## 6. Avaliações novas

Somente pedidos `Entregue` mostram o formulário. Estrelas e texto são obrigatórios. A print é opcional.

## 7. Build e Git

```bash
npm install
npm run build
git add .
git commit -m "Adiciona importacao de avaliacoes do Discord"
git push origin main
```
