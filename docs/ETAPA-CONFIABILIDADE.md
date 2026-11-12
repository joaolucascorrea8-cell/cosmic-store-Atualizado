# Confiabilidade e inspeção Vercel

O executor legado agora valida o HTTP 410 e a ausência de ofertas no catálogo retirado. Confere também os redirecionamentos público e administrativo (307 antes do streaming ou meta refresh após streaming). Conserva os testes de pedidos históricos, recusa sem imagem/credenciais, alterações concorrentes, erro SQL sanitizado, motivo de recusa e criptografia/entrega de contas antigas.

Validação isolada: nove verificações HTTP/Server Actions aprovadas com Supabase fictício; nenhuma integração externa acionada. O aviso de SupportForm foi corrigido incluindo orderType entre as dependências: o efeito usa esse valor ao restaurar o contexto do pedido; rascunhos salvos continuam prioritários.

Inspeção Vercel, sem deploy: Next 16.4.6 exige Node >=20.9; Linux/Node 24.22.1 e Sharp 0.35.5 executaram build e servidor. vercel.json agenda a manutenção diariamente às 08:15 UTC. A rota exige CRON_SECRET e deve continuar no runtime Node. Não mudar para Edge: proxy do Next 16 e uso de crypto/TLS/Sharp dependem de Node. A seleção efetiva do Node, limites do plano, bindings, cron e SMTP na conta Vercel não são acessíveis por esta inspeção; não foram certificados. NEXT_PUBLIC_SITE_URL deve ser a origem oficial e NEXT_PUBLIC_SUPABASE_URL a raiz do projeto no build autorizado do destino. O artefato .next atual usa dados fictícios e não deve ser implantado.
