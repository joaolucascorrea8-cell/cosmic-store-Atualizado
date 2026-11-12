import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

test("falha TLS antes do greeting SMTP é tratada sem rejeição órfã ou envio real", async () => {
  class Socket extends EventEmitter {
    ended = false;
    setTimeout() { return this; }
    end() { this.ended = true; }
    destroy() { this.ended = true; }
  }
  const socket = new Socket();
  const dependencies: Record<string, unknown> = {
    "server-only": {}, "node:events": { once },
    "node:tls": { default: { connect: () => { queueMicrotask(() => socket.emit("error", new Error("TLS simulado indisponível"))); return socket; } } },
  };
  const source = ts.transpileModule(readFileSync("lib/gmail.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  const factory = new Script(`(function(require,module,exports,process,Buffer){${source}\n})`).runInThisContext() as (...args: unknown[]) => void;
  factory((name: string) => { assert.ok(name in dependencies); return dependencies[name]; }, loaded, loaded.exports,
    { env: { GMAIL_USER: "teste@example.invalid", GMAIL_APP_PASSWORD: "somente-teste" } }, Buffer);
  const { sendGmailEmail } = loaded.exports as { sendGmailEmail: (message: { to: string; subject: string; html: string }) => Promise<void> };
  await assert.rejects(sendGmailEmail({ to: "cliente@example.invalid", subject: "Teste", html: "Teste" }), /TLS simulado/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(socket.ended, true);
});
