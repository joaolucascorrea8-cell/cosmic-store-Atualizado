# Cosmic Store — notificações, som e Discord

Esta versão foi feita em cima do ZIP atual enviado em 24/09/2026.

## O que mudou

- Som das notificações ficou mais forte e mais perceptível.
- Volume padrão dos avisos: 85%, com controle entre 35% e 100% no botão flutuante de conversas.
- O som passa a ser preparado após a primeira interação normal com a página, respeitando as regras de autoplay do navegador.
- Administradores recebem aviso sonoro global enquanto a Cosmic Store estiver aberta, mesmo fora da conversa específica, para:
  - novo pedido;
  - novo comprovante;
  - nova mensagem de suporte;
  - nova mensagem no chat de pedido;
  - nova denúncia da comunidade.
- O botão flutuante agora mostra contadores separados em **Suporte** e **Meus pedidos**.
- Ao abrir Suporte ou Meus pedidos, os avisos daquela área são marcados como lidos e o contador correspondente some.
- Abrir apenas o menu flutuante não apaga mais todas as notificações.
- Link público do Discord disponível sem login e também para usuários logados:
  - menu principal no PC;
  - menu mobile;
  - menu da conta;
  - rodapé;
  - página de login, separado da opção "Entrar com Discord".
- Convite configurado: https://discord.gg/qQkQzKng3

## Configuração do Discord

O site já possui o convite acima como fallback, então funciona mesmo sem variável nova.

Para deixar o convite fácil de trocar pela Vercel, adicione esta variável em **Vercel > Project > Settings > Environment Variables**:

```env
NEXT_PUBLIC_DISCORD_INVITE_URL=https://discord.gg/qQkQzKng3
```

Depois faça um novo deploy.

## Banco de dados

**Não há migração SQL nova nesta atualização.** Ela usa as tabelas e o Realtime que já existem no projeto atual.

## Como testar antes de publicar

1. Rode `npm install` ou `npm ci` no seu PC.
2. Rode `npm run build`.
3. Entre como administrador e clique em qualquer parte da página uma vez para o navegador liberar áudio.
4. Em outro navegador/aba anônima, entre como cliente e crie um pedido.
5. Confira se o administrador ouve o alerta mesmo fora do DM/conversa específica.
6. Envie um comprovante e confira o segundo alerta.
7. Responda um suporte como admin e confira se o cliente recebe som e o número em **Suporte**.
8. Responda o chat de um pedido e confira se o cliente recebe som e o número em **Meus pedidos**.
9. Abra cada área e confirme que o contador correspondente é limpo.
10. Teste o link Discord deslogado, logado, no PC e no celular.

## Limitação do navegador

O áudio e o Realtime funcionam enquanto a Cosmic Store estiver aberta no navegador. Se o site estiver totalmente fechado, não é possível tocar som apenas com o código atual. Para avisar com o site fechado seria necessário implementar Web Push/PWA.

Alguns navegadores também bloqueiam áudio antes da primeira interação do usuário com a página; por isso esta versão prepara o áudio depois do primeiro clique/toque/tecla.
