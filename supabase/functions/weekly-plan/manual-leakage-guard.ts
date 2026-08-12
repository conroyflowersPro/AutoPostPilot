/**
 * ORDER 0B — Manual Post Leakage Guard
 * Blocks narrative/wording/semantic reuse of recent handmade posts as new seeds.
 * Does NOT block Creator/Performance abstract learning.
 */

import type { SourceRole } from "./source-roles.ts";
import { isSeedEligibleRole } from "./source-roles.ts";

export type RecentManualPost = {
  text: string;
  source_id?: string;
  post_type?: string;
  published_at?: string;
};

export type SemanticUnits = {
  central_event?: string;
  central_observation?: string;
  central_claim?: string;
  personal_experience?: string;
  main_tension?: string;
  conclusion?: string;
  joke_premise?: string;
  reasoning_angle?: string;
  reader_takeaway?: string;
};

export type LeakageGuardResult = {
  allow_as_seed: boolean;
  reason:
    | "PASS"
    | "ROLE_NOT_SEED_ELIGIBLE"
    | "SURFACE_WORDING"
    | "SEMANTIC_HIGH"
    | "EXPERIENCE_NARRATIVE_COPY"
    | "REPLY_AUTO_PROMOTE";
  semantic_recent_post_overlap: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  manual_text_exposed: boolean;
  matched_source_id?: string;
};

const STOP = new Set(
  "이 그 저 것 수 등 및 또 더 좀 잘 안 못 은 는 이 가 을 를 에 의 로 와 과 도 만 부터 까지 the a an of to in on for and or is are was were be been".split(
    /\s+/
  )
);

