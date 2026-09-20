import "server-only";

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function normalize(value: string, max: number) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, max);
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function createPixPayload(amount: number, orderCode: string) {
  const pixKey = process.env.PIX_KEY?.trim();
  const receiver = process.env.PIX_RECEIVER_NAME?.trim();
  const city = process.env.PIX_RECEIVER_CITY?.trim();
  if (!pixKey || !receiver || !city) throw new Error("Configuração Pix ausente no servidor.");

  const merchantAccount = field("00", "BR.GOV.BCB.PIX") + field("01", pixKey);
  const txid = normalize(orderCode, 25).replace(/ /g, "") || "COSMIC";
  const withoutCrc = [
    field("00", "01"),
    field("26", merchantAccount),
    field("52", "0000"),
    field("53", "986"),
    field("54", amount.toFixed(2)),
    field("58", "BR"),
    field("59", normalize(receiver, 25)),
    field("60", normalize(city, 15)),
    field("62", field("05", txid)),
    "6304",
  ].join("");
  return withoutCrc + crc16(withoutCrc);
}

