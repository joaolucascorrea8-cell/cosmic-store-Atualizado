# Backup da Cosmic Store

O ZIP é a cópia do **código**. Os dados de contas, catálogo, pedidos, mensagens, cupons, servidores, configurações, histórico e avaliações estão no Supabase. Os arquivos de imagens e comprovantes também precisam de uma cópia própria.

Este projeto inclui uma rotina **local, manual e de leitura na origem**. Ela não roda pela Vercel e não envia backups para terceiros. Não foi executada contra seu projeto de produção nesta entrega.

## Preparar uma vez

1. Instale o Supabase CLI oficial e Docker Desktop. Deixe o Docker aberto. O comando `supabase --version` deve funcionar no PowerShell. Instruções: https://supabase.com/docs/guides/local-development/cli/getting-started
2. Na pasta do projeto, após `npm install`, copie `.env.backup.example` para `.env.backup.local`.
3. Preencha a URL do seu projeto, a chave **service_role** privada e a conexão PostgreSQL mostrada em Supabase → Connect → Session Pooler, porta 5432. A senha é a senha do banco, com caracteres especiais codificados para URL. A URL do banco e a URL de Storage precisam ser do mesmo projeto.
4. Se necessário, indique o caminho de `supabase.exe` em `BACKUP_SUPABASE_CLI`. Nunca use uma variável `NEXT_PUBLIC_` para essas credenciais.

O arquivo local de credenciais e a pasta `backups/` são ignorados pelo Git. Guarde as cópias em um disco ou gerenciador privado, de preferência criptografado. Elas incluem dados de clientes e de autenticação.

## Criar e conferir

```powershell
npm run backup
npm run backup:verify -- "backups\NOME-DA-PASTA-GERADA"
```

A primeira execução pode levar mais tempo porque o CLI usa uma imagem Docker. O terminal informa a etapa e a pasta final. Se falhar, a cópia fica marcada como **incompleta** e não passa na conferência; execute novamente após corrigir a instalação/conexão. A rotina não apaga backups anteriores.

Cada pasta contém:

- `roles.sql`: papéis de banco exportados pelo CLI.
- `schema.sql`: estrutura da aplicação, funções e permissões incluídas pelo CLI.
- `data.sql`: dados dos schemas `public`, `auth` e `storage`, explicitamente selecionados; tabelas de índices vetoriais do Storage não fazem parte desta loja e são excluídas.
- `managed-schema-reference.sql`: estrutura de `auth` e `storage` para referência técnica de políticas e gatilhos. **Não aplique esse arquivo inteiro em outro Supabase**: parte desses schemas é gerenciada pela plataforma.
- `migrations/`: SQLs da versão do código usada no backup.
- `objects/`: conteúdo de todos os arquivos atuais dos buckets comuns, incluindo os privados. Nomes locais são hashes para funcionar no Windows; o nome original, bucket, tipo e configurações ficam no manifesto.
- `manifest.json`: inventário, datas, tamanho e SHA-256 de cada arquivo. Não contém as chaves usadas para conectar.

A conferência detecta arquivos ausentes ou alterados. Não substitui um ensaio de restauração. Use um período sem compras, edições ou uploads para reduzir divergências entre o banco e os arquivos. A rotina verifica mudanças no inventário de Storage durante a cópia, mas banco e Storage não oferecem um único snapshot transacional compartilhado.

Guarde **também** o ZIP/Git correspondente e um registro privado das configurações de Vercel, Auth/OAuth, SMTP, Discord e domínios. Senhas de provedores, configuração de infraestrutura, arquivos já apagados e versões antigas de objetos não são exportados por este script. Se futuramente usar Vault, Edge Functions, schemas adicionais, buckets vetoriais ou outros serviços, amplie o procedimento conforme a documentação desses serviços.

## Ensaiar a recuperação

Restaure primeiro em **outro projeto Supabase**, sem usuários ou pedidos reais novos. Nunca ensaie sobre a loja ativa.

1. Confira o backup com `backup:verify`. Reserve o ZIP da mesma versão.
2. Siga o procedimento oficial de restauração lógica de banco, adaptando os arquivos gerados: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
3. Restaure os papéis e a estrutura; carregue os dados com as precauções de gatilhos, extensões e permissões do guia. Preserve grants restritos das tabelas privadas. `managed-schema-reference.sql` serve para localizar as personalizações necessárias em Auth/Storage; recupere apenas os gatilhos e políticas próprios da loja, comparando com os SQLs em `migrations/`. Não execute novamente todo o conjunto de migrações sobre dados restaurados sem revisão, pois SQLs antigos redefinem funções.
4. Reconfigure a publicação Realtime e as variáveis do projeto de teste. Contas podem precisar entrar novamente. OAuth, SMTP e integrações dependem da configuração dos respectivos provedores.
5. Restaure os arquivos com a rotina abaixo. O banco contém metadados de Storage, mas não o conteúdo binário dos objetos.
6. Confira os totais e quantidades no admin; abra imagens de produtos e avaliações; teste login, carrinho, Pix de teste, confirmação/entrega de um pedido de teste, chat e a privacidade dos anexos. Não aponte o domínio da loja para o projeto de ensaio até conferir tudo.

Para obter um procedimento de desastre integralmente validado, faça esse ensaio com suas credenciais e configurações. Esta entrega testa o código de cópia/conferência localmente com dados simulados; não afirma que sua restauração real foi executada.

## Restaurar arquivos em outro projeto

Primeiro veja a simulação, sem nenhuma conexão de escrita:

```powershell
npm run backup:restore-storage -- "backups\NOME-DA-PASTA-GERADA"
```

Crie `.env.restore.local` com as credenciais **do novo projeto**:

```dotenv
RESTORE_SUPABASE_URL=https://REFERENCIA-NOVA.supabase.co
RESTORE_SERVICE_ROLE_KEY=CHAVE-PRIVADA-DO-NOVO-PROJETO
RESTORE_CONFIRM_PROJECT=REFERENCIA-NOVA
```

Quando o banco de destino estiver preparado e revisado:

```powershell
npm run backup:restore-storage -- "backups\NOME-DA-PASTA-GERADA" --apply
```

A rotina recusa a URL de origem, confere todos os hashes antes de começar, cria buckets ausentes com a privacidade original, preserva conteúdo já idêntico e recusa substituir um conteúdo diferente. Metadados restaurados via SQL podem já existir: o upload recompõe o conteúdo ausente. Não use o destino durante a restauração. Se houver falha, os arquivos já enviados permanecem; resolva o problema e execute novamente.

Se o novo Supabase tiver outro domínio, URLs públicas gravadas no catálogo/avatares podem ainda apontar para o projeto antigo. Revise e migre esses campos antes de desativar a origem. Caminhos de anexos privados e avaliações continuam usando o bucket e o nome original.
