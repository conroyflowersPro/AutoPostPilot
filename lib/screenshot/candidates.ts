/**
 * Build concrete topic candidates from Fedica ranked keywords.
 * Does NOT invent events, quotes, or metrics.
 */
import type {
  RankedKeyword,
  SemanticCluster,
  ConcreteTopicCandidate,
  RelativeWeight,
  PostBrief,
} from "./types";

const WEIGHT_ORDER: RelativeWeight[] = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW"];

function normWeight(w: string | undefined, rank: number): RelativeWeight {
  const u = String(w || "").toUpperCase();
  if (u.includes("VERY")) return "VERY_HIGH";
  if (u === "HIGH") return "HIGH";
  if (u === "LOW") return "LOW";
  if (rank <= 1) return "VERY_HIGH";
  if (rank <= 3) return "HIGH";
  if (rank <= 6) return "MEDIUM";
  return "LOW";
}

export function buildSemanticClusters(ranked: RankedKeyword[]): SemanticCluster[] {
  const buckets: Record<string, SemanticCluster> = {};
  const assign = (kw: string, weight: RelativeWeight) => {
    const k = kw.toLowerCase();
    let id = "OTHER";
    let label = "Other";
    if (/elon|musk/.test(k)) {
      id = "MUSK_PUBLIC";
      label = "Musk / public conversation";
    } else if (/cybercab|robotaxi|fsd|hw3|v1[0-9]|autonom/.test(k)) {
      id = "AUTONOMY";
      label = "Autonomy / FSD / Cybercab";
    } else if (/starlink|spacex|rocket|starship/.test(k)) {
      id = "SPACEX_STARLINK";
      label = "SpaceX / Starlink";
    } else if (/optimus|humanoid|bot/.test(k)) {
      id = "ROBOTICS";
      label = "Robotics / Optimus";
    } else if (/terafab|megapack|energy|semi|cybertruck|model [3sy]|tesla/.test(k)) {
      id = "TESLA_PRODUCT";
      label = "Tesla product / manufacturing";
    } else if (/xai|grok|ai infra|bandwidth|inference/.test(k)) {
      id = "AI_INFRA";
      label = "AI / infrastructure";
    } else if (/lafc|mls|soccer|football/.test(k)) {
      id = "LAFC";
      label = "LAFC / soccer";
    }
    if (!buckets[id]) {
      buckets[id] = { id, label, keywords: [], topWeight: weight };
    }
    if (!buckets[id].keywords.includes(kw)) buckets[id].keywords.push(kw);
    if (WEIGHT_ORDER.indexOf(weight) < WEIGHT_ORDER.indexOf(buckets[id].topWeight)) {
      buckets[id].topWeight = weight;
    }
  };
  for (const r of ranked) {
    assign(r.keyword, normWeight(r.relativeWeight as string, r.visualRank));
  }
  return Object.values(buckets).sort(
    (a, b) => WEIGHT_ORDER.indexOf(a.topWeight) - WEIGHT_ORDER.indexOf(b.topWeight)
  );
}

