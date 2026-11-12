# Homologação e publicação futura

Esta revisão NÃO publica o site. O build `.next` é fictício, está ignorado pelo Git e nunca deve ser implantado, copiado para produção ou enviado com `--prebuilt`. Produção precisa de outro build, no destino autorizado e com as variáveis corretas.

## Reproduzir os testes

Node 24.x, npm e Docker local para a bateria PostgreSQL. Playwright 1.62.1 está fixado como dependência de desenvolvimento. Os executores usam Chromium do sistema quando disponível; alternativamente instale o Chromium do Playwright (`npx playwright install --with-deps chromium`) ou informe `COSMIC_CHROMIUM_EXECUTABLE`.

Execute as baterias de build **em sequência**, pois compartilham `.next`:

```sh
npm ci
npm run check
docker pull postgres:17-alpine
npm run test:postgres
npm run test:admin
npm run test:purchase
npm run test:orders
npm run test:ux -- --report=qa/results/final-ux.json
npm run test:storefront -- --report=qa/results/final-storefront.json
```

Os adaptadores usam dados sintéticos em memória. A bateria PostgreSQL usa container descartável sem rede nem portas publicadas, duas conexões independentes e teste de dump/restauração em outra base descartável. Nenhum comando de teste usa URL ou credenciais do Supabase real. Os executores neutralizam variáveis de integrações, inclusive nomes encontrados em arquivos `.env` locais, antes de iniciar o Next; fornecedor de Game Pass é simulado. SMTP/Discord são simulados ou ficam desconfigurados intencionalmente para testar falhas. Não use essas fixtures em hospedagem.

## Configuração da Vercel — inspeção local, não certificação da conta

- Next 16.4.6, React 19.2.8, Node 24.x e Sharp 0.35.5 compilaram e serviram a aplicação em Linux. Manter runtime Node: TLS, crypto e Sharp não são compatíveis com Edge neste projeto.
- `vercel.json` desativa deploy automático da branch `audit/cosmic-store-20261111`. O commit final também usa `[skip vercel]`. Nenhuma configuração da conta Vercel foi alterada. A branch main não é destino do push.
- O workflow GitHub executa instalação, lint, TypeScript, testes, auditoria de dependências de produção e build fictício. Não contém deploy, upload de build ou credenciais reais. A execução remota do workflow precisa ser observada no GitHub; resultados locais não a certificam.
- O cron declarado continua diário às **05h15 de Brasília** (08h15 UTC). Exige `CRON_SECRET`, consulta no máximo três Game Pass e três jobs de e-mail por chamada e respeita um orçamento de recuperação de três minutos. SMTP tem limite total de 45 segundos por envio. Os handlers usam `maxDuration=300`; verificar limites/Fluid Compute/plano efetivos na conta Vercel. Ativação, último disparo e frequência real não foram inspecionados.
- Para maior volume, decidir frequência/capacidade de conciliação conforme o plano disponível. Não foi contratado serviço ou plano. A equipe deve acompanhar pendências e executar recuperação manual quando necessário.
- Imagens dependem da raiz correta de Supabase no build, bucket público de catálogo e cache da rota de imagens. Comprovantes e anexos de atendimento continuam privados, com links temporários. Políticas anteriores de retenção não foram alteradas.

## Variáveis por ambiente

No painel da hospedagem, conferir **separadamente** Production e Preview. Preview deve usar projeto de homologação e integrações simuladas, sem dados de clientes. Não copiamos configurações nem credenciais entre ambientes.

