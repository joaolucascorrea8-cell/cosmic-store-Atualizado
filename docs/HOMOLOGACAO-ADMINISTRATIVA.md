# Homologação administrativa — Cosmic Store

Data: 11/11/2026. Branch: audit/cosmic-store-20261111.
Aplicação validada: commits 9cdf30e e 9dd59c7. Esta etapa acrescenta apenas testes e documentação; não corrige nem altera comportamento da loja.

## Isolamento

Banco PostgreSQL/PGlite exclusivamente em memória, criado pelo fixture de testes. Jogos, produtos, usuário administrativo e pedido são sintéticos. O adaptador HTTP local executa as consultas e as funções SQL reais das migrações sobre esse banco, materializando os relacionamentos necessários da API PostgREST. Ele não é uma implementação completa do Supabase.

Processos de build e aplicação recebem uma lista explícita de variáveis permitidas: não herdam URL, chave administrativa nem credenciais de integrações reais. Supabase é substituído por http://127.0.0.1:54328; aplicação compilada escuta apenas 127.0.0.1:3120. O navegador bloqueia destinos não locais; a rodada final não tentou nenhum destino externo. Duas sessões usam contextos independentes do Chromium. Nenhuma operação de banco, pagamento, migração ou publicação foi executada em produção.

## Resultados dos formulários reais

| Cenário | Resultado | Evidência |
| --- | --- | --- |
| 1. Dragon / King Legacy | Passou | king-legacy-dragon; categoria correta |
| 2. Dragon / Blox Fruits | Passou | blox-fruits-dragon; categoria correta |
| 3. Outro Dragon / King Legacy | Passou | sufixo automático de 12 caracteres, sem colisão; formulário sincronizado; segundo salvamento conserva o slug |
| 4. Edição de produto antigo | Passou | nome atualizado; UUID e slug dragon conservados |
| 5. CSV com Dragon nos dois jogos | Passou | dois novos produtos ocultos; prefixos correspondem aos jogos; anteriores não substituídos |
| 5b. CSV repetido na mesma categoria | Passou conforme regra atual | mensagem de produto repetido; nenhuma gravação |
| 6. Duplicação | Passou | novo UUID e slug; cópia oculta e estoque zero; original conservado |
| 7. Duas sessões no editor completo | Passou | segunda gravação desatualizada recusada com mensagem; primeiro preço preservado |
| 7b. Duas sessões na edição rápida | Passou | mesmo bloqueio por revisão; primeiro preço preservado |
| 8. Carrinho, favoritos, pedidos, links antigos | Passou | /produto/dragon acessível; carrinho referencia UUID e slug antigos; favorito gravado pelo botão; pedido aparece e conserva nome/preço históricos |
| 9. Integridade dos identificadores | Passou na amostra | oito produtos com slugs únicos; novos prefixos correspondem aos jogos; dois slugs legados preservados |
| 10. Validações | Passou | preço abc recusado pelo servidor; categoria vazia barrada pelo navegador; mensagens e ausência de gravação verificadas |
| 10b. Slug manual inválido | Passou | INVALIDO! recusado no servidor com erro inline; nenhuma gravação |

Resultado final: 13 verificações aprovadas, zero falhas no novo executor, zero erros do adaptador, zero erros JavaScript no navegador. O JSON bruto desta execução está em qa/results/admin-catalog-20261111.json. UUIDs e sufixos gerados variam entre execuções.

A repetição dentro do mesmo jogo e categoria em um único CSV é rejeitada intencionalmente na prévia. Isso é diferente de cadastrar novamente um produto, que recebe um sufixo automático. Se a operação exigir múltiplas linhas idênticas na mesma planilha, será necessário aprovar a mudança dessa regra; não foi alterada nesta etapa.

## Dependências e regressão

