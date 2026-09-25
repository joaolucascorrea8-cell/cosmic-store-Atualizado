import "server-only";

import { once } from "node:events";
import tls from "node:tls";

export type GmailAttachment = {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
};

type SmtpResponse = { code: number; raw: string };

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function sanitizeAddress(value: string) {
  return value.replace(/[\r\n<>]/g, "").trim();
}

function sanitizeFilename(value: string) {
  const cleaned = value.replace(/[\r\n"\\]/g, "_").trim();
  return cleaned || "anexo";
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function buildMessage({
  from,
  fromName,
  to,
  subject,
  html,
  attachment,
}: {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  attachment?: GmailAttachment;
}) {
  const messageId = `<${crypto.randomUUID()}@cosmic-store.local>`;
  const commonHeaders = [
    `From: ${encodeHeader(fromName)} <${sanitizeAddress(from)}>`,
    `To: <${sanitizeAddress(to)}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
  ];

  if (!attachment) {
    return [
      ...commonHeaders,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(Buffer.from(html, "utf8").toString("base64")),
    ].join("\r\n");
  }

  const boundary = `cosmic_${crypto.randomUUID().replaceAll("-", "")}`;
  const filename = sanitizeFilename(attachment.filename);
  return [
    ...commonHeaders,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(html, "utf8").toString("base64")),
    "",
    `--${boundary}`,
    `Content-Type: ${attachment.contentType}; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${filename}"`,
    "",
    wrapBase64(Buffer.from(attachment.bytes).toString("base64")),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function waitForResponse(socket: tls.TLSSocket, timeoutMs = 20_000): Promise<SmtpResponse> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => finish(new Error("Tempo esgotado aguardando resposta do Gmail SMTP.")), timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return;
      const last = lines[lines.length - 1];
      const match = last.match(/^(\d{3})\s/);
      if (!match) return;
      finish(null, { code: Number(match[1]), raw: buffer });
    };
    const onError = (error: Error) => finish(error);
    const onClose = () => finish(new Error("A conexão SMTP foi encerrada antes da resposta."));

    function cleanup() {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    }

    function finish(error: Error | null, response?: SmtpResponse) {
      cleanup();
      if (error) reject(error);
      else resolve(response!);
    }

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function command(socket: tls.TLSSocket, value: string, expected: number | number[]) {
  const responsePromise = waitForResponse(socket);
  socket.write(`${value}\r\n`);
  const response = await responsePromise;
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(response.code)) {
    throw new Error(`Gmail SMTP recusou o comando (${response.code}): ${response.raw.slice(0, 500)}`);
  }
  return response;
}

export async function sendGmailEmail({
  to,
  subject,
  html,
  attachment,
}: {
  to: string;
  subject: string;
  html: string;
  attachment?: GmailAttachment;
}) {
  const user = process.env.GMAIL_USER?.trim();
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const fromName = process.env.GMAIL_FROM_NAME?.trim() || "Cosmic Store";

  if (!user) throw new Error("GMAIL_USER não configurado.");
  if (!appPassword) throw new Error("GMAIL_APP_PASSWORD não configurado.");
  if (!to?.trim()) throw new Error("Destinatário do e-mail não encontrado.");

  const socket = tls.connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
    rejectUnauthorized: true,
  });
  socket.setTimeout(25_000, () => socket.destroy(new Error("Tempo esgotado na conexão SMTP.")));

  try {
    const greetingPromise = waitForResponse(socket);
    await once(socket, "secureConnect");
    const greeting = await greetingPromise;
    if (greeting.code !== 220) throw new Error(`Gmail SMTP não iniciou corretamente: ${greeting.raw.slice(0, 500)}`);

    await command(socket, "EHLO cosmic-store", 250);
    await command(socket, "AUTH LOGIN", 334);
    await command(socket, Buffer.from(user, "utf8").toString("base64"), 334);
    await command(socket, Buffer.from(appPassword, "utf8").toString("base64"), 235);
    await command(socket, `MAIL FROM:<${sanitizeAddress(user)}>`, 250);
    await command(socket, `RCPT TO:<${sanitizeAddress(to)}>`, [250, 251]);
    await command(socket, "DATA", 354);

    const message = buildMessage({ from: user, fromName, to, subject, html, attachment });
    const dotStuffed = message.replace(/(^|\r\n)\./g, "$1..");
    const resultPromise = waitForResponse(socket, 30_000);
    socket.write(`${dotStuffed}\r\n.\r\n`);
    const result = await resultPromise;
    if (result.code !== 250) {
      throw new Error(`Gmail SMTP recusou o e-mail (${result.code}): ${result.raw.slice(0, 500)}`);
    }

    try {
      await command(socket, "QUIT", 221);
    } catch {
      // O e-mail já foi aceito; falha ao encerrar a sessão não invalida o envio.
    }
  } finally {
    socket.end();
    socket.destroy();
  }
}
