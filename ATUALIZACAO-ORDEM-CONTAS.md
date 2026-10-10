# Contas com Robux — menor preço primeiro

Revisão de 10/10/2026. A página `/robux/contas` agora inicia com **Menor preço total** selecionado, mostrando contas do menor preço para o maior. As alternativas **Melhor valor por 1K**, **Mais Robux** e **Menos Robux** continuam no seletor. A atualização automática mantém a opção escolhida enquanto a página está aberta.

Esta alteração muda somente a ordem inicial da vitrine. Preços, K, regras por quantidade, checkout, pedidos, entrega, sincronização e Quick Buy permanecem como na versão anterior. A API já suportava essa ordenação; não foi necessário modificar o servidor ou criar SQL.

## Instalar

Se já copiou a revisão de preços por faixa, extraia `cosmic-store-ordem-contas.zip` na raiz do projeto, onde está `package.json`, substituindo os arquivos correspondentes. O patch contém o componente e a documentação desta alteração. Preserve sua pasta `.git` e seus arquivos privados.

Se ainda não instalou a revisão por faixas, use a versão atualizada de `cosmic-store-contas-precos-por-faixa.zip`, que inclui esta ordenação, e siga `ATUALIZACAO-PRECOS-POR-FAIXA.md`. A migration daquela revisão continua necessária apenas para quem ainda não a aplicou. **Não há migration ou variável nova para mudar a ordenação.**

No terminal do VS Code:

```bash
npm run check
npm run build
git add .
git commit -m "Ordena contas com Robux pelo menor preco"
git push origin main
```

Com a Vercel conectada à branch `main`, acompanhe o deploy até **Ready**. Abra novamente a página de contas para usar a ordem padrão nova. Depois, selecione outra ordenação e confira que ela se mantém durante as verificações automáticas.

## Arquivos desta revisão

| Arquivo | Alteração |
| --- | --- |
| `app/robux/contas/AccountCatalog.tsx` | Inicializa o filtro em `price` e coloca Menor preço total como primeira opção. |
| `ATUALIZACAO-ORDEM-CONTAS.md` | Este guia de instalação e escopo. |
| `CONTAS-COM-ROBUX.md` | Documenta a nova ordem inicial e a preservação da opção durante a atualização. |
| `ATUALIZACAO-PRECOS-POR-FAIXA.md` | Atualiza o guia cumulativo com menor preço como padrão. |
| `VALIDACAO-CONTAS-ROBUX.md` | Registra a verificação desta revisão. |
| `ARQUIVOS-CONTAS-ROBUX.md` | Atualiza o manifesto completo do projeto. |
| `ARQUIVOS-PRECOS-POR-FAIXA.md` | Atualiza a relação do patch cumulativo desde o último push confirmado. |

Verificação executada: lint, TypeScript, **105 testes**, build completo e regressões HTTP existentes passaram. Confira a seleção inicial e o comportamento visual em celular após o deploy; a inspeção em navegador não foi repetida neste ambiente.

O checkpoint dos arquivos anteriores foi preservado. Nenhuma alteração foi aplicada no seu site, banco ou GitHub nesta entrega.