- Node.js 24.22.1; Next.js e eslint-config-next 16.4.6; Sharp 0.35.5.
- Build completo com Turbopack, TypeScript, servidor next start, hidratação e Server Actions executados com sucesso no ambiente isolado.
- npm run check: 116 testes passaram, zero falhas e zero pulados. Inclui testes locais de banco, permissões, pedidos, estoque, cupons, backup e contas históricas.
- Lint sem erros; permanece o aviso preexistente em app/suporte/SupportForm.tsx:48 (dependência orderType).
- npm audit: zero críticos/altos, sete apontamentos moderados de desenvolvimento. npm audit --omit=dev: zero vulnerabilidades reportadas.
- Seletores iniciais do novo teste foram refinados para esperar hidratação e distinguir controles visíveis de cópias temporárias ocultas do streaming e de cards relacionados. Nenhum código da aplicação foi modificado para fazer os testes passarem.

## Falha encontrada em teste legado — não corrigida

Comando: node qa/check-admin-order-actions.cjs, executado sem credenciais reais.

Falha em qa/check-admin-order-actions.cjs:218: o executor espera HTTP 200 de /api/robux/accounts/catalog, mas a rota atual responde 410 porque a venda de contas foi retirada intencionalmente. A suíte para nesse ponto; os cenários posteriores desse executor NÃO foram executados e não são considerados aprovados neste relatório.

Causa: contrato de teste anterior à retirada da funcionalidade. Correção recomendada: atualizar as expectativas de descontinuação e separar os testes de pedidos históricos e ações administrativas do antigo catálogo público, preservando sua cobertura. Não reativar a venda para satisfazer o teste. Aguarda autorização; o executor legado foi preservado.

## Compatibilidade com hospedagem

O Next instalado requer Node >=20.9.0. Build e execução foram confirmados com Node 24.22.1/Linux, incluindo Sharp, roteamento e Server Actions. O repositório possui vercel.json e usa APIs compatíveis com o runtime Node, mas não declara engines no package.json.

Não foi acessada a configuração efetiva da Vercel nem realizado deploy de homologação no provedor. Portanto, compatibilidade local foi demonstrada, mas runtime selecionado, limites, variáveis de build, cron e integrações da hospedagem permanecem sem validação no provedor. Recomenda-se conferir/fixar uma versão suportada do Node e validar um ambiente separado no provedor, com credenciais de homologação, após autorização. Essa conferência não equivale a publicar o site real.

## Limites e próximos passos propostos

Realtime não foi simulado: endpoint retorna indisponibilidade controlada e os testes não certificam eventos ao vivo. Autenticação usa sessão fictícia validada pelo adaptador; OAuth, entrega de e-mails, assinatura real de tokens e RLS da instância publicada não foram homologados por este executor. As políticas SQL são cobertas separadamente pelos testes em memória.

A verificação de carrinho/favoritos/pedidos usa dados históricos sintéticos, sem cobrança nem envio de comprovante. Não certifica Pix, SMTP, Discord ou ByRobux externos. Não constitui teste de carga nem prova universal de todos os identificadores possíveis.

Próxima etapa sugerida: autorizar atualização do executor HTTP legado e definição do runtime de hospedagem; depois validar integrações em ambiente separado. Otimização de imagens e SEO continuam como etapas posteriores. Nenhuma dessas correções foi implementada aqui.

## Reprodução

Pré-requisitos: npm ci; Node >=20.9; Playwright disponível no ambiente e Chromium em /usr/bin/chromium. As portas 54328 e 3120 devem estar livres. Não executar simultaneamente com outro build no mesmo checkout.

    node --import tsx qa/check-admin-catalog.cjs
    npm run check

O executor encerra seus processos e descarta o banco em memória. Logs e resultados intermediários vão para /tmp/cosmic-admin-catalog-*. O build em .next fica configurado para o Supabase fictício local: é artefato de teste, NÃO deve ser implantado. Antes de qualquer implantação futura autorizada, gerar outro build com as variáveis corretas do ambiente de destino. Nenhum artefato .next está versionado neste commit.
