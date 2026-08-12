/**
 * ORDER 3 — Evidence Packet (Data Contract for Seed Engine)
 * Not a new Business Engine. Structured facts extracted from Evidence.
 * Never stores finished post templates or raw republish bodies as Seeds.
 * ORDER 0B: ACCOUNT_ACTIVITY uses abstract fact labels only.
 */
export type TimeSensitivity = "TIMELESS" | "HISTORICAL" | "TIME_SENSITIVE" | "UNKNOWN";

export type EvidencePacket = {
  source_ids: string[];
  source_type: "ACCOUNT_ACTIVITY" | "CREATOR_INTENT" | "ARCHIVE" | "PUBLISHED_HISTORY";
  topic: string;
  subtopic: string;
  entities: string[];
  verified_locations: string[];
  verified_events: string[];
  experience_facts: string[];
  static_facts: string[];
  current_facts: string[];
  creator_opinion: string[];
  relationship_edges: string[];
  time_sensitivity: TimeSensitivity;
  previous_idea_angles: string[];
  factual_anchors: string[];
  raw_length: number;
  published_at?: string;
};

const LOCATION_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "BMO", re: /\bbmo\b|비모/i },
  { id: "LA", re: /\bla\b|로스앤젤레스|로스\s*앤젤레스/i },
  { id: "SF", re: /샌프란|san\s*francisco|\bsf\b/i },
  { id: "REDWOOD_CITY", re: /레드우드|redwood/i },
  { id: "SUPERCHARGER", re: /슈퍼차저|supercharger/i },
];

const ENTITY_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "FSD", re: /\bfsd\b|오토파일럿|autosteer/i },
  { id: "CYBERTRUCK", re: /cybertruck|사이버\s*트럭|사이버트럭/i },
  { id: "ROBOTAXI", re: /robotaxi|로보\s*택시/i },
  { id: "LAFC", re: /\blafc\b/i },
  { id: "MODEL_S", re: /model\s*s|모델\s*s|s\s*plaid/i },
  { id: "MODEL_3", re: /model\s*3|모델\s*3|m3\s*perf/i },
  { id: "GROK", re: /\bgrok\b|그록/i },
];

const EXPERIENCE_RE =
  /(해봤|타\s*보|갔었|직관|충전했|운전했|써\s*보니|체감|직접|장거리|소유)/i;
const OPINION_RE = /(생각|보임|의견|반대|찬성|차라리|더\s*낫|별로)/i;
const CURRENT_RE =
  /(오늘|어제|이번\s*주|방금|지금|현재|최신\s*(버전|빌드|업데이트)|출시된|방금\s*공개)/i;
const HISTORICAL_RE = /(예전|당시|과거|그\s*버전|v1[0-2]\b)/i;

function detectTopic(text: string): { topic: string; subtopic: string } {
  const t = text.toLowerCase();
  if (/fsd|오토파일럿|합류|감시|감독/.test(t))
    return { topic: "FSD", subtopic: /감시|감독/.test(t) ? "SUPERVISION" : "GENERAL" };
  if (/cyber|사이버|충전|적재/.test(t))
    return { topic: "CYBERTRUCK", subtopic: /충전/.test(t) ? "CHARGING" : "OWNERSHIP" };
  if (/robotaxi|로보|커브|승하차/.test(t)) return { topic: "ROBOTAXI", subtopic: "CURBSIDE" };
  if (/lafc|bmo|직관|경기/.test(t)) return { topic: "LAFC", subtopic: "MATCHDAY" };
  if (/게임|스팀|한\s*판/.test(t)) return { topic: "GAMING", subtopic: "SESSION" };
  if (/\bai\b|그록|grok|프롬프트/.test(t)) return { topic: "AI_TECH", subtopic: "TOOL" };
  return { topic: "OTHER", subtopic: "GENERAL" };
}

function extractAnchors(text: string): string[] {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(/[.!?。\n]+/).map((s) => s.trim()).filter((s) => s.length >= 8 && s.length <= 80);
  return parts.slice(0, 3);
}

