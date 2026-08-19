/**
 * EXPERIENCE evidence pipeline — Production + ORDER 0B
 * Lived originals may become abstract cite-seeds (related follow-up).
 * Never body.slice as seed subject. Same-content clone is forbidden.
 */
import { LIVED_CITE_HINT, livedExperienceFacts, livedMeaningGist } from "./seed-ownership.ts";

export type ExperienceProvenance =
  | "RECENT_MANUAL_14D"
  | "ARCHIVE_TIMELESS"
  | "ARCHIVE_HISTORICAL";

export type ExperienceClass = "TIMELESS" | "HISTORICAL";

export type ExperienceCandidate = {
  cluster: string;
  dimension: string;
  concrete_subject: string;
  point_or_tension?: string;
  experience_facts?: string[];
  experience_class: ExperienceClass;
  provenance: ExperienceProvenance;
  creator_evidence_available: true;
  experience_required: true;
  historical_framing_required: boolean;
  source_ref?: string;
  published_at?: string;
  idea_angle_hint?: string;
  source_role?: string;
  seed_eligible?: boolean;
  /** Cite the lived episode; never retell the same post. */
  cite_episode_hint?: string;
};

export type ExperienceSupplyReport = {
  recent_candidates: number;
  recent_adopted: number;
  archive_explored: boolean;
  archive_timeless_candidates: number;
  archive_historical_candidates: number;
  archive_fallback_used: number;
  experience_supply_low: number;
  provenance_counts: Record<string, number>;
  historical_framing_required_count: number;
  notes: string[];
};

const EXPERIENCE_SIGNAL =
  /직접|해봤|타\s*보|충전했|직관|갔었|경험|체감|쓰다\s*보|쓰다가|운전했|사용\s*중|내\s*(차|기록|세션)|오늘\s*(충전|주행|직관|게임)|어제|퇴근길|출근길|식겁|야간|보행자|정차|차량에서|드라이브스루|이스터에|와이퍼|꽃집|마님/i;

const HISTORICAL_SIGNAL =
  /fsd\s*v1[0-2]|v10|v11|v12|예전|과거|당시|옛날|예전\s*ui|이전\s*버전|그\s*시절|legacy/i;

const TIMELESS_OWNERSHIP_SIGNAL =
  /소유|오너|장거리|여행|직관|bmo|충전\s*루틴|적재|일상\s*사용|첫\s*사용|로드\s*트립|오가면서/i;

export function isExperientialText(text: string): boolean {
  return (
    EXPERIENCE_SIGNAL.test(text) ||
    TIMELESS_OWNERSHIP_SIGNAL.test(text) ||
    HISTORICAL_SIGNAL.test(text)
  );
}

export function classifyExperienceTime(text: string, published_at?: string): ExperienceClass {
  if (HISTORICAL_SIGNAL.test(text)) return "HISTORICAL";
  if (published_at) {
    const y = new Date(published_at).getFullYear();
    if (y && y <= 2024 && HISTORICAL_SIGNAL.test(text)) return "HISTORICAL";
  }
  return "TIMELESS";
}

export function clusterFromText(text: string): string {
  const t = text.toLowerCase();
  if (/fsd|자율|합류|공사|보행/.test(t)) return "FSD";
  if (/cyber|사이버|충전|적재|슈퍼차저/.test(t)) return "CYBERTRUCK";
  if (/robotaxi|로보|커브|승하차/.test(t)) return "ROBOTAXI";
  if (/lafc|bmo|직관|경기/.test(t)) return "LAFC";
  if (/게임|컨트롤러|한\s*판/.test(t)) return "GAMING";
  if (/\bai\b|그록|grok|프롬프트|초안/.test(t)) return "AI_TECH";
  return "DAILY";
}

const CITE_NOT_CLONE = LIVED_CITE_HINT;

/** Direction only. Never body.slice. Never a frozen example-post subject. */
export function relatedExperienceSubject(body: string, cluster: string, historical: boolean): {
  subject: string;
  cite_episode_hint: string;
} {
  const gist = livedMeaningGist(body, cluster);
  const prefix = historical ? "과거 장면에서의 판단: " : "";
  const subject = gist ? `${prefix}${gist}`.slice(0, 90) : "일상 장면에서의 판단";
  return {
    subject,
    cite_episode_hint: CITE_NOT_CLONE,
  };
}

