function publicRoot(value: string | undefined) {
  try {
    const u = new URL(value ?? "");
    return u.protocol === "https:" && !u.username && !u.password && !u.port && u.pathname === "/" && !u.search && !u.hash
      && !/(?:^localhost$|^\d{1,3}(?:\.\d{1,3}){3}$|^\[|\.invalid$|\.example$|\.test$|\.local$|^(?:www\.)?example\.(?:com|org|net)$)/i.test(u.hostname);
  } catch { return false; }
}
export function deploymentIssues(env: Record<string, string | undefined>, financial = false) {
  const issues: string[] = [];
  if (!publicRoot(env.NEXT_PUBLIC_SUPABASE_URL)) issues.push("NEXT_PUBLIC_SUPABASE_URL deve ser uma raiz HTTPS pública, sem caminho, parâmetros ou dados fictícios.");
  if (!publicRoot(env.NEXT_PUBLIC_SITE_URL)) issues.push("NEXT_PUBLIC_SITE_URL deve ser a origem HTTPS oficial do destino.");
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  let publicKey = key.startsWith("sb_publishable_");
  if (key.startsWith("eyJ")) {
    try { publicKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "anon"; }
    catch { publicKey = false; }
  }
  if (!publicKey) issues.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ausente ou incompatível; nunca use chave secreta no cliente.");
  if (financial) {
    for (const name of ["PIX_KEY", "PIX_RECEIVER_NAME", "PIX_RECEIVER_CITY", "GMAIL_USER", "GMAIL_APP_PASSWORD", "CRON_SECRET", "BYROBUX_API_KEY"]) if (!env[name]?.trim()) issues.push(`${name} não configurada.`);
    if (!env.SUPABASE_SECRET_KEY?.trim() && !env.SUPABASE_SERVICE_ROLE_KEY?.trim()) issues.push("Configure uma chave administrativa do Supabase somente no servidor.");
    if (env.SUPABASE_SECRET_KEY?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim()) issues.push("Configure somente uma das duas variáveis de chave administrativa para evitar ambiguidade.");
  }
  return issues;
}
import { Buffer } from "node:buffer";
