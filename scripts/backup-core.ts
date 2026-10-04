import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, lstat } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
export type BackupFile = { path: string; size: number; sha256: string };
export type ObjectEntry = BackupFile & {
  bucket: string;
  name: string;
  contentType: string;
  updatedAt: string | null;
};
export type Manifest = {
  version: 1;
  complete: boolean;
  startedAt: string;
  finishedAt?: string;
  source: string;
  files: BackupFile[];
  objects: ObjectEntry[];
  buckets: Bucket[];
  error?: string;
};
export type Bucket = {
  id: string;
  name: string;
  public: boolean;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
};
export async function digest(path: string) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(path)) h.update(chunk);
  return h.digest("hex");
}
export async function describe(
  root: string,
  path: string,
): Promise<BackupFile> {
  const full = safeFile(root, path);
  const info = await lstat(full);
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error("Arquivo inválido no backup.");
  return { path, size: info.size, sha256: await digest(full) };
}
export function safeFile(root: string, name: string) {
  if (
    !name ||
    name.includes("\\") ||
    name.split("/").some((p) => !p || p === "." || p === "..") ||
    isAbsolute(name) ||
    name.includes(":")
  )
    throw new Error("Caminho inválido no backup.");
  const full = resolve(root, name);
  if (relative(resolve(root), full).startsWith(".."))
    throw new Error("Arquivo fora do backup.");
  return full;
}
export async function bucketList(client: SupabaseClient): Promise<Bucket[]> {
  const buckets: Bucket[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.listBuckets({
      limit: 100,
      offset,
      sortColumn: "name",
      sortOrder: "asc",
    });
    if (error || !data) throw new Error("Não foi possível listar os buckets.");
    buckets.push(
      ...data.map((b) => ({
        id: b.id,
        name: b.name,
        public: b.public,
        file_size_limit: b.file_size_limit ?? null,
        allowed_mime_types: b.allowed_mime_types ?? null,
      })),
    );
    if (data.length < 100) break;
  }
  if (new Set(buckets.map((b) => b.id)).size !== buckets.length)
    throw new Error("Lista de buckets mudou durante a leitura.");
  return buckets.sort((a, b) => a.id.localeCompare(b.id));
}

export async function inventory(client: SupabaseClient, bucket: string) {
  const folders = [""],
    seen = new Set<string>(),
    result: { name: string; updatedAt: string | null; contentType: string }[] =
      [];
  while (folders.length) {
    const prefix = folders.pop()!;
    if (seen.has(prefix)) throw new Error("Pasta repetida no Storage.");
    seen.add(prefix);
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error || !data)
        throw new Error("Falha ao listar arquivos do Storage.");
      for (const o of data) {
        if (!o.name || o.name.includes("/") || [".", ".."].includes(o.name))
          throw new Error("Nome inesperado no Storage.");
        const name = prefix ? prefix + "/" + o.name : o.name;
        if (o.id === null) {
          folders.push(name);
        } else {
          result.push({
            name,
            updatedAt: o.updated_at ?? null,
            contentType: o.metadata?.mimetype ?? "application/octet-stream",
          });
        }
      }
      if (data.length < 100) break;
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
export async function backupStorage(
  client: SupabaseClient,
  root: string,
  manifest: Manifest,
  progress: () => Promise<void>,
) {
  const buckets = await bucketList(client);
  manifest.buckets = buckets;
  for (const bucket of buckets) {
    const before = await inventory(client, bucket.id);
    for (const object of before) {
      const key = createHash("sha256")
          .update(bucket.id + "\0" + object.name)
          .digest("hex"),
        path = "objects/" + key.slice(0, 2) + "/" + key + ".bin";
      const file = safeFile(root, path);
      await mkdir(resolve(file, ".."), { recursive: true });
      const { data, error } = await client.storage
        .from(bucket.id)
        .download(object.name);
      if (error || !data)
        throw new Error("Falha ao baixar um arquivo do Storage.");
      await writeFile(file, Buffer.from(await data.arrayBuffer()), {
        flag: "wx",
        mode: 0o600,
      });
      manifest.objects.push({
        ...(await describe(root, path)),
        bucket: bucket.id,
        name: object.name,
        contentType: object.contentType,
        updatedAt: object.updatedAt,
      });
      await progress();
    }
    const after = await inventory(client, bucket.id);
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error(
        "O Storage mudou durante o backup. Faça uma nova cópia em período sem alterações.",
      );
  }
  if (JSON.stringify(buckets) !== JSON.stringify(await bucketList(client)))
    throw new Error("Os buckets mudaram durante o backup.");
}
export async function verifyBackup(root: string) {
  const manifest = JSON.parse(
    await readFile(join(root, "manifest.json"), "utf8"),
  ) as Manifest;
  if (
    manifest.version !== 1 ||
    !manifest.complete ||
    !Array.isArray(manifest.files) ||
    !Array.isArray(manifest.objects) ||
    !Array.isArray(manifest.buckets)
  )
    throw new Error("Backup incompleto ou formato inválido.");
  const seen = new Set<string>();
  for (const expected of [...manifest.files, ...manifest.objects]) {
    if (seen.has(expected.path))
      throw new Error("Arquivo duplicado no manifesto.");
    seen.add(expected.path);
    const real = await describe(root, expected.path);
    if (real.size !== expected.size || real.sha256 !== expected.sha256)
      throw new Error("A integridade de um arquivo não confere.");
  }
  for (const name of [
    "roles.sql",
    "schema.sql",
    "data.sql",
    "managed-schema-reference.sql",
  ])
    if (!seen.has(name)) throw new Error("Exportação do banco incompleta.");
  const objects = new Set<string>();
  for (const o of manifest.objects) {
    if (
      !manifest.buckets.some((b) => b.id === o.bucket) ||
      !o.name ||
      o.name.includes("\0")
    )
      throw new Error("Objeto inválido no manifesto.");
    const key = o.bucket + "\0" + o.name;
    if (objects.has(key)) throw new Error("Objeto duplicado.");
    objects.add(key);
  }
  return manifest;
}