export function buildConcreteCandidates(
  ranked: RankedKeyword[],
  interests: string[] = [],
  topKeywordInterest?: string | null
): ConcreteTopicCandidate[] {
  const clusters = buildSemanticClusters(ranked);
  const out: ConcreteTopicCandidate[] = [];
  let i = 0;
  for (const c of clusters) {
    const strength = c.topWeight;
    let concrete = topKeywordInterest || interests[0] || c.label;
    let angle = "audience interest as discussion signal — creator observation/analysis only";
    let sufficiency: ConcreteTopicCandidate["context_sufficiency"] = "READY";
    let confidence: ConcreteTopicCandidate["confidence"] = "MEDIUM";

    if (c.id === "MUSK_PUBLIC") {
      concrete = "Musk/Tesla 생태계 공개 담론 — 제품·AI 관점 해석";
      angle = "팔로워 언급 인물 담론을 주가 없이 제품/비전 맥락으로";
      confidence = strength === "VERY_HIGH" || strength === "HIGH" ? "HIGH" : "MEDIUM";
    } else if (c.id === "AUTONOMY") {
      concrete = "자율주행·Robotaxi/Cybercab 담론 — 관찰자 시점";
      angle = "현장 경험 발명 금지, 공개 제품 진행 프레임";
    } else if (c.id === "SPACEX_STARLINK") {
      concrete = "SpaceX/Starlink 관심 신호 — 인접 테크 관찰";
      angle = "가짜 발사 일정 금지";
      sufficiency = "NEEDS_CONTEXT";
      confidence = "LOW";
    } else if (c.id === "TESLA_PRODUCT") {
      concrete = "Tesla 제품·제조·에너지 관심 신호";
      angle = "오너/관찰 톤, 수치·발표 발명 금지";
    } else if (c.id === "AI_INFRA") {
      concrete = "AI 인프라·대역 수요 담론 — 해석형";
      angle = "키워드 나열 금지, 한 가지 포인트만";
    } else if (c.id === "ROBOTICS") {
      concrete = "Optimus/로보틱스 관심 — 장기 비전 프레임";
      angle = "체험 허구 금지";
    } else if (c.id === "LAFC") {
      concrete = "LAFC 관련 관심 신호";
      angle = "일정·직관 정책은 Planner LAFC 규칙 우선";
    } else {
      concrete = `${c.label} 관련 팔로워 관심`;
      angle = "구체 사건 없으면 무리한 단정 금지";
      sufficiency = "LOW_CONFIDENCE";
      confidence = "LOW";
    }

    out.push({
      id: `ss_cand_${i++}`,
      source: "FEDICA_SCREENSHOT",
      source_keywords: c.keywords.slice(0, 6),
      semantic_cluster: c.id,
      audience_signal_strength: strength,
      concrete_subject: concrete,
      context: "Fedica follower keyword cloud (relative visual weight only; no invented mention counts)",
      why_now: "Weekly audience vocabulary signal from provided screenshot",
      creator_relevance: "Filter via Creator DNA at plan time; no fake first-person",
      proposed_angle: angle,
      confidence,
      context_sufficiency: sufficiency,
      relative_rank: ranked.find((r) => c.keywords.includes(r.keyword))?.visualRank,
    });
  }
  return out;
}

export function selectWeeklyScreenshotSubjects(
  candidates: ConcreteTopicCandidate[],
  days: number
): (ConcreteTopicCandidate | null)[] {
  const usable = candidates.filter(
    (c) =>
      c.context_sufficiency === "READY" ||
      (c.context_sufficiency === "NEEDS_CONTEXT" && c.confidence !== "LOW")
  );
  const pool = [
    ...usable.filter((c) => c.context_sufficiency === "READY"),
    ...usable.filter((c) => c.context_sufficiency !== "READY"),
  ];
  const usedClusters = new Set<string>();
  const result: (ConcreteTopicCandidate | null)[] = [];
  for (let d = 0; d < days; d++) {
    let pick: ConcreteTopicCandidate | null = null;
    for (const c of pool) {
      if (usedClusters.has(c.semantic_cluster) && pool.length > 1) continue;
      pick = c;
      break;
    }
    if (!pick && pool.length) pick = pool[d % pool.length];
    if (pick) usedClusters.add(pick.semantic_cluster);
    if (usedClusters.size >= new Set(pool.map((p) => p.semantic_cluster)).size) {
      usedClusters.clear();
    }
    result.push(pick);
  }
  return result;
}

export function candidateToPostBrief(
  c: ConcreteTopicCandidate,
  dayOffset: number
): PostBrief {
  return {
    source: "SCREENSHOT_DERIVED",
    source_keywords: c.source_keywords,
    source_cluster: c.semantic_cluster,
    audience_signal_rank: c.relative_rank,
    concrete_subject: c.concrete_subject,
    why_this_topic: c.why_now,
    context: c.context,
    creator_angle: c.proposed_angle,
    audience_connection: `Fedica signal strength ${c.audience_signal_strength}`,
    core_point: c.concrete_subject,
    known_facts: [
      "Signal source = Fedica keyword cloud relative visual weight only",
      `Keywords: ${c.source_keywords.join(", ")}`,
    ],
    do_not_invent: [
      "fake quotes",
      "fake dates/numbers",
      "first-person product tests",
      "stock price calls",
      "mention counts",
    ],
    writing_mode: "concrete_observation_or_analysis",
    media_suggestion: "image or short video required by account policy",
    selection_reason: `dayOffset ${dayOffset}; cluster ${c.semantic_cluster}; sufficiency ${c.context_sufficiency}`,
  };
}
