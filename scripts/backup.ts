import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { mkdir, writeFile, copyFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  backupStorage,
  describe,
  verifyBackup,
  type Manifest,
} from "./backup-core";
async function dump(
  executable: string,
  url: string,
  file: string,
  flags: string[],
) {
  await new Promise<void>((ok, fail) => {
    const child = spawn(
      executable,
      ["db", "dump", "--db-url", url, "--file", file, ...flags],
      { shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    // Não escrevemos a saída do CLI: mensagens de conexão podem conter credenciais.
    child.stdout.resume();
    child.stderr.resume();
    child.once("error", () =>
      fail(
        new Error(
          "Não foi possível iniciar o Supabase CLI. Confira a instalação.",
        ),
      ),
    );
    child.once("exit", (code) =>
      code === 0
        ? ok()
        : fail(
            new Error(
              "Exportação SQL falhou. Confira CLI, Docker, conexão e permissões.",
            ),
          ),
    );
  });
}
async function main() {
  if (existsSync(".env.backup.local")) loadEnvFile(".env.backup.local");
  const url = process.env.BACKUP_SUPABASE_URL ?? "",
    key = process.env.BACKUP_SERVICE_ROLE_KEY ?? "",
    dbUrl = process.env.BACKUP_DATABASE_URL ?? "";
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) ||
    !key ||
    !/^postgres(?:ql)?:\/\//.test(dbUrl)
  )
    throw new Error(
      "Configure .env.backup.local seguindo BACKUP-E-RESTAURACAO.md.",
    );
  let connection: URL;
  try {
    connection = new URL(dbUrl);
  } catch {
    throw new Error("URL do banco inválida.");
  }
  const ref = new URL(url).hostname.split(".")[0];
  if (
    connection.hostname !== `db.${ref}.supabase.co` &&
    decodeURIComponent(connection.username) !== `postgres.${ref}`
  )
    throw new Error(
      "A conexão do banco e a URL do Storage devem apontar para o mesmo projeto.",
    );
  const dir = resolve(
    "backups",
    "cosmic-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      randomUUID().slice(0, 8),
  );
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const manifest: Manifest = {
    version: 1,
    complete: false,
    startedAt: new Date().toISOString(),
    source: url,
    files: [],
    objects: [],
    buckets: [],
  };
  const save = () =>
    writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), {
      mode: 0o600,
    });
  await save();
  try {
    const executable = process.env.BACKUP_SUPABASE_CLI || "supabase";
    const jobs: [string, string[]][] = [
      ["roles.sql", ["--role-only"]],
      ["schema.sql", []],
      [
        "data.sql",
        [
          "--data-only",
          "--use-copy",
          "--schema",
          "public,auth,storage",
          "--exclude",
          "storage.buckets_vectors",
          "--exclude",
          "storage.vector_indexes",
        ],
      ],
      ["managed-schema-reference.sql", ["--schema", "auth,storage"]],
    ];
    for (const [name, flags] of jobs) {
      console.log("Exportando " + name + "…");
      await dump(executable, dbUrl, join(dir, name), flags);
      const file = await describe(dir, name);
      if (file.size < 30) throw new Error("Exportação SQL vazia.");
      manifest.files.push(file);
      await save();
    }
    await mkdir(join(dir, "migrations"));
    for (const name of (await readdir("supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      await copyFile(
        join("supabase/migrations", name),
        join(dir, "migrations", name),
      );
      manifest.files.push(await describe(dir, "migrations/" + name));
    }
    console.log("Baixando arquivos públicos e privados…");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await backupStorage(client, dir, manifest, save);
    manifest.complete = true;
    manifest.finishedAt = new Date().toISOString();
    await save();
    await verifyBackup(dir);
    console.log(
      `Backup conferido: ${dir}\n${manifest.objects.length} arquivos do Storage. Leia o guia para ensaiar a restauração em outro projeto.`,
    );
  } catch (error) {
    manifest.complete = false;
    manifest.error = error instanceof Error ? error.message : "Falha no backup";
    await save();
    throw new Error(`Backup incompleto em ${dir}. ${manifest.error}`);
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backup falhou.");
  process.exitCode = 1;
});
