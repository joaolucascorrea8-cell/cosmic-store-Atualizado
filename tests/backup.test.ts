import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  backupStorage,
  verifyBackup,
  describe,
  safeFile,
  type Manifest,
} from "../scripts/backup-core";
const bucket = {
  id: "private",
  name: "private",
  public: false,
  file_size_limit: null,
  allowed_mime_types: null,
};
function mock(fail = false) {
  const records = Array.from({ length: 105 }, (_, i) => ({
    id: String(i),
    name: `foto-${String(i).padStart(3, "0")}.png`,
    updated_at: "2026-10-04T00:00:00Z",
    metadata: { mimetype: "image/png" },
  }));
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    client: {
      storage: {
        listBuckets: async () => ({ data: [bucket], error: null }),
        from: () => ({
          list: async (
            prefix: string,
            { offset, limit }: { offset: number; limit: number },
          ) => {
            calls++;
            return {
              data: prefix
                ? [
                    {
                      id: "nested",
                      name: "á imagem?.png",
                      metadata: { mimetype: "image/png" },
                      updated_at: "2026-10-04T00:00:00Z",
                    },
                  ]
                : [{ id: null, name: "pasta" }, ...records].slice(
                    offset,
                    offset + limit,
                  ),
              error: null,
            };
          },
          download: async () =>
            fail
              ? { data: null, error: { message: "Fail" } }
              : { data: new Blob(["sample"]), error: null },
        }),
      },
    } as unknown as SupabaseClient,
  };
}
function manifest(): Manifest {
  return {
    version: 1,
    complete: false,
    startedAt: new Date().toISOString(),
    source: "https://teste.supabase.co",
    files: [],
    objects: [],
    buckets: [],
  };
}
test("backup percorre páginas e pastas privadas, preserva nomes e verifica todos os bytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cosmic-backup-"));
  try {
    const m = manifest(),
      api = mock();
    await backupStorage(api.client, dir, m, async () => {});
    assert.equal(m.objects.length, 106);
    assert(api.calls >= 6);
    assert(m.objects.some((o) => o.name === "pasta/á imagem?.png"));
    assert(
      m.objects.every((o) =>
        /^objects\/[a-f0-9]{2}\/[a-f0-9]{64}\.bin$/.test(o.path),
      ),
    );
    for (const file of [
      "roles.sql",
      "schema.sql",
      "data.sql",
      "managed-schema-reference.sql",
    ]) {
      await writeFile(join(dir, file), "SQL de teste");
      m.files.push(await describe(dir, file));
    }
    m.complete = true;
    await writeFile(join(dir, "manifest.json"), JSON.stringify(m));
    assert.equal((await verifyBackup(dir)).objects.length, 106);
    await writeFile(join(dir, m.objects[0].path), "corrompido");
    await assert.rejects(() => verifyBackup(dir), /integridade/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("backup falha em download incompleto e rejeita caminhos fora da pasta", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cosmic-backup-"));
  try {
    const m = manifest();
    await assert.rejects(
      () => backupStorage(mock(true).client, dir, m, async () => {}),
      /baixar/,
    );
    await writeFile(join(dir, "manifest.json"), JSON.stringify(m));
    await assert.rejects(() => verifyBackup(dir), /incompleto/);
    for (const path of [
      "../secret",
      "/tmp/secret",
      "a/../../secret",
      "C:\\secret",
      "a/../secret",
    ])
      assert.throws(() => safeFile(dir, path));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
