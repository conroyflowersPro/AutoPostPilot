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

const GENERIC_SCENE = new Set(
  "보행자 급제동 충전 주차 슈퍼차저 테슬라 주행 판단 장면 일상 교차로 알림 화면 직관 경기 창작 수익 결제 하늘 현장".split(
    /\s+/,
  ),
);

/** True when subject equals or nearly copies an operator original opening/body. */
export function nearlyCopiesOpening(subject: string, original: string): boolean {
  const sub = stripPostBody(subject);
  const body = stripPostBody(original);
  const open = originalOpening(original);
  if (sub.length < 6 || body.length < 8) return false;
  const subL = sub.toLowerCase();
  const bodyL = body.toLowerCase();
  const openL = open.toLowerCase();
  if (bodyL.includes(subL) && sub.length >= 10) return true;
  if (subL.includes(bodyL) && body.length >= 10) return true;
  if (open.length >= 12) {
    const head = openL.slice(0, Math.min(16, openL.length));
    if (head.length >= 10 && subL.includes(head)) return true;
    if (sub.length >= 12 && openL.includes(subL.slice(0, 16))) return true;
  }
  if (jaccard(tokens(sub), tokens(open)) >= 0.62) return true;
  const phrases = (open.match(/[가-힣]{7,}/g) || []).filter((w) => !GENERIC_SCENE.has(w));
  if (phrases.some((p) => sub.includes(p))) return true;
  const latin = open.match(/[A-Za-z][A-Za-z0-9]{3,}/g) || [];
  if (latin.some((w) => w.length >= 8 && subL.includes(w.toLowerCase()))) return true;
  if (/써니\s*핀/.test(open) && /써니\s*핀/.test(sub)) return true;
  if (/유성들/.test(open) && /유성들/.test(sub)) return true;
  if (/퍼와서/.test(open) && /퍼와서/.test(sub)) return true;
  if (/spacex\s*로켓/i.test(open) && /spacex\s*로켓/i.test(sub)) return true;
  if (/language detection/i.test(open) && /language detection/i.test(sub)) return true;
  return false;
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
