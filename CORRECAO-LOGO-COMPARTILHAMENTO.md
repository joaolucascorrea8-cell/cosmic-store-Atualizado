# Cosmic Store — logo na prévia dos links

Revisão de 10/10/2026. A página inicial agora informa a logo CS como imagem de compartilhamento. O favicon com o triângulo da Vercel foi substituído pelo ícone CS que já existia no projeto.

## Alterações

| Arquivo | Finalidade |
| --- | --- |
| `app/layout.tsx` | Acrescenta nome da loja e imagem Open Graph, com endereço, tipo PNG, tamanho 512 × 512 e descrição acessível. |
| `app/favicon.ico` | Passa a conter o PNG de 32 × 32 da Cosmic, sem alterar os pixels da imagem original. |
| `qa/check-admin-order-actions.cjs` | Confere o HTML da home com identificação de coletor WhatsApp, a URL absoluta da logo e as respostas públicas da imagem/favicon. Mantém as verificações anteriores. |
| `ARQUIVOS-CONTAS-ROBUX.md` | Atualiza a lista completa de arquivos comparada ao ZIP original. |
| `CORRECAO-LOGO-COMPARTILHAMENTO.md` | Este guia de instalação, validação e escopo. |

As imagens existentes em `public/images/branding/` são reutilizadas. Não foi criada outra logo nem alterado seu design. As páginas de produtos, jogos e combos mantêm os metadados próprios. O domínio configurado, a verificação do Google, autenticação, preços, pagamentos, pedidos, Robux e atualização automática permanecem como antes.

## Instalar

1. Baixe `cosmic-store-logo-compartilhamento.zip` e copie seu conteúdo para a raiz do projeto no VS Code, onde está `package.json`. Substitua os arquivos correspondentes; preserve `.git` e os arquivos privados. Não é necessário aplicar SQL ou adicionar variáveis.
2. Confira a variável **já existente** `NEXT_PUBLIC_SITE_URL` na Vercel: para o domínio oficial informado nesta conversa, o valor é `https://www.cosmicstore.com.br`. A imagem usa a configuração de endereço do site já existente. Não foram alterados domínio, redirects ou callbacks. Se ajustar essa variável, faça um novo deploy para atualizar os metadados.
3. No terminal do projeto:

```bash
npm run check
npm run build
git add .
git commit -m "Corrige logo no compartilhamento e favicon"
git push origin main
```

4. Com a Vercel conectada à branch `main`, aguarde o deploy ficar **Ready**. Abra `https://www.cosmicstore.com.br/images/branding/cosmic-store-icon-512.png`: deve aparecer a logo CS. O endereço `https://www.cosmicstore.com.br/favicon.ico` também deve entregar o ícone CS.
5. Cole o link da loja no campo de uma nova mensagem do WhatsApp e aguarde a prévia antes de enviar. A conferência deve ser feita em uma nova prévia; não foi testada nem garantida a alteração de miniaturas em mensagens antigas.

O ZIP completo `cosmic-store-contas-robux-20261009.zip` também foi atualizado e inclui esta correção e todas as revisões anteriores. O patch de logo pode ser usado separadamente sobre a versão atual desta conversa.

## Validação executada

- Lint, TypeScript e **105 testes** passaram.
- O build completo do Next.js 16.3.8 passou.
- A aplicação compilada foi consultada por HTTP com `User-Agent: WhatsApp/2.26.1 A`, sem login. A imagem aparece no `<head>` da home como URL absoluta no domínio configurado, com tamanho e texto alternativo corretos.
- A imagem de compartilhamento e o favicon responderam HTTP 200 com os tipos corretos; os bytes recebidos são os mesmos dos arquivos do projeto.
- O favicon foi aberto para inspeção visual e contém a logo CS. O PNG original está incorporado ao ICO sem alteração dos pixels.
- As verificações HTTP anteriores de catálogo, atualização automática, mensagens de erro e entrega por credenciais também passaram.

Os testes usaram Supabase simulado localmente. Não houve mensagem enviada a outras pessoas, acesso à sua conta do WhatsApp, alteração no banco, push ou deploy. A prévia no aplicativo real precisa ser conferida depois da publicação.

Os arquivos anteriores foram preservados em checkpoint antes da mudança. A lista completa do projeto permanece em `ARQUIVOS-CONTAS-ROBUX.md`.
