export function ymdUtc(isoOrDate) {
  const raw = String(isoOrDate || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw.slice(0, 10);
  return new Date(parsed).toISOString().slice(0, 10);
}

export function dateInInclusiveWindow(date, from, to) {
  const d = ymdUtc(date);
  return Boolean(d && from && to && d >= from && d <= to);
}

export function eachInclusiveDate(from, to) {
  const start = ymdUtc(from);
  const end = ymdUtc(to);
  if (!start || !end || start > end) return [];
  const out = [];
  const cur = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cur.getTime() <= last.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function isAnalyticsOriginal(post) {
  const features = post?.features;
  if (features?.isReply === true) return false;
  if (features?.is_original === false) return false;
  return true;
}

export function countOriginalsByDate(posts) {
  const bag = {};
  for (const post of posts || []) {
    if (!isAnalyticsOriginal(post)) continue;
    const day = ymdUtc(String(post.published_at || ""));
    if (!day) continue;
    bag[day] = (bag[day] || 0) + 1;
  }
  return bag;
}

export function coverageFromWindow(raw) {
  const from = ymdUtc(String(raw?.window?.from || ""));
  const to = ymdUtc(String(raw?.window?.to || ""));
  const posts = Array.isArray(raw?.posts) ? raw.posts : [];
  const originalsByDate = countOriginalsByDate(posts);
  const counted = Object.values(originalsByDate).reduce((a, b) => a + b, 0);
  return {
    from,
    to,
    imported_at: ymdUtc(String(raw?.imported_at || "")),
    originals: Number(raw?.volume?.originals) || counted,
    originalsByDate,
  };
}

export function formatKoRange(from, to) {
  const a = ymdUtc(from);
  const b = ymdUtc(to);
  if (!a || !b) return "없음";
  const ko = (d) => {
    const parts = d.split("-");
    return `${Number(parts[1])}월 ${Number(parts[2])}일`;
  };
  return `${ko(a)}–${ko(b)}`;
}
