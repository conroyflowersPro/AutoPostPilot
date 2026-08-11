/**
 * EXPERIENCE evidence pipeline — Production canonical (v9.1.2)
 * Priority: (1) recent 14d handmade X only in production default
 * Static catalog REMOVED — never invent 1st-person experience.
 */

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
  experience_class: ExperienceClass;
  provenance: ExperienceProvenance;
  creator_evidence_available: true;
  experience_required: true;
  historical_framing_required: boolean;
  source_ref?: string;
  published_at?: string;
  idea_angle_hint?: string;
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
  /직접|해봤|타\s*보|충전했|직관|갔었|경험|체감|쓰다\s*보|운전했|사용\s*중|내\s*(차|기록|세션)|오늘\s*(충전|주행|직관)|어제|이번\s*주.*(충전|주행|직관|게임)/i;

const HISTORICAL_SIGNAL =
  /fsd\s*v1[0-2]|v10|v11|v12|예전|과거|당시|옛날|예전\s*ui|이전\s*버전|그\s*시절|legacy/i;

const TIMELESS_OWNERSHIP_SIGNAL =
  /소유|오너|장거리|여행|직관|bmo|충전\s*루틴|적재|일상\s*사용|첫\s*사용|로드\s*트립/i;

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

function clusterFromText(text: string): string {
  const t = text.toLowerCase();
  if (/fsd|자율|합류|공사|보행/.test(t)) return "FSD";
  if (/cyber|사이버|충전|적재|슈퍼차저/.test(t)) return "CYBERTRUCK";
  if (/robotaxi|로보|커브|승하차/.test(t)) return "ROBOTAXI";
  if (/lafc|bmo|직관|경기/.test(t)) return "LAFC";
  if (/게임|컨트롤러|한\s*판/.test(t)) return "GAMING";
  if (/\bai\b|그록|프롬프트|초안/.test(t)) return "AI_TECH";
  return "DAILY";
}

export function extractExperienceMaterial(
  text: string,
  meta?: { published_at?: string; post_type?: string; source_ref?: string }
): ExperienceCandidate | null {
  const body = String(text || "").trim();
  if (body.length < 12) return null;
  if (!isExperientialText(body)) return null;
  const expClass = classifyExperienceTime(body, meta?.published_at);
  const cluster = clusterFromText(body);
  let subject = body
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
  if (/충전/.test(body)) subject = subject.includes("충전") ? subject : `실제 충전 세션에서 본 ${subject.slice(0, 40)}`;
  if (/직관|bmo|lafc/i.test(body)) subject = `직관 동선·현장에서 본 ${subject.slice(0, 50)}`;
  const historical = expClass === "HISTORICAL";
  return {
    cluster,
    dimension: historical ? "HISTORICAL_EXPERIENCE" : "RECENT_EXPERIENCE",
    concrete_subject: subject,
    point_or_tension: historical
      ? "과거 시점 프레임 필수 — 현재 사실처럼 쓰지 말 것"
      : "경험 사실·관찰·패턴만 사용, 원문 재게시 금지",
    experience_class: expClass,
    provenance: "RECENT_MANUAL_14D",
    creator_evidence_available: true,
    experience_required: true,
    historical_framing_required: historical,
    source_ref: meta?.source_ref || meta?.published_at,
    published_at: meta?.published_at,
    idea_angle_hint: historical ? "THEN_VS_NOW_SAFE" : "LIVED_OBSERVATION",
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
    if (soc && /APP|SYSTEM|AUTOPOST|GENERATED/.test(soc)) continue;
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
    const key = cand.concrete_subject.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cand);
  }
  return out;
}

/** Production static catalog REMOVED — empty by design */
export const ARCHIVE_EXPERIENCE_FALLBACK: ExperienceCandidate[] = [];

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
  const take = (list: ExperienceCandidate[], max: number) => {
    for (const c of list) {
      if (selected.length >= max) break;
      if (isExampleContamination(c.concrete_subject)) {
        notes.push("EXAMPLE_CONTAMINATION_SKIPPED");
        continue;
      }
      if (selected.some((s) => s.concrete_subject === c.concrete_subject)) continue;
      selected.push(c);
      provenance_counts[c.provenance] = (provenance_counts[c.provenance] || 0) + 1;
      if (c.provenance !== "RECENT_MANUAL_14D") archive_fallback_used += 1;
    }
  };
  take(recent, need);
  const recent_adopted = selected.length;
  if (selected.length < need) {
    archive_explored = true;
    notes.push("RECENT_SUPPLY_SHORT → archive empty or short");
    const timeless = archive.filter((a) => a.experience_class === "TIMELESS");
    const historical = archive.filter((a) => a.experience_class === "HISTORICAL");
    take(timeless, need);
    if (selected.length < need) take(historical, need);
  } else {
    notes.push("RECENT_SUFFICIENT → archive not explored");
  }
  if (selected.length < need) {
    experience_supply_low = need - selected.length;
    notes.push("EXPERIENCE_SUPPLY_LOW after recent+archive");
  }
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
    allowed_facts: subject ? [subject.slice(0, 120)] : [],
    factual_anchors: subject ? [subject.slice(0, 120)] : [],
    do_not_invent: [
      "오늘/어제/이번 주 시점 발명",
      "출퇴근 경로 발명",
      "방문 장소 발명",
      "직접 테스트/체험 발명",
      "구체 거리/시간/횟수 발명",
    ],
  };
}

export const HISTORICAL_FRAMING_GUARD =
  "HISTORICAL EXPERIENCE: You MUST frame as past (예전에 / 그 버전을 쓰던 당시에는 / 지금과 비교하면 당시에는). Never state past software/UI/price/policy as current fact.";
