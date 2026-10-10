# Atualização automática das contas — 10/10/2026

Não é necessário ficar clicando no botão. A vitrine já verificava novidades automaticamente; esta revisão também ativa a consulta automática em **Admin → Robux → Contas** e deixa isso claro na interface.

## Como funciona

- Abrir o Admin de contas já inicia uma consulta em segundo plano, depois de mostrar os dados salvos.
- Com o painel visível, ele verifica novidades a cada 90 segundos. Usa o mesmo mecanismo de atualização da loja, que protege campos em edição.
- A vitrine continua verificando o catálogo a cada 90 segundos. Agora informa **Atualização automática** e o botão opcional se chama **Atualizar agora**.
- A consulta do fornecedor respeita o cache e o bloqueio compartilhados. Vários acessos não fazem várias coletas completas simultâneas. O intervalo de 90 segundos da tela não é uma garantia de conclusão da coleta nesse tempo: ela depende da resposta e da quantidade de páginas públicas do fornecedor.
- Ofertas novas entram e ofertas removidas deixam de ficar disponíveis após uma consulta válida. Falha externa preserva o último estado conhecido; não apaga pedidos nem snapshots.
- Se você estiver editando a margem ou a política, a atualização visual do Admin espera para não apagar seu texto. Salve ou desfaça a edição para retomar. A vitrine tem sua própria verificação automática.
- Com a vitrine e esse painel fechados ou em abas ocultas, não há coleta contínua por este mecanismo. O acesso seguinte retoma as consultas. O endpoint opcional de agendamento já documentado continua disponível, mas não foi configurado um cron novo.

## Instalação

1. Extraia `cosmic-store-atualizacao-automatica.zip` na raiz do seu projeto, onde está `package.json`, substituindo os arquivos correspondentes. Este patch parte da versão com a correção de avisos que você enviou ao GitHub no commit `936b73c`.
2. Preserve `.git`, `.env.local` e suas configurações privadas.
3. No terminal do VS Code, execute:

```bash
npm run check
npm run build
git add .
git commit -m "Ativa atualização automática das contas no Admin"
git push origin main
```

4. Espere o deploy da Vercel terminar e abra **Admin → Robux → Contas**.

**Sem SQL novo, sem migration nova e sem variável de ambiente nova.** Mantenha a chave de entrega já configurada. Preços, pagamento, entrega por credenciais, política e Quick Buy não mudaram nesta revisão.

O projeto completo `cosmic-store-contas-robux-20261009.zip` também foi atualizado e contém todas as revisões. Para instalar por ele, copie o conteúdo de sua pasta `cosmic-store` sobre o projeto existente; não é necessário aplicar os dois ZIPs.

## Verificação

1. Abra o Admin de contas sem clicar em **Consultar agora (opcional)**. A consulta deve iniciar quando o intervalo/cache permitir; acompanhe os horários do painel.
2. Deixe a aba visível. A tela verifica mudanças a cada 90 segundos. Uma coleta longa pode aparecer somente no ciclo seguinte.
3. Edite um campo sem salvar: a atualização automática não deve descartar a edição. Salve ou desfaça para liberar a atualização.
4. Abra a vitrine de contas: veja **Atualização automática** junto à quantidade de opções. Os filtros continuam funcionando.
5. Confira no celular a leitura do novo texto e do botão opcional.

ESLint, TypeScript, os 99 testes e o build completo passaram. O teste HTTP da aplicação compilada confirmou que o simples acesso ao Admin chama o controle de sincronização em segundo plano; uma nova renderização faz outra verificação sem depender do formulário. Supabase foi simulado e o teste não consultou o fornecedor nem produção. As proteções de cache/falhas/lease continuam cobertas pelos testes de banco existentes. A inspeção visual em navegador não foi repetida porque o executável não estava disponível.

Arquivos alterados: `ARQUIVOS-ATUALIZACAO-AUTOMATICA.md`. Checkpoint anterior: `cosmic-store-antes-atualizacao-automatica.zip`.
