export type GameServer = {
  id: string;
  game_name: string;
  name: string;
  join_url: string;
  description: string;
  image_url: string | null;
  is_active: boolean;
  availability?: "available" | "maintenance" | "unavailable";
  display_order: number;
  updated_at: string;
};

// Preserve invitation tokens: only the protocol/host are normalized by URL.
export function serverJoinUrl(value: string): string | null {
  if (value.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname.includes(".") &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function serverRequestFields(game: string, message: string) {
  const gameName = game.trim();
  const details = message.trim();
  if (
    gameName.length < 2 ||
    gameName.length > 100 ||
    /[\r\n\u0000]/.test(gameName)
  )
    return {
      error: "Informe o nome do jogo, com 2 a 100 caracteres.",
    } as const;
  if (details.length < 5 || details.length > 1200)
    return { error: "Explique seu pedido, com 5 a 1.200 caracteres." } as const;
  return { gameName, message: details, error: null } as const;
}

export const serverAvailability = {
  available: "Disponível",
  maintenance: "Em manutenção",
  unavailable: "Temporariamente indisponível",
};
