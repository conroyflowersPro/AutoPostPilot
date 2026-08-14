/**
 * EXPERIENCE evidence pipeline — Production + ORDER 0B
 * Manual posts = learning/grounding only; never body.slice as seed subject.
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
  source_role?: string;
  seed_eligible?: boolean;
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
  let subject: string;
  if (cluster === "FSD") {
    if (/합류|merge/i.test(body)) subject = historical ? "과거 FSD 합류 장면 관찰 (시점 프레임 필수)" : "FSD 합류 장면 실사용 관찰 축";
    else if (/감시|감독|supervision/i.test(body)) subject = "FSD 감시 부하·개입 타이밍 관찰 축";
    else subject = historical ? "과거 FSD 실사용에서 본 합류·감시 패턴" : "FSD 실사용 관찰 — 합류/감시 부하 축";
  } else if (cluster === "CYBERTRUCK") {
    subject = /충전/.test(body) ? "실제 충전 세션에서 본 대기·속도 트레이드오프" : "Cybertruck 실사용 충전/동선 관찰 축";
  } else if (cluster === "LAFC") subject = "LAFC 직관 동선·현장 관찰 축";
  else if (cluster === "ROBOTAXI") subject = "Robotaxi 현장 동선·승하차 관찰 축";
  else subject = `${cluster} 실사용·현장 관찰 축`;
  const userExplicit = !!meta?.user_explicit;
  return {
    cluster,
    dimension: historical ? "HISTORICAL_EXPERIENCE" : "RECENT_EXPERIENCE",
    concrete_subject: subject.slice(0, 90),
    point_or_tension: historical
      ? "과거 시점 프레임 필수 — 현재 사실처럼 쓰지 말 것; 원문 재게시 금지"
      : "경험 사실·관찰·패턴만 사용, 원문·결론·punchline 재사용 금지",
    experience_class: expClass,
    provenance: "RECENT_MANUAL_14D",
    creator_evidence_available: true,
    experience_required: true,
    historical_framing_required: historical,
    source_ref: meta?.source_ref || meta?.published_at,
    published_at: meta?.published_at,
    idea_angle_hint: historical ? "THEN_VS_NOW_SAFE" : "LIVED_OBSERVATION",
    source_role: userExplicit ? "USER_EXPLICIT_SEED" : "CREATOR_LEARNING_SIGNAL",
    seed_eligible: userExplicit,
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
    source_role: c.source_role || "CREATOR_LEARNING_SIGNAL",
    seed_eligible: !!c.seed_eligible,
    do_not_invent: [
      "manual_body_narrative",
      "manual_punchline",
      "manual_conclusion",
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
