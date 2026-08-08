/**
 * Missing ≠ 0 helpers. Never coerce absent JSON keys to zero.
 */

import type { MetricBag, MetricPresence, MetricValue } from "./types";

const PUBLIC_KEYS = [
  "impression_count",
  "like_count",
  "reply_count",
  "retweet_count",
  "quote_count",
  "bookmark_count",
] as const;

const ORGANIC_KEYS = [
  "impression_count",
  "like_count",
  "reply_count",
  "retweet_count",
  "quote_count",
  "user_profile_clicks",
  "url_link_clicks",
] as const;

const NON_PUBLIC_KEYS = [
  "impression_count",
  "user_profile_clicks",
  "url_link_clicks",
  "detail_expands",
  "engagements",
] as const;

export const KNOWN_PUBLIC_KEYS = PUBLIC_KEYS;
export const KNOWN_ORGANIC_KEYS = ORGANIC_KEYS;
export const KNOWN_NON_PUBLIC_KEYS = NON_PUBLIC_KEYS;

/**
 * Convert raw API/jsonb metric object into MetricBag.
 * Absent key → MISSING. Present 0 → PRESENT_ZERO. Present >0 → PRESENT_NON_ZERO.
 */
export function normalizeMetricObject(
  raw: Record<string, unknown> | null | undefined,
  knownKeys: readonly string[]
): MetricBag {
  const out: MetricBag = {};
  if (!raw || typeof raw !== "object") {
    for (const k of knownKeys) {
      out[k] = { presence: "MISSING", value: null };
    }
    return out;
  }
  for (const k of knownKeys) {
    if (!(k in raw)) {
      out[k] = { presence: "MISSING", value: null };
      continue;
    }
    const v = raw[k];
    if (v === null || v === undefined) {
      out[k] = { presence: "MISSING", value: null };
      continue;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
      out[k] = { presence: "MISSING", value: null };
      continue;
    }
    out[k] = {
      presence: n === 0 ? "PRESENT_ZERO" : "PRESENT_NON_ZERO",
      value: n,
    };
  }
  for (const [k, v] of Object.entries(raw)) {
    if (k in out) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
      out[k] = { presence: "MISSING", value: null };
    } else {
      out[k] = {
        presence: n === 0 ? "PRESENT_ZERO" : "PRESENT_NON_ZERO",
        value: n,
      };
    }
  }
  return out;
}

export function presenceOf(mv: MetricValue | undefined): MetricPresence {
  return mv?.presence ?? "MISSING";
}

export function numericOrNull(mv: MetricValue | undefined): number | null {
  if (!mv || mv.presence === "MISSING") return null;
  return mv.value;
}

export function familyHasAnyPresent(bag: MetricBag): boolean {
  return Object.values(bag).some(
    (m) => m.presence === "PRESENT_ZERO" || m.presence === "PRESENT_NON_ZERO"
  );
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function stdDev(nums: number[], m: number | null): number | null {
  if (nums.length < 2 || m === null) return null;
  const v =
    nums.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (nums.length - 1);
  return Math.sqrt(v);
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  if (mx === null || my === null) return null;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function spearman(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const rank = (arr: number[]) => {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && indexed[j + 1].v === indexed[i].v) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[indexed[k].i] = avg;
      i = j + 1;
    }
    return ranks;
  };
  return pearson(rank(xs.slice(0, n)), rank(ys.slice(0, n)));
}

export function skewness(nums: number[], m: number | null, s: number | null): number | null {
  if (nums.length < 3 || m === null || s === null || s === 0) return null;
  const n = nums.length;
  const third =
    nums.reduce((acc, x) => acc + Math.pow((x - m) / s, 3), 0) / n;
  return third;
}