| Finalidade | Variáveis |
| --- | --- |
| Origem oficial | `NEXT_PUBLIC_SITE_URL` — origem HTTPS do destino |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` — raiz HTTPS, sem `/rest/v1`, `/auth/v1` ou parâmetros; `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — chave pública |
| Administração | Uma de `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`, somente no servidor |
| Pix manual | `PIX_KEY`, `PIX_RECEIVER_NAME`, `PIX_RECEIVER_CITY` |
| Gmail | `GMAIL_USER`, `GMAIL_APP_PASSWORD`; opcional `GMAIL_FROM_NAME`, `ADMIN_NOTIFICATION_EMAIL` |
| Discord | Conforme os canais habilitados: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_ADMIN_WEBHOOK_URL`, `DISCORD_ADMIN_MENTION` |
| Game Pass | `BYROBUX_API_KEY`; o endpoint HTTPS padrão está em `.env.example` |
| Manutenção | `CRON_SECRET`, opcional `CHAT_ATTACHMENT_RETENTION_DAYS` |
| Histórico legado | Preservar `ROBUX_ACCOUNT_DELIVERY_KEY` se houver credenciais históricas cifradas. Não gerar outra chave: perder a anterior impede a leitura desses dados |

`NODE_USE_ENV_PROXY=1` atende ao proxy deste ambiente em nuvem; não é uma exigência universal da Vercel. Nenhuma variável secreta deve receber prefixo `NEXT_PUBLIC_`.

O build na Vercel recusa URL fictícia/local, URL Supabase com caminho e chave privada usada como pública. `npm run verify:production` verifica presença/formato sem mostrar valores, sem acessar serviços e sem escrever dados; não substitui testes reais de configuração. Aqui esse comando reprova por faltarem configurações de operação, como esperado no ambiente isolado. Isso não descreve o que está configurado na conta Vercel.

Conferir no Supabase de homologação autorizado: Site URL, redirects de OAuth/recuperação (`/auth/callback`, `/auth/confirm`, `/reset-password`), templates, confirmação de e-mail, limites de autenticação, buckets e RLS. Conferir na hospedagem: domínio, TLS, runtime, cron, acesso SMTP 465 e conectividade com Supabase/Discord/fornecedor. Não enviamos e-mail ou DM reais e não executamos compras para certificar essas integrações.

## Plano de migração seguro — somente após autorização específica

1. Revisar o diff e homologar uma cópia isolada do esquema do projeto real. Os testes com bootstrap sintético não certificam personalizações existentes no banco de destino.
   As tabelas base de administradores, jogos, categorias e produtos já existiam antes das migrations versionadas. A migration `202611120007` protege a tabela `admins` sem alterar atribuições: cliente só consulta a própria role; manutenção passa pelo servidor confiável. Conferir eventuais ferramentas externas de manutenção antes do corte.
2. Verificar backup de esquema, roles, dados e Storage e ensaio de restauração. O backup existente faz dump do banco inteiro, incluindo as novas tabelas; não foi executado contra produção. Guardar chaves de criptografia em cofre separado, nunca no Git.
3. Inventariar pedidos antigos não pagos e não reservados. Nenhuma migration os reescreve ou inventa confirmação bancária. Conferir disponibilidade antes de orientar pagamento desses pedidos.
4. Planejar uma janela sem emissão de novos Pix durante o corte. Após autorização específica, aplicar em ordem `202611120001` a `202611120007` usando o controle de migrations do projeto. Não reaplicar SQL antigo por cima das funções novas.
5. Executar `supabase/verify-final-readiness.sql` no destino autorizado: somente leitura e agregados. Conferir também `store_checkout_capabilities` com acesso de servidor. Se a última migration estiver ausente/incompatível, a aplicação retorna HTTP 503 e não emite Pix; histórico pago continua acessível.
6. Confirmar permissões com usuário comum e administrador, reserva da última unidade, estorno de reserva, conferência de Pix, recebimentos excepcionais, devolução e consulta do fornecedor em homologação. Validar a garantia externa de idempotência da ByRobux; o mock não a comprova.
7. Definir acompanhamento operacional de reservas abandonadas e filas. A expiração continua opt-in conforme configuração anterior; não ativamos prazo comercial novo. Cancelar libera estoque, mas não devolve dinheiro.
8. Somente após aprovação de produção: novo build com configuração real e publicação autorizada. Essa etapa não foi executada.

Não fazer rollback automático para código/funções antigas após iniciar reservas e registros financeiros. Não descartar tabelas ou colunas de conciliação. Se houver falha, pausar novas compras no procedimento operacional autorizado, preservar registros e preparar correção para frente ou rollback revisado com reconciliação do estoque.

## Operação manual preservada

Cliente faz pedido → recebe Pix → envia comprovante → administrador confere o crédito no banco → registra valor/referência e confirma → entrega. Anexo não confirma banco. Pagamento parcial/divergente não libera entrega automaticamente. Pix tardio ou duplicado é registrado separadamente, sem reabrir cancelamento, e pode ter devolução registrada após ser realizada no banco. A loja não executa transferências ou reconhecimento bancário automático.

Novas vendas de Robux usam apenas Game Pass. Pedidos históricos da modalidade encerrada continuam preservados; quando ainda não pagos, não recebem outro Pix. Entrega/credenciais de pedidos antigos já pagos continuam com seus controles anteriores.
