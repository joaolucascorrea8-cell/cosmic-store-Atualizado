# Privacidade e autenticação

A migration `202611120005` preserva os dados e fecha dois acessos desnecessários: clientes não leem `discord_id`/`auth_provider` de outros perfis nem podem forjar esses campos. Nicknames e avatares continuam disponíveis nos chats; o cliente só edita os campos públicos do próprio perfil. O provedor exibido na conta vem dos metadados autenticados do Supabase. O vínculo Discord continua sendo atualizado pelo callback OAuth no servidor.

Comprovantes só podem ser criados na pasta do próprio pedido aberto. O cliente não substitui o arquivo já enviado; reenvio usa outro nome e preserva o anterior. A API recusa caminhos com segmentos adicionais. Nada disso transforma o comprovante em prova bancária definitiva: a conferência do extrato continua obrigatória.

Cadastro funciona com confirmação de e-mail habilitada ou com sessão imediata conforme a configuração existente do projeto. Não alteramos essa configuração. Sem sessão, a interface orienta a confirmar e oferece reenvio; não orienta a desativar segurança. Nova senha de cadastro tem mínimo de oito caracteres, como na recuperação. Login de contas existentes foi mantido. Recuperação valida o usuário no servidor de Auth e trata queda de rede sem prender o formulário.

Testes SQL cobrem leitura/alteração de perfil alheio, campos privados, comprovante em outro pedido e imutabilidade do arquivo. A jornada HTTP usa Auth simulado para cadastro, confirmação pendente, reenvio, recuperação expirada, recuperação válida e alteração de senha. Isso valida o contrato/interface, não a entrega real de e-mail do Supabase ou a configuração OAuth. Usamos localhost de forma consistente: o Next normaliza loopback em redirects e cookies de 127.0.0.1 não servem para localhost.

Migrations foram executadas apenas em PGlite e PostgreSQL efêmero. Nenhum usuário ou arquivo real foi alterado. Configuração dos templates, URLs permitidas, limites de Auth, proteção contra abuso e credenciais OAuth precisa ser conferida em homologação autorizada e na configuração real antes da publicação.