/** ORDER 0B — Abstract subject only. Manual body must never become concrete_subject. */
export function extractExperienceMaterial(
  text: string,
  meta?: { published_at?: string; post_type?: string; source_ref?: string; user_explicit?: boolean }
): ExperienceCandidate | null {
  const body = String(text || "").trim();
  if (body.length < 12) return null;
  if (!isExperientialText(body)) return null;
  const expClass = classifyExperienceTime(body, meta?.published_at);
  const cluster = clusterFromText(body);
  const historical = expClass === "HISTORICAL";
  const related = relatedExperienceSubject(body, cluster, historical);
  const userExplicit = !!meta?.user_explicit;
  const pt = String(meta?.post_type || "").toUpperCase();
  const isReply = pt.includes("REPLY");
  return {
    cluster,
    dimension: historical ? "HISTORICAL_EXPERIENCE" : "RECENT_EXPERIENCE",
    concrete_subject: related.subject.slice(0, 90),
    experience_facts: livedExperienceFacts(body),
    point_or_tension: historical
      ? "과거 시점 프레임 필수 — 현재 사실처럼 쓰지 말 것; 원문 재게시 금지; 동일 내용 금지"
      : CITE_NOT_CLONE,
    experience_class: expClass,
    provenance: "RECENT_MANUAL_14D",
    creator_evidence_available: true,
    experience_required: true,
    historical_framing_required: historical,
    source_ref: meta?.source_ref || meta?.published_at,
    published_at: meta?.published_at,
    idea_angle_hint: historical ? "THEN_VS_NOW_SAFE" : "CITE_RELATED_NOT_CLONE",
    cite_episode_hint: related.cite_episode_hint,
    source_role: userExplicit ? "USER_EXPLICIT_SEED" : isReply ? "CREATOR_LEARNING_SIGNAL" : "SEED_SOURCE",
    seed_eligible: userExplicit || !isReply,
  };
}

export function buildRecentExperienceCandidates(
  rows: Array<{
    text_body?: string | null;
    post_type?: string | null;
    published_at?: string | null;
    x_post_id?: string | null;
    system_origin_class?: string | null;
  }>,
  now: Date = new Date()
): ExperienceCandidate[] {
  const from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const out: ExperienceCandidate[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const soc = String(row.system_origin_class || "").toUpperCase();
    if (!/USER_DIRECT|MANUAL|HANDMADE|CREATOR_DIRECT/.test(soc)) continue;
    const pt = String(row.post_type || "").toUpperCase();
    if (pt === "REPLY" || pt === "REPOST") continue;
    if (pt && pt !== "ORIGINAL" && pt !== "QUOTE" && pt !== "UNKNOWN" && pt !== "") continue;
    const pub = row.published_at ? new Date(row.published_at) : null;
    if (pub && (pub < from || pub > now)) continue;
    const cand = extractExperienceMaterial(String(row.text_body || ""), {
      published_at: row.published_at || undefined,
      post_type: row.post_type || undefined,
      source_ref: row.x_post_id || undefined,
    });
    if (!cand) continue;
    cand.provenance = "RECENT_MANUAL_14D";
    const key = `${cand.cluster}|${cand.concrete_subject}`.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cand);
  }
  return out;
}

function loadArchiveExperienceLedger(): ExperienceCandidate[] {
  try {
    const raw = Deno.readTextFileSync(new URL("./experience-ledger.json", import.meta.url));
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ExperienceCandidate[]) : [];
  } catch {
    return [];
  }
}

/** Empty until operator drops archive-derived ledger JSON. EXPERIENCE seeds fail closed while empty. */
export const ARCHIVE_EXPERIENCE_FALLBACK: ExperienceCandidate[] = loadArchiveExperienceLedger();

const EXAMPLE_CONTAMINATION = [
  /fsd\s*v10/i,
  /v10대/,
  /개발\s*오더/,
  /example\s*only/i,
  /implementation\s*example/i,
];

export function isExampleContamination(text: string): boolean {
  return EXAMPLE_CONTAMINATION.some((r) => r.test(text));
}

