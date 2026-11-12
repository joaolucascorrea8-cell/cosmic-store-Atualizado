# Etapa 2 — identificadores e edição administrativa

## Decisão

| Critério | Slug global com prefixo automático | Slug por jogo e rota composta |
| --- | --- | --- |
| Exemplo | /produto/king-legacy-dragon | /produto/king-legacy/dragon |
| Integridade | Mantém UNIQUE(slug) existente | Requer unicidade composta e consistência jogo/categoria |
| Compatibilidade | Mantém todas as consultas, rotas e links existentes | Requer adaptar consultas, URLs, notificações SQL, SEO e aliases |
| Migração de dados | Não necessária | Necessária, com preenchimento e validação de novos campos |
| Escalabilidade | Índice global e UUIDs existentes atendem ao catálogo | Boa, com mais complexidade de modelo e manutenção |

Escolha: prefixo global automático. Atende ao objetivo de cadastrar nomes iguais em jogos diferentes sem correção manual, com menor superfície de regressão. Slugs já gravados não são renomeados, nem quando o nome/jogo do produto muda. UUIDs, pedidos, estoque e relações permanecem intactos. Não há SQL novo nem migração para executar.

## Comportamento

Novos cadastros automáticos usam jogo + nome, normalizados e limitados a 100 caracteres. A prévia usa a mesma função; o servidor resolve o jogo pela categoria, sem confiar na prévia enviada. Ao colidir, tenta um sufixo aleatório, preservando o limite. UNIQUE do PostgreSQL decide conflitos, inclusive requisições simultâneas; não há consulta prévia seguida de insert desprotegido. As tentativas são limitadas para não travar uma requisição. Falhas de rede ou outras constraints não são repetidas. Em esgotamento excepcional, é permitido tentar novamente, sem exigir inventar um identificador.

A opção avançada de slug manual permanece explícita: um slug escolhido manualmente não é silenciosamente modificado. A geração automática é o padrão, inclusive nos formulários legados sem auto_slug.

O resultado do cadastro devolve slug, revisão e metadados realmente gravados. O editor sincroniza e congela o identificador salvo, evitando tentar o slug original novamente no segundo salvamento. Alterar deliberadamente uma URL existente continua sendo uma operação avançada; aliases gerais para essas mudanças são uma etapa futura.

CSV usa a mesma base com limite de 90 caracteres exigido pela RPC existente. A RPC mantém seu fallback e sua transação/idempotência. Se outra importação ou cadastro provocar conflito de slug, o chamador repete o lote atômico com candidatos novos e o MESMO token, sem repetir falhas de outras constraints. Nenhuma função SQL foi alterada.

A edição rápida envia a revisão original e atualiza somente se ops_version ainda corresponder; o trigger existente incrementa a revisão. Sem correspondência, a interface pede atualização em vez de sobrescrever. O retorno fornece a nova revisão. O editor completo conserva sua proteção anterior. Operações em lote não foram redesenhadas nesta etapa.

## Validação e limites

Testes novos usam PostgreSQL em memória (PGlite), sem credenciais reais: nomes iguais entre jogos; normalização e comprimento; seis inserções concorrentes com colisão e preservação da identidade antiga; não repetição de falhas indevidas; duas edições com a mesma revisão, das quais só uma grava. A revisão usa o cliente Supabase com transporte simulado ligado ao banco em memória.

O teste de busca foi atualizado para o contrato atual de retirada de contas da vitrine; não reativa funcionalidades descontinuadas. A suíte completa, lint, TypeScript e build devem ser executados antes de integrar. Permanece o aviso preexistente de dependência do useEffect de SupportForm.

Limites: não houve cadastro/edição no Supabase real, pagamento ou publicação. Homologação administrativa autenticada e importação ponta a ponta ainda são necessárias antes de uma implantação. Nenhuma mudança visual de estilo ou componente foi feita.

Rollback: reverter este commit de aplicação; não exige reversão de esquema e novos slugs permanecem válidos nas rotas antigas. Manter o commit de segurança. Não renomear slugs já utilizados em links.

Próxima etapa: homologação em ambiente separado, incluindo cadastro → salvar novamente, duplicação, colisões CSV, duas sessões editando e histórico de pedidos; depois investigar otimizador de imagens e ampliar SEO, sem alterar produção automaticamente.

## Resultado desta etapa

- npm run check: 116 testes aprovados, zero falhas, zero pulados; TypeScript passa e lint não tem erros (um aviso preexistente).
- npm run build: aprovado com Next.js 16.4.6.
- Aplicação compilada em loopback: GET / e /produtos retornaram HTTP 200, sem mensagens de erro de catálogo/jogos; /produtos trouxe 24 links distintos de produtos na primeira página.
- Nenhum cadastro administrativo foi executado no banco real. O teste de catálogo utiliza apenas leitura pública.
