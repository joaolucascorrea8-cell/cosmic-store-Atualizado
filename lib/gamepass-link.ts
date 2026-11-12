export function gamePassLink(value: unknown) {
  if (typeof value !== "string" || value.length > 500 || /[\r\n\t]/.test(value)) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["roblox.com", "www.roblox.com", "web.roblox.com", "m.roblox.com"].includes(url.hostname)
      || url.username || url.password || url.port) return null;
    const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?game-pass\/([1-9][0-9]{0,19})(?:\/[^\s]*)?$/i);
    return match ? { id: match[1], url: `https://www.roblox.com/game-pass/${match[1]}` } : null;
  } catch { return null; }
}