export function resolveExperienceSupply(
  need: number,
  recent: ExperienceCandidate[],
  archive: ExperienceCandidate[] = []
): {
  selected: ExperienceCandidate[];
  report: ExperienceSupplyReport;
} {
  const selected: ExperienceCandidate[] = [];
  const notes: string[] = [];
  let archive_explored = false;
  let archive_fallback_used = 0;
  let experience_supply_low = 0;
  const provenance_counts: Record<string, number> = {};
  let recent_blocked_as_seed = 0;
  const take = (list: ExperienceCandidate[], max: number, requireSeedEligible: boolean) => {
    for (const c of list) {
      if (selected.length >= max) break;
      if (isExampleContamination(c.concrete_subject)) {
        notes.push("EXAMPLE_CONTAMINATION_SKIPPED");
        continue;
      }
      if (requireSeedEligible && !c.seed_eligible) {
        recent_blocked_as_seed += 1;
        notes.push("ORDER0B_BLOCK_MANUAL_AUTO_SEED");
        continue;
      }
      if (selected.some((s) => s.concrete_subject === c.concrete_subject)) continue;
      selected.push(c);
      provenance_counts[c.provenance] = (provenance_counts[c.provenance] || 0) + 1;
      if (c.provenance !== "RECENT_MANUAL_14D") archive_fallback_used += 1;
    }
  };
  take(recent, need, true);
  const recent_adopted = selected.length;
  if (selected.length < need) {
    archive_explored = true;
    notes.push("RECENT_SUPPLY_SHORT → archive empty or short");
    const timeless = archive.filter((a) => a.experience_class === "TIMELESS");
    const historical = archive.filter((a) => a.experience_class === "HISTORICAL");
    take(timeless, need, false);
    if (selected.length < need) take(historical, need, false);
  } else {
    notes.push("RECENT_SUFFICIENT → archive not explored");
  }
  if (selected.length < need) {
    experience_supply_low = need - selected.length;
    notes.push("EXPERIENCE_SUPPLY_LOW after recent+archive");
  }
  notes.push(`ORDER0B_RECENT_BLOCKED=${recent_blocked_as_seed}`);
  return {
    selected,
    report: {
      recent_candidates: recent.length,
      recent_adopted,
      archive_explored,
      archive_timeless_candidates: archive.filter((a) => a.experience_class === "TIMELESS").length,
      archive_historical_candidates: archive.filter((a) => a.experience_class === "HISTORICAL").length,
      archive_fallback_used,
      experience_supply_low,
      provenance_counts,
      historical_framing_required_count: selected.filter((s) => s.historical_framing_required).length,
      notes,
    },
  };
}

export function experienceCandidateToSeedFields(c: ExperienceCandidate): Record<string, unknown> {
  const subject = String(c.concrete_subject || "").trim();
  return {
    cluster: c.cluster,
    dimension: c.dimension,
    concrete_subject: subject,
    point_or_tension: c.point_or_tension,
    intent: "EXPERIENCE",
    seed_type: "EXPERIENCE",
    experience_required: true,
    creator_evidence_available: true,
    primary_source: c.provenance,
    supporting_sources: [c.provenance, "EXPERIENCE_EVIDENCE"],
    evidence_source_ids: [c.source_ref || c.provenance],
    signals: ["EXP01"],
    performance_momentum: "NONE",
    length_mode: "MEDIUM",
    requested_editorial_mode: "EXPERIENCE",
    experience_provenance: c.provenance,
    experience_class: c.experience_class,
    historical_framing_required: c.historical_framing_required,
    status: "ELIGIBLE",
    claim_types: ["PERSONAL_EXPERIENCE"],
    allowed_facts: [],
    factual_anchors: [],
    source_role: c.source_role || "SEED_SOURCE",
    seed_eligible: c.seed_eligible !== false,
    cite_episode_hint: c.cite_episode_hint || CITE_NOT_CLONE,
    idea_angle_family: c.idea_angle_hint,
    do_not_invent: [
      "manual_body_narrative",
      "manual_punchline",
      "manual_conclusion",
      "same_episode_retell",
      "오늘/어제/이번 주 시점 발명",
      "출퇴근 경로 발명",
      "방문 장소 발명",
      "직접 테스트/체험 발명",
      "구체 거리/시간/횟수 발명",
    ],
  };
}

export const HISTORICAL_FRAMING_GUARD =
  "HISTORICAL EXPERIENCE: Infer a past frame from the dated evidence. Do not copy a time-word from this prompt. Never state past software/UI/price/policy as current fact.";
