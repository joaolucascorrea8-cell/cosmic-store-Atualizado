const fs = require('node:fs');
const path = require('node:path');

module.exports = function isolatedEnv(api, site, extras = {}) {
  if (new URL(api).hostname !== '127.0.0.1') throw new Error('A homologação exige Supabase HTTP em loopback.');
  const env = Object.fromEntries(['PATH','HOME','NODE_PATH','LANG','LC_ALL','TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  // Neutraliza também nomes de variáveis de arquivos ignorados, sem ler/exibir valores.
  const root = path.resolve(__dirname, '..');
  for (const file of fs.readdirSync(root).filter(f => f.startsWith('.env'))) {
    if (!fs.statSync(path.join(root, file)).isFile()) continue;
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [, name] of source.matchAll(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) env[name] = '';
  }
  return Object.assign(env, {
    NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-test',
    SUPABASE_SECRET_KEY: 'local-test', SUPABASE_SERVICE_ROLE_KEY: 'local-test',
    NEXT_PUBLIC_SITE_URL: site, NEXT_TELEMETRY_DISABLED: '1', COSMIC_ISOLATED_TEST: '1',
    PIX_KEY: 'homologacao@example.invalid', PIX_RECEIVER_NAME: 'COSMIC TESTE', PIX_RECEIVER_CITY: 'TESTE',
    GMAIL_USER: '', GMAIL_APP_PASSWORD: '', DISCORD_BOT_TOKEN: '', DISCORD_ADMIN_WEBHOOK_URL: '',
    BYROBUX_API_KEY: '', NPM_CONFIG_CACHE: '/tmp/cosmic-npm-cache',
  }, extras);
};
