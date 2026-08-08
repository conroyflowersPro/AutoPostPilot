/**
 * Safe X Archive JS parse — strip window.YTD.* = prefix, never eval()
 */
export function parseArchiveJsArray(raw: string): unknown[] {
  let s = raw.trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

  const eq = s.indexOf("=");
  if (eq >= 0 && /window\.YTD\./.test(s.slice(0, eq))) {
    s = s.slice(eq + 1).trim();
  }
  if (s.endsWith(";")) s = s.slice(0, -1).trim();

  const data = JSON.parse(s);
  if (!Array.isArray(data)) {
    throw new Error("Archive JS root is not an array");
  }
  return data;
}

export function extractTweetId(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const tweet = (e.tweet || e) as Record<string, unknown>;
  const id = tweet.id_str || tweet.id || e.id_str || e.id;
  return id != null ? String(id) : null;
}
