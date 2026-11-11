# SEO do catálogo

Sitemap dinâmico por consultas públicas (não herda sessão administrativa): produtos ativos vinculados a categorias de jogos ativos, páginas de jogos/categorias e páginas gerais. Paginação de leitura acima de 500 registros, deduplicação de URLs e erro explícito se uma consulta falhar; não publica sitemap parcial como sucesso. Sem lastModified fictício. Limite de 50 mil URLs: acima disso, exige divisão; o catálogo atual não se aproxima desse limite.

Títulos de produtos incluem jogo; categorias têm descrição própria. Product JSON-LD mantém preço, disponibilidade e vendedor reais, e adiciona sku/identificador estável e categoria; BreadcrumbList acompanha a hierarquia. Não inventa avaliações, frete, prazos nem estoque. Canonical de URLs existentes preservado; buscas/filtros/paginação recebem noindex,follow com canonical de base, pois o sitemap já oferece descoberta de todos os produtos. Robots bloqueia também raízes privadas e rotas de autenticação/chat. Essas diretivas não substituem autenticação.

Testes: sitemap exclui relações invisíveis e duplicações; parâmetros de busca/filtros/paginação identificados. Executor isolado confirmou URLs de produto/jogo/categoria no XML, título com jogo, sku e BreadcrumbList no JSON-LD e noindex na busca. Build/TypeScript e navegação mobile/desktop passaram. Dados de laboratório anteriores à otimização de desempenho em qa/results/storefront-before-performance.json.

Pendente no destino: confirmar NEXT_PUBLIC_SITE_URL com o domínio oficial, testar Search Console e rich results com URL de homologação autorizada. Sitemap pode ser monitorado/cacheado no provedor depois de medir atualização; nenhuma implantação ou dado real foi alterado.
