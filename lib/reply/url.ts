/** Parse X / Twitter status URLs into tweet id */

export function extractStatusId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;

  // Bare numeric id
  if (/^\d{5,25}$/.test(s)) return s;

  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "");
    if (
      host !== "x.com" &&
      host !== "twitter.com" &&
      host !== "mobile.twitter.com" &&
      host !== "mobile.x.com"
    ) {
      return null;
    }
    const m = u.pathname.match(/\/status\/(\d{5,25})/);
    return m ? m[1] : null;
  } catch {
    const m = s.match(/status\/(\d{5,25})/);
    return m ? m[1] : null;
  }
}

export function isLikelyXStatusUrl(input: string): boolean {
  return extractStatusId(input) != null;
}
