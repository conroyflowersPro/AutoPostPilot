/**
 * 30-day X Analytics coverage for the queue month calendar.
 * Overlap with sync counts is allowed; Analytics is a separate layer.
 */

export type AnalyticsPostLike = {
  published_at?: string | null;
  features?: { isReply?: boolean; is_original?: boolean } | null;
};

export type AnalyticsWindowLike = {
  window?: { from?: string; to?: string };
  imported_at?: string;
  volume?: { originals?: number };
  posts?: AnalyticsPostLike[];
};

export type AnalyticsCalendarCoverage = {
  from: string;
  to: string;
  imported_at: string;
  originals: number;
  originalsByDate: Record<string, number>;
};

export function ymdUtc(isoOrDate: string): string {
  const raw = String(isoOrDate || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw.slice(0, 10);
  return new Date(parsed).toISOString().slice(0, 10);
}

export function dateInInclusiveWindow(date: string, from: string, to: string): boolean {
  const d = ymdUtc(date);
  return Boolean(d && from && to && d >= from && d <= to);
}

export function eachInclusiveDate(from: string, to: string): string[] {
  const start = ymdUtc(from);
  const end = ymdUtc(to);
  if (!start || !end || start > end) return [];
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cur.getTime() <= last.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function isAnalyticsOriginal(post: AnalyticsPostLike): boolean {
  const features = post?.features;
  if (features?.isReply === true) return false;
  if (features?.is_original === false) return false;
  return true;
}

export function countOriginalsByDate(posts: AnalyticsPostLike[]): Record<string, number> {
  const bag: Record<string, number> = {};
  for (const post of posts || []) {
    if (!isAnalyticsOriginal(post)) continue;
    const day = ymdUtc(String(post.published_at || ""));
    if (!day) continue;
    bag[day] = (bag[day] || 0) + 1;
  }
  return bag;
}

export function coverageFromWindow(raw: AnalyticsWindowLike): AnalyticsCalendarCoverage {
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

export function formatKoRange(from: string, to: string): string {
  const a = ymdUtc(from);
  const b = ymdUtc(to);
  if (!a || !b) return "없음";
  const ko = (d: string) => {
    const [, m, day] = d.split("-");
    return `${Number(m)}월 ${Number(day)}일`;
  };
  return `${ko(a)}–${ko(b)}`;
}
