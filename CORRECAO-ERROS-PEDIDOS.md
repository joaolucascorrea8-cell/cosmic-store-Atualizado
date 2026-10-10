# Correção dos avisos no Admin — Cosmic Store

Atualizado em 10/10/2026. Esta revisão mantém o catálogo, a regra de preço mínimo 34/acréscimo 5, as entregas por usuário/senha e a Compra Rápida já implementados.

## O que apareceu nas imagens

A segunda imagem mostra **React #441**, não uma página 404 de rota inexistente. Ao tentar concluir sem imagem ou sem credenciais, o banco recusava corretamente a entrega. O Server Action transformava essa recusa em uma exceção. Em produção, o React esconde o detalhe da exceção e a tela de erro interrompe o pedido.

Agora as recusas esperadas retornam uma mensagem dentro de **Atualizar pedido**, sem marcar a compra como entregue e sem enviar aviso de entrega. O formulário continua disponível para corrigir a pendência e tentar novamente. As verificações de autorização, concorrência, imagem e credenciais no servidor/banco permanecem.

| Tipo de pedido | O que preencher antes de concluir |
| --- | --- |
| Produtos comuns/outros jogos | Enviar a imagem da entrega no chat, como antes. |
| Contas com Robux | Confirmar pagamento, registrar aquisição manual e salvar usuário e senha. Não exige print de entrega. |
| Compra Rápida/GamePass | Usar o fluxo próprio da integração, como antes. |

Também foi incluído o passo a passo da chave na própria área de dados da conta no Admin, quando ela não estiver configurada.

## Como configurar a primeira imagem

`ROBUX_ACCOUNT_DELIVERY_KEY` é a chave que cifra os dados das contas no banco. **Não é a senha de uma conta Roblox, do fornecedor ou do Supabase.** Ela é uma configuração única do servidor, não algo que você preenche a cada pedido.

Se já existirem entregas salvas com essa proteção, recupere e mantenha a chave original. Uma chave nova não abre os dados cifrados com a anterior. Ambientes que acessam o mesmo banco devem usar a mesma chave.

Na primeira configuração:

1. Abra a pasta do projeto no VS Code.
2. Clique em **Terminal → Novo Terminal**.
3. Execute este comando, que funciona com Node.js instalado:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

4. Copie apenas a linha de **64 caracteres** que aparecer. Não copie aspas nem espaços.
5. Abra a Vercel e selecione o projeto da Cosmic Store.
6. Entre em **Settings → Environment Variables** (ou no item **Environment Variables** do projeto).
7. Adicione a variável:

| Campo | Valor |
| --- | --- |
| Name / Key | `ROBUX_ACCOUNT_DELIVERY_KEY` |
| Value | O resultado de 64 caracteres gerado no seu terminal. |
| Environment | `Production`. Use a mesma chave também em Preview/Development se usarem o mesmo banco. |

8. Clique em **Save**. Não use o prefixo `NEXT_PUBLIC_`.
9. Faça o deploy do código corrigido após salvar a variável. Se já tiver enviado o código, abra **Deployments**, selecione o último deploy de produção e use **Redeploy**. Alterar a variável não muda um deploy que já está rodando.
10. Quando o deploy terminar, reabra o pedido. Com pagamento confirmado e aquisição registrada, aparecem os campos **Usuário da conta Roblox**, **Senha da conta** e **Instruções**.
11. Preencha usuário e senha, clique em **Salvar dados da conta** e depois em **Liberar conta e concluir entrega**.

Guarde a chave fora do Git, em um gerenciador de senhas ou backup seguro. Não a envie no chat nem a coloque nos arquivos publicados do projeto. Para rodar localmente contra esse mesmo banco, use a mesma chave no seu `.env.local`, que permanece fora do Git.

Os dados ficam disponíveis ao cliente na área privada do pedido entregue. O e-mail contém o aviso/link de entrega, não a senha.

## Como instalar esta correção

Escolha **um** dos pacotes:

