# Etapa 1 — segurança das dependências

Branch: audit/cosmic-store-20261111. Nenhuma implantação ou migração realizada.

Atualizações: Next.js e eslint-config-next 16.3.8 → 16.4.6; Sharp 0.35.4 → 0.35.5. Dependências transitivas atualizadas dentro dos intervalos permitidos, sem --force, com integridade e TLS preservados. Versões confirmadas no registro npm. Os avisos do Next abrangiam versões até 16.4.0; Sharp exigia >=0.35.5. source-map-js e zod também foram atualizados pelo resolvedor.

Auditoria após a instalação: zero alertas críticos/altos; npm audit --omit=dev sem vulnerabilidades. Restam sete apontamentos moderados da cadeia typescript-eslint/minimatch (não são sete falhas independentes da aplicação). Não foram forçadas mudanças de versão principal para removê-los.

Validação: lint sem erros, com o aviso preexistente em SupportForm; TypeScript e build passam. A suíte de 112 testes mantém a falha preexistente no contrato de busca por /robux/contas, retirado intencionalmente da vitrine (111 passam). A etapa seguinte atualizará esse contrato sem reativar vendas descontinuadas.

Reprodução: npm ci --cache /workspace/.npm-cache; npm run check; npm run build; npm audit; npm audit --omit=dev. npm audit retorna código não zero enquanto houver os apontamentos moderados. Não executar npm audit fix --force.

Limites: auditoria de dependências não certifica ausência de vulnerabilidades. Pagamentos e integrações externas não foram acionados. Próxima etapa: política de identificadores compatível com URLs atuais e controle de concorrência administrativo.
