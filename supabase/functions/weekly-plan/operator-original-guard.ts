/**
 * Operator originals are grounding facts, never a post to rewrite.
 * Reject any seed subject that equals or nearly copies a recent handmade opening.
 */
import { BUNDLED_X_ANALYTICS_WINDOW } from "./x-analytics-30d-bundled.ts";

const STOP = new Set(
  "이 그 저 것 수 등 및 또 더 좀 잘 안 못 은 는 이 가 을 를 에 의 로 와 과 도 만 부터 까지 the a an of to in on for and or is are was were be been that with".split(
    /\s+/,
  ),
);

export function stripPostBody(text: string): string {
  return String(text || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/@\w+/g, "")
    .replace(/#\w+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function originalOpening(text: string): string {
  const stripped = stripPostBody(text);
  if (!stripped) return "";
  const clause = stripped
    .split(/(?<=[.!?…다요함음죠네])\s+|\n+/)[0]
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();
  return (clause.length >= 8 ? clause : stripped).slice(0, 80);
}

function tokens(s: string): Set<string> {
  return new Set(
    String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function hangulChunks(s: string): string[] {
  const out: string[] = [];
  const hangul = String(s || "").match(/[가-힣]{2,}/g) || [];
  for (const w of hangul) {
    if (w.length >= 2 && w.length <= 12) out.push(w);
    for (let i = 0; i <= w.length - 3; i++) out.push(w.slice(i, i + 3));
  }
  return out;
}

/** True when subject equals or nearly copies an operator original opening/body. */
export function nearlyCopiesOpening(subject: string, original: string): boolean {
  const sub = stripPostBody(subject);
  const body = stripPostBody(original);
  const open = originalOpening(original);
  if (sub.length < 4 || body.length < 8) return false;
  const subL = sub.toLowerCase();
  const bodyL = body.toLowerCase();
  const openL = open.toLowerCase();
  if (bodyL.includes(subL) && sub.length >= 8) return true;
  if (subL.includes(bodyL.slice(0, Math.min(24, bodyL.length))) && body.length >= 16) return true;
  if (open.length >= 10) {
    const head = openL.slice(0, Math.min(20, openL.length));
    if (head.length >= 8 && subL.includes(head)) return true;
    if (sub.length >= 10 && openL.includes(subL.slice(0, Math.min(20, subL.length)))) return true;
  }
  if (jaccard(tokens(sub), tokens(open || body.slice(0, 120))) >= 0.5) return true;
  const chunks = hangulChunks(open);
  let hits = 0;
  for (const c of chunks) {
    if (c.length >= 3 && sub.includes(c)) hits += 1;
  }
  return hits >= 2 && chunks.length > 0;
}

export function subjectCopiesOperatorOriginal(subject: string, originals: string[]): boolean {
  const sub = stripPostBody(subject);
  if (sub.length < 4) return false;
  for (const orig of originals || []) {
    if (nearlyCopiesOpening(sub, orig)) return true;
  }
  return false;
}

type AnalyticsPost = {
  content?: string;
  features?: { is_original?: boolean; isReply?: boolean };
};

export function bundledOperatorOriginals(): string[] {
  const raw = (BUNDLED_X_ANALYTICS_WINDOW as { posts?: AnalyticsPost[] }).posts;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of raw) {
    if (p?.features?.is_original === false || p?.features?.isReply === true) continue;
    const body = stripPostBody(String(p.content || ""));
    if (body.length < 12) continue;
    const key = body.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(body);
  }
  return out;
}

export function bundledOperatorOpenings(): string[] {
  return bundledOperatorOriginals().map(originalOpening).filter((s) => s.length >= 8);
}

export function mergeOperatorOriginals(extra: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...bundledOperatorOriginals(), ...extra]) {
    const body = stripPostBody(t);
    if (body.length < 12) continue;
    const key = body.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(body);
  }
  return out;
}