- **`cosmic-store-correcao-erros-pedidos.zip`**: patch para quem já instalou a atualização anterior de contas/preços. Extraia o conteúdo diretamente na raiz do projeto, onde está `package.json`, substituindo os arquivos correspondentes.
- **`cosmic-store-contas-robux-20261009.zip`**: projeto completo atualizado. Copie o conteúdo da pasta `cosmic-store` sobre seu projeto existente. O nome foi mantido para atualizar a entrega anterior; o conteúdo inclui esta correção de 10/10/2026.

Preserve sua pasta `.git`, `.env.local` e demais configurações privadas. Os pacotes não contêm segredos, dependências ou arquivos de build. O checkpoint anterior à correção foi preservado.

**Esta correção não exige migration nova.** As migrations existentes não foram editadas. Se a atualização de entrega por credenciais ainda não tiver sido instalada no banco, siga `ATUALIZACAO-ENTREGA-E-POLITICA.md` e aplique somente a migration pendente `supabase/migrations/202610090002_robux_account_delivery_policy.sql`, seguida do respectivo SQL em `supabase/verificacoes/202610090002_check.sql`. Não reaplique se já estiver instalada. A configuração de preços usa a migration de mínimo de K documentada em `ATUALIZACAO-K-CONTAS.md`.

## Git e deploy

Depois de copiar os arquivos, abra o terminal **na raiz do seu repositório**:

```bash
npm run check
npm run build
git status
git add .
git commit -m "Corrige avisos de entrega e configuração de contas"
git push origin main
```

Se o projeto ainda estiver sem dependências instaladas, execute `npm ci` antes. O build local usa suas configurações habituais do projeto. Confira em `git status` os arquivos que serão enviados; a chave secreta não deve fazer parte do commit.

Se a Vercel já estiver conectada ao mesmo repositório e à branch `main`, acompanhe o novo deploy após o push. A variável precisa estar salva antes desse deploy. Não foi feito push ou deploy em seu nome.

## Validação executada

- ESLint, TypeScript, **99 testes** e build completo do Next.js passaram.
- Aplicação compilada testada por HTTP com Supabase simulado: formulário real recusa entrega comum sem imagem e entrega de conta sem credenciais com aviso inline/HTTP 200; nenhuma mudança de status ou notificação de entrega nessas recusas.
- Formulário real de recusa de comprovante sem motivo retorna aviso. Falhas técnicas de SQL recebem mensagem genérica, sem detalhes internos no HTML.
- Alteração de status concorrente não sobrescreve o pedido.
- Sem chave, aparece a configuração. Com chave válida, aparece o formulário. Campos vazios são recusados, dados completos chegam cifrados ao banco simulado, e a conta é entregue sem imagem após salvá-los.
- As regras reais das RPCs, RLS, credenciais e exigência de imagem dos produtos comuns são cobertas pelos testes isolados existentes com PGlite.
- A inspeção visual em navegador/celular não foi repetida nesta revisão: o executável de navegador não estava disponível. O teste HTTP não substitui essa inspeção.

O teste HTTP reproduzível está em `qa/check-admin-order-actions.cjs`. Execute `node qa/check-admin-order-actions.cjs`: ele faz um build de teste com valores fictícios e usa as portas locais 3110 e 54329. Ele substitui a pasta local de build `.next`; faça seu build normal novamente antes de usar `npm start` ou publicar arquivos compilados. Não aponta para seu banco nem envia mensagens externas.

## Teste rápido depois do deploy

Use pedidos de teste/controlados:

1. Pedido comum em preparação, sem print: tente concluir. Deve aparecer **Envie a imagem da entrega no chat antes de concluir.** O status permanece em preparação.
2. Conta em preparação, com aquisição registrada e sem dados salvos: tente concluir. Deve aparecer **Salve o usuário e a senha da conta antes de concluir a entrega.**
3. Configure a chave e faça o deploy. Salve usuário/senha e conclua a conta: deve funcionar sem print. Entre como cliente dono do pedido e confira a entrega privada.
4. Abra no celular e confira leitura dos avisos, campos e instruções.
5. Confira que a Compra Rápida continua usando seus próprios botões e que novos preços de contas preservam o mínimo configurado.

Referências: [React #441](https://react.dev/errors/441) e [variáveis de ambiente na Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).
