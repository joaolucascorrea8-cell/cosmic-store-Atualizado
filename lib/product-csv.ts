export const CSV_HEADERS = [
  "nome",
  "jogo",
  "categoria",
  "preco",
  "estoque",
  "ilimitado",
  "descricao",
  "robux",
  "instrucoes",
];
export function parseProductCsv(input: string): Record<string, string>[] {
  if (input.length > 512000) throw new Error("A planilha deve ter até 500 KB.");
  const text = input.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0];
  const separator = first.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed)
        throw new Error("Aspas fora de posição na planilha.");
      quoted = true;
      continue;
    }
    if (c === separator) {
      row.push(field);
      field = "";
      closed = false;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      field = "";
      closed = false;
      continue;
    }
    if (closed) {
      if (c === " " || c === "\t") continue;
      throw new Error("Há texto depois de uma célula entre aspas.");
    }
    field += c;
  }
  if (quoted) throw new Error("Uma célula ficou com aspas abertas.");
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  const headers = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  if (
    new Set(headers).size !== headers.length ||
    headers.some((h) => !CSV_HEADERS.includes(h)) ||
    !["nome", "jogo", "categoria", "preco"].every((h) => headers.includes(h))
  )
    throw new Error(
      "Use o modelo: nome, jogo, categoria e preco são obrigatórios.",
    );
  if (rows.length < 1 || rows.length > 500)
    throw new Error("Importe de 1 a 500 produtos por arquivo.");
  return rows.map((r, index) => {
    if (r.length !== headers.length)
      throw new Error(
        `Registro ${index + 1}: quantidade de colunas diferente do cabeçalho.`,
      );
    return Object.fromEntries(headers.map((h, i) => [h, r[i].trim()]));
  });
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function exportCsv(rows: unknown[][]) {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}