function tokens(s: string): Set<string> {
  return new Set(
    String(s || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOP.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Extract coarse semantic units without storing full narrative as seed text */
export function extractSemanticUnits(text: string): SemanticUnits {
  const body = String(text || "").trim();
  if (body.length < 12) return {};
  const sentences = body
    .split(/[.!?。\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  const first = sentences[0]?.slice(0, 80);
  const last = sentences.length > 1 ? sentences[sentences.length - 1]?.slice(0, 80) : undefined;
  const exp = /(직접|해봤|타\s*보|충전했|운전했|직관|체감|경험)/i.test(body);
  const claim = /(생각|보임|결국|그래서|오히려|문제|장점|단점)/i.test(body);
  return {
    central_event: first,
    central_observation: first,
    central_claim: claim ? last || first : undefined,
    personal_experience: exp ? first : undefined,
    conclusion: last,
    reasoning_angle: first,
    reader_takeaway: last,
  };
}

function unitOverlap(a: SemanticUnits, b: SemanticUnits): number {
  const keys: (keyof SemanticUnits)[] = [
    "central_event",
    "central_observation",
    "central_claim",
    "personal_experience",
    "conclusion",
    "reasoning_angle",
    "reader_takeaway",
  ];
  let hits = 0;
  let compared = 0;
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (!av || !bv) continue;
    compared += 1;
    const score = jaccard(tokens(av), tokens(bv));
    if (score >= 0.45) hits += 1;
  }
  if (!compared) return 0;
  return hits / compared;
}

/** Shared event/claim phrase clusters (not example mapping — structural keywords) */
function eventClaimClusterScore(a: string, b: string): number {
  const clusters: RegExp[][] = [
    [/합류|merge/i, /감시|감독|부하|supervision/i, /핸들|개입|잡/i],
    [/충전|슈퍼차저|supercharger/i, /대기|속도|세션/i],
    [/직관|bmo|경기/i, /동선|현장|입장/i],
    [/fsd/i, /신뢰|아직|완전/i, /고속도로|끼어/i],
  ];
  let best = 0;
  for (const group of clusters) {
    const ha = group.filter((re) => re.test(a)).length;
    const hb = group.filter((re) => re.test(b)).length;
    if (ha >= 2 && hb >= 2) {
      const score = Math.min(ha, hb) / group.length;
      if (score > best) best = score;
    }
  }
  return best;
}

export function scoreSemanticOverlap(
  candidateText: string,
  recent: RecentManualPost[]
): { level: "NONE" | "LOW" | "MEDIUM" | "HIGH"; matched_source_id?: string; score: number } {
  const candUnits = extractSemanticUnits(candidateText);
  const candTok = tokens(candidateText);
  let best = 0;
  let matched: string | undefined;
  for (const r of recent) {
    const ru = extractSemanticUnits(r.text);
    const u = unitOverlap(candUnits, ru);
    const t = jaccard(candTok, tokens(r.text));
    const c = eventClaimClusterScore(candidateText, r.text);
    const score = Math.max(u, t * 0.85, c);
    if (score > best) {
      best = score;
      matched = r.source_id;
    }
  }
  if (best >= 0.55) return { level: "HIGH", matched_source_id: matched, score: best };
  if (best >= 0.35) return { level: "MEDIUM", matched_source_id: matched, score: best };
  if (best >= 0.18) return { level: "LOW", matched_source_id: matched, score: best };
  return { level: "NONE", score: best };
}

/** True if candidate subject/hooks look like surface copy of a manual post */
export function hasSurfaceWordingLeak(
  candidateSubject: string,
  recent: RecentManualPost[]
): { leak: boolean; matched_source_id?: string } {
  const sub = String(candidateSubject || "").trim();
  if (sub.length < 16) return { leak: false };
  for (const r of recent) {
    const body = String(r.text || "").replace(/\s+/g, " ").trim();
    if (body.length < 16) continue;
    if (body.includes(sub.slice(0, Math.min(40, sub.length))) && sub.length >= 24) {
      return { leak: true, matched_source_id: r.source_id };
    }
    if (sub.includes(body.slice(0, Math.min(40, body.length))) && body.length >= 24) {
      return { leak: true, matched_source_id: r.source_id };
    }
    const score = jaccard(tokens(sub), tokens(body.slice(0, 120)));
    if (score >= 0.6) return { leak: true, matched_source_id: r.source_id };
  }
  return { leak: false };
}

export function guardCandidateAgainstManualLeakage(opts: {
  source_role: SourceRole;
  concrete_subject: string;
  point_or_tension?: string;
  post_type_of_source?: string;
  recent_manual: RecentManualPost[];
  user_explicit?: boolean;
}): LeakageGuardResult {
  if (opts.user_explicit || opts.source_role === "USER_EXPLICIT_SEED") {
    return {
      allow_as_seed: true,
      reason: "PASS",
      semantic_recent_post_overlap: "NONE",
      manual_text_exposed: false,
    };
  }

  if (!isSeedEligibleRole(opts.source_role)) {
    return {
      allow_as_seed: false,
      reason: "ROLE_NOT_SEED_ELIGIBLE",
      semantic_recent_post_overlap: "NONE",
      manual_text_exposed: false,
    };
  }

  const pt = String(opts.post_type_of_source || "").toUpperCase();
  if (pt === "REPLY") {
    return {
      allow_as_seed: false,
      reason: "REPLY_AUTO_PROMOTE",
      semantic_recent_post_overlap: "NONE",
      manual_text_exposed: false,
    };
  }

  const text = `${opts.concrete_subject || ""} ${opts.point_or_tension || ""}`.trim();
  const surface = hasSurfaceWordingLeak(opts.concrete_subject, opts.recent_manual);
  if (surface.leak) {
    return {
      allow_as_seed: false,
      reason: "SURFACE_WORDING",
      semantic_recent_post_overlap: "HIGH",
      manual_text_exposed: true,
      matched_source_id: surface.matched_source_id,
    };
  }

  const sem = scoreSemanticOverlap(text, opts.recent_manual);
  if (sem.level === "HIGH") {
    return {
      allow_as_seed: false,
      reason: "SEMANTIC_HIGH",
      semantic_recent_post_overlap: "HIGH",
      manual_text_exposed: false,
      matched_source_id: sem.matched_source_id,
    };
  }

  return {
    allow_as_seed: true,
    reason: "PASS",
    semantic_recent_post_overlap: sem.level,
    manual_text_exposed: false,
    matched_source_id: sem.matched_source_id,
  };
}

/**
 * Abstract factual grounding only — never narrative seed subject from body.
 */
export function factualGroundingFromManual(text: string): {
  entities: string[];
  locations: string[];
  fact_labels: string[];
} {
  const body = String(text || "");
  const entities: string[] = [];
  const locations: string[] = [];
  if (/\bfsd\b|오토파일럿/i.test(body)) entities.push("FSD");
  if (/cybertruck|사이버/i.test(body)) entities.push("CYBERTRUCK");
  if (/robotaxi|로보/i.test(body)) entities.push("ROBOTAXI");
  if (/\blafc\b/i.test(body)) entities.push("LAFC");
  if (/\bbmo\b|비모/i.test(body)) locations.push("BMO");
  if (/슈퍼차저|supercharger/i.test(body)) locations.push("SUPERCHARGER");
  const fact_labels: string[] = [];
  if (/충전/.test(body)) fact_labels.push("charging_session_occurred");
  if (/직관|경기/.test(body)) fact_labels.push("matchday_attendance");
  if (/운전|주행|합류/.test(body)) fact_labels.push("drive_session_occurred");
  return { entities, locations, fact_labels };
}
