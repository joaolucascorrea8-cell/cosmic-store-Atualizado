import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type AccountCredentials = {
  username: string;
  password: string;
  instructions: string;
};

export function validateCredentials(
  value: AccountCredentials,
): AccountCredentials {
  if (
    typeof value.username !== "string" ||
    !value.username.trim() ||
    value.username.trim().length > 100
  )
    throw new Error("Informe o nome de usuário da conta (até 100 caracteres).");
  // Passwords are never trimmed: spaces may be part of the actual password.
  if (
    typeof value.password !== "string" ||
    !value.password.length ||
    value.password.length > 500
  )
    throw new Error("Informe a senha da conta (até 500 caracteres).");
  if (
    typeof value.instructions !== "string" ||
    value.instructions.length > 3000
  )
    throw new Error("As instruções devem ter até 3.000 caracteres.");
  return {
    username: value.username.trim(),
    password: value.password,
    instructions: value.instructions.trim(),
  };
}

function keyBuffer(key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error(
      "Configure ROBUX_ACCOUNT_DELIVERY_KEY com uma chave de 64 caracteres hexadecimais.",
    );
  return Buffer.from(key, "hex");
}

export function encryptCredentials(
  orderId: string,
  value: AccountCredentials,
  key: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuffer(key), iv);
  cipher.setAAD(Buffer.from(`cosmic-account:${orderId}`));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(validateCredentials(value)), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptCredentials(
  orderId: string,
  encrypted: string,
  key: string,
): AccountCredentials {
  const [version, iv, tag, ciphertext, extra] = encrypted.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined)
    throw new Error("Formato de entrega inválido.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBuffer(key),
    Buffer.from(iv, "base64"),
  );
  decipher.setAAD(Buffer.from(`cosmic-account:${orderId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return validateCredentials(
    JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    ),
  );
}
