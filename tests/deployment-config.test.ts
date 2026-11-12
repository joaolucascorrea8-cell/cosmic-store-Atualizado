import test from "node:test";
import assert from "node:assert/strict";
import { deploymentIssues } from "../lib/deployment-config";
import { spawnSync } from "node:child_process";
test("build hospedado recusa Supabase fictício, URL com caminho e chave secreta pública", () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SITE_URL: "https://store.com.br", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc" };
  assert.deepEqual(deploymentIssues(env), []);
  for (const url of ["http://127.0.0.1:54328", "https://example.invalid", "https://project.supabase.co/rest/v1", "https://project.supabase.co/?x=1"]) assert.ok(deploymentIssues({ ...env, NEXT_PUBLIC_SUPABASE_URL: url }).length);
  assert.ok(deploymentIssues({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden" }).length);
  const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.ficticio`;
  assert.deepEqual(deploymentIssues({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("anon") }), []);
  assert.ok(deploymentIssues({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("service_role") }).length);
  assert.ok(deploymentIssues(env, true).some(issue => issue.includes("PIX_KEY")));
});
test("next.config bloqueia um ambiente Vercel que use o build fictício", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", "require('./next.config.ts')"], {
    env: { PATH: process.env.PATH, NODE_ENV: "production", VERCEL: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54328", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-test", NEXT_PUBLIC_SITE_URL: "http://localhost:3120" }, encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Configuração de hospedagem inválida/);
});
