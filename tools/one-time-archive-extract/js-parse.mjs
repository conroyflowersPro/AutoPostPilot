/**
 * Safe X Archive JS parse — never eval()
 */
export function parseArchiveJs(raw) {
  let s = String(raw).trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const eq = s.indexOf("=");
  if (eq >= 0 && /window\.YTD\./i.test(s.slice(0, Math.min(eq, 200)))) {
    s = s.slice(eq + 1).trim();
  }
  if (s.endsWith(";")) s = s.slice(0, -1).trim();
  const data = JSON.parse(s);
  if (!Array.isArray(data)) throw new Error("Archive JS root is not an array");
  return data;
}