export function extractEvidencePacket(
  text: string,
  meta?: {
    source_id?: string;
    source_type?: EvidencePacket["source_type"];
    published_at?: string;
  }
): EvidencePacket | null {
  const body = String(text || "").trim();
  if (body.length < 12) return null;
  const { topic, subtopic } = detectTopic(body);
  const entities = ENTITY_PATTERNS.filter((e) => e.re.test(body)).map((e) => e.id);
  const verified_locations = LOCATION_PATTERNS.filter((l) => l.re.test(body)).map((l) => l.id);
  const experience_facts: string[] = [];
  const static_facts: string[] = [];
  const current_facts: string[] = [];
  const creator_opinion: string[] = [];
  // ORDER 0B: ACCOUNT_ACTIVITY → abstract fact labels (no narrative sentence anchors)
  const isManual = !meta?.source_type || meta.source_type === "ACCOUNT_ACTIVITY";
  const label = (kind: string) => {
    if (kind === "exp") {
      if (/합류|merge/i.test(body)) return "merge_behavior_observed";
      if (/감시|감독/i.test(body)) return "supervision_load_observed";
      if (/충전/.test(body)) return "charging_session_observed";
      return `${topic.toLowerCase()}_lived_observation`;
    }
    if (kind === "opinion") return `${topic.toLowerCase()}_tradeoff_judgment`;
    if (kind === "current") return `${topic.toLowerCase()}_current_context`;
    return `${topic.toLowerCase()}_structural_observation`;
  };
  if (EXPERIENCE_RE.test(body)) {
    experience_facts.push(isManual ? label("exp") : (extractAnchors(body)[0] || label("exp")));
  }
  if (OPINION_RE.test(body)) {
    creator_opinion.push(isManual ? label("opinion") : (extractAnchors(body)[0] || label("opinion")));
  }
  if (CURRENT_RE.test(body)) {
    current_facts.push(isManual ? label("current") : (extractAnchors(body)[0] || label("current")));
  }
  if (!experience_facts.length && !creator_opinion.length) {
    static_facts.push(label("static"));
  }
  let time_sensitivity: TimeSensitivity = "UNKNOWN";
  if (HISTORICAL_RE.test(body)) time_sensitivity = "HISTORICAL";
  else if (CURRENT_RE.test(body)) time_sensitivity = "TIME_SENSITIVE";
  else if (EXPERIENCE_RE.test(body) || /소유|습관|평소/.test(body)) time_sensitivity = "TIMELESS";

  return {
    source_ids: meta?.source_id ? [String(meta.source_id)] : [],
    source_type: meta?.source_type || "ACCOUNT_ACTIVITY",
    topic,
    subtopic,
    entities,
    verified_locations,
    verified_events: [],
    experience_facts,
    static_facts,
    current_facts,
    creator_opinion,
    relationship_edges: [],
    time_sensitivity,
    previous_idea_angles: [],
    factual_anchors: isManual
      ? [...experience_facts, ...static_facts, ...current_facts, ...creator_opinion].slice(0, 6)
      : extractAnchors(body),
    raw_length: body.length,
    published_at: meta?.published_at,
  };
}

export function reasonSeedSubjectFromPacket(packet: EvidencePacket): {
  concrete_subject: string;
  point_or_tension: string;
  idea_angle_family: string;
  needs_xai: boolean;
} {
  const parts: string[] = [];
  const tension: string[] = [];
  if (packet.experience_facts.length) {
    parts.push(`${packet.topic} 실사용에서 관찰된 ${packet.subtopic.toLowerCase()} 패턴`);
    tension.push("경험 사실만 사용 — 원문 재게시 금지");
  } else if (packet.creator_opinion.length) {
    parts.push(`${packet.topic}에 대한 트레이드오프·판단 축`);
    tension.push("의견 근거는 Evidence opinion에 한정");
  } else if (packet.static_facts.length) {
    parts.push(`${packet.topic} ${packet.subtopic} 구조·조건 관찰`);
    tension.push("정적 사실 기반 관찰");
  } else {
    parts.push(`${packet.topic} 관련 Evidence 기반 관찰 축`);
    tension.push("앵커 부족 — 각도 확장 제한");
  }
  if (packet.entities.length) {
    parts[0] = `${packet.entities.slice(0, 2).join("+")} 중심으로 본 ${packet.topic} ${packet.subtopic}`;
  }
  if (packet.verified_locations.length === 1) {
    tension.push(`위치 앵커: ${packet.verified_locations[0]} (Evidence 확인)`);
  }
  const concrete_subject = parts[0].slice(0, 90);
  const idea_angle_family = `${packet.topic}|${packet.subtopic}|${packet.entities.slice(0, 2).join("+") || "gen"}`.slice(0, 80);
  const needs_xai =
    packet.factual_anchors.length === 0 ||
    (packet.experience_facts.length === 0 &&
      packet.static_facts.length === 0 &&
      packet.creator_opinion.length === 0);
  return {
    concrete_subject,
    point_or_tension: tension.join("; ").slice(0, 120),
    idea_angle_family,
    needs_xai,
  };
}

export function relationshipEdgeId(a: EvidencePacket, b: EvidencePacket): string | null {
  if (a.source_ids.some((id) => b.source_ids.includes(id))) {
    return `same_source:${a.source_ids[0]}`;
  }
  const shared = a.entities.filter((e) => b.entities.includes(e));
  if (shared.length >= 1 && a.topic !== b.topic) {
    return null;
  }
  return null;
}

export function collectVerifiedSets(packets: EvidencePacket[]): {
  locations: Set<string>;
  entities: Set<string>;
  events: Set<string>;
} {
  const locations = new Set<string>();
  const entities = new Set<string>();
  const events = new Set<string>();
  for (const p of packets) {
    p.verified_locations.forEach((x) => locations.add(x));
    p.entities.forEach((x) => entities.add(x));
    p.verified_events.forEach((x) => events.add(x));
  }
  return { locations, entities, events };
}
