import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { verifyBackup, safeFile } from "./backup-core";
async function main() {
  const folder = process.argv[2];
  if (!folder)
    throw new Error("Uso: npm run backup:restore-storage -- pasta [--apply]");
  const root = resolve(folder),
    manifest = await verifyBackup(root);
  if (!process.argv.includes("--apply")) {
    console.log(
      `Simulação: ${manifest.buckets.length} buckets e ${manifest.objects.length} arquivos. Nenhum dado foi enviado. Leia BACKUP-E-RESTAURACAO.md antes de usar --apply.`,
    );
    return;
  }
  if (existsSync(".env.restore.local")) loadEnvFile(".env.restore.local");
  const url = process.env.RESTORE_SUPABASE_URL ?? "",
    key = process.env.RESTORE_SERVICE_ROLE_KEY ?? "",
    confirmation = process.env.RESTORE_CONFIRM_PROJECT ?? "";
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) ||
    url === manifest.source ||
    !key ||
    confirmation !== new URL(url).hostname.split(".")[0]
  )
    throw new Error(
      "Configure um projeto diferente em .env.restore.local e confirme seu identificador.",
    );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const b of manifest.buckets) {
    const { data, error } = await client.storage.getBucket(b.id);
    if (error) {
      if (!["400", "404"].includes(String(error.statusCode)))
        throw new Error("Não foi possível consultar os buckets de destino.");
      const r = await client.storage.createBucket(b.id, {
        public: b.public,
        fileSizeLimit: b.file_size_limit ?? undefined,
        allowedMimeTypes: b.allowed_mime_types ?? undefined,
      });
      if (r.error)
        throw new Error("Não foi possível criar um bucket de destino.");
    } else if (data.public !== b.public)
      throw new Error(
        "A privacidade de um bucket difere do backup. Corrija antes de restaurar.",
      );
  }
  let uploaded = 0,
    skipped = 0;
  for (const o of manifest.objects) {
    const storage = client.storage.from(o.bucket),
      current = await storage.download(o.name);
    if (current.data) {
      const hash = createHash("sha256")
        .update(Buffer.from(await current.data.arrayBuffer()))
        .digest("hex");
      if (hash !== o.sha256)
        throw new Error(
          "Um arquivo diferente já existe no destino. Nada será sobrescrito.",
        );
      skipped++;
      continue;
    }
    if (
      !current.error ||
      !["400", "404"].includes(String(current.error.statusCode))
    )
      throw new Error("Não foi possível conferir um arquivo de destino.");
    // Metadados de storage.objects podem ter vindo do SQL. Upsert recompõe o conteúdo ausente.
    const r = await storage.upload(
      o.name,
      await readFile(safeFile(root, o.path)),
      { contentType: o.contentType, upsert: true },
    );
    if (r.error)
      throw new Error(
        "Falha ao restaurar um arquivo. A execução pode ser retomada.",
      );
    uploaded++;
  }
  console.log(
    `Storage restaurado: ${uploaded} arquivos enviados; ${skipped} já conferidos. Teste os acessos privados e públicos no novo projeto.`,
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Falha na restauração.");
  process.exitCode = 1;
});
