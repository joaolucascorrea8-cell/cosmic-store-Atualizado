# Cosmic Store

Versão unificada da loja: interface renovada com catálogo real no Supabase, autenticação, painel administrativo e carrinho persistente.

## Requisitos

- Node.js 20 ou superior
- Um projeto Supabase já configurado

## Instalação

1. Copie `.env.example` para `.env.local`.
2. Preencha as três variáveis com os dados do seu Supabase.
3. No terminal, execute:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Variáveis necessárias

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Nunca envie `.env.local` para o GitHub. A chave `SUPABASE_SERVICE_ROLE_KEY` deve existir somente no servidor.

## O que está funcionando

- Página inicial ligada às tabelas `games` e `products`.
- Catálogo completo de produtos ativos.
- Navegação por jogo e categoria.
- Página individual de cada produto.
- Carrinho salvo no navegador, com quantidades.
- Login por e-mail/senha e Discord através do Supabase Auth.
- Cadastro por e-mail com escolha de nickname.
- Perfil público com nickname e avatar, preparado para chats e feedbacks.
- Recuperação e redefinição de senha.
- Proteção do painel pelas permissões da tabela `admins`.
- Cadastro, edição, ativação/desativação e exclusão de produtos.
- Ordenação manual dos produtos na vitrine pelo painel administrativo.
- Cadastro de jogos.
- Checkout Pix com valor calculado no servidor.
- Upload privado de comprovante.
- Pedidos e confirmação manual pelo painel.
- Notificações internas, e-mail e Discord configuráveis.
- Chat global e conversa privada por pedido.
- Feedback geral da loja vinculado a compras entregues.
- Moderação administrativa de mensagens e avaliações.

## Estrutura principal

- `app/page.tsx`: página inicial.
- `app/produtos`: catálogo completo.
- `app/produto/[slug]`: detalhes do produto.
- `app/[jogoSlug]`: categorias de um jogo.
- `app/[jogoSlug]/[categoriaSlug]`: produtos da categoria.
- `app/carrinho`: carrinho do cliente.
- `app/admin`: painel protegido.
- `app/login`: autenticação.
- `lib/supabase`: clientes do Supabase.
- `public/images/products`: imagens locais dos produtos.

## Configuração da fase de perfis

No SQL Editor do Supabase, execute o arquivo:

```text
supabase/migrations/202609200001_create_profiles.sql
```

Ele cria a tabela `profiles`, as políticas RLS, o perfil automático para contas novas e existentes e o bucket de avatares.

## Configuração completa

Consulte `GUIA_CONFIGURACAO.md` para configurar Supabase, Pix, e-mail e Discord e realizar os testes.

## Ordem manual de produtos

Para usar a ordenação manual da vitrine, execute também `supabase/migrations/202609230001_product_display_order.sql` no Supabase antes do deploy.
