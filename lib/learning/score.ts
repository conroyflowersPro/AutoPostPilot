import {
  METRIC_WEIGHTS,
  type NormalizedPostMetrics,
  type ScoredPostMetrics,
  type PlannerMemoryPayload,
  type CreatorDnaPayload,
  type AudienceDnaPayload,
  type PerformanceDnaPayload,
  type RevenueDnaPayload,
} from "./types";

function logScale(n: number): number {
  if (!n || n <= 0) return 0;
  return Math.log10(1 + n);
}

export function scorePost(m: NormalizedPostMetrics): number {
  return (
    METRIC_WEIGHTS.followersGained * logScale(m.followersGained) +
    METRIC_WEIGHTS.profileVisits * logScale(m.profileVisits) +
    METRIC_WEIGHTS.revenue * logScale(m.revenue) +
    METRIC_WEIGHTS.bookmarks * logScale(m.bookmarks) +
    METRIC_WEIGHTS.replies * logScale(m.replies) +
    METRIC_WEIGHTS.reposts * logScale(m.reposts) +
    METRIC_WEIGHTS.quotes * logScale(m.quotes) +
    METRIC_WEIGHTS.likes * logScale(m.likes) +
    METRIC_WEIGHTS.impressions * logScale(m.impressions) +
    METRIC_WEIGHTS.detailExpands * logScale(m.detailExpands) +
    METRIC_WEIGHTS.shares * logScale(m.shares)
  );
}

export function scoreAll(rows: NormalizedPostMetrics[]): ScoredPostMetrics[] {
  const scored = rows.map((m) => ({
    ...m,
    weightedScore: scorePost(m),
    isSuccess: false,
  }));
  if (scored.length === 0) return scored;

  const candidates = scored.filter(
    (s) => !(s.features?.isReply && s.impressions < 500 && s.weightedScore < 5)
  );
  const pool = candidates.length >= 3 ? candidates : scored;

  const scores = pool.map((s) => s.weightedScore).sort((a, b) => a - b);
  const idx = Math.floor(scores.length * 0.7);
  const threshold = Math.max(
    scores[idx] ?? 0,
    (scores[Math.floor(scores.length / 2)] || 0) * 1.15
  );

  for (const s of scored) {
    s.isSuccess = s.weightedScore >= threshold && s.weightedScore > 0;
    if (s.features?.isReply && s.impressions < 800 && !s.followersGained)
      s.isSuccess = false;
  }
  if (!scored.some((s) => s.isSuccess)) {
    const best = [...scored].sort((a, b) => b.weightedScore - a.weightedScore)[0];
    if (best && best.weightedScore > 0) best.isSuccess = true;
  }
  return scored;
}

export function buildPlannerMemory(
  scored: ScoredPostMetrics[]
): PlannerMemoryPayload {
  const successes = scored
    .filter((s) => s.isSuccess)
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 12);

  const patterns: string[] = [];
  for (const s of successes) {
    const bits: string[] = [];
    if (s.followersGained > 0) bits.push(`팔로워+${s.followersGained}`);
    if (s.profileVisits > 0) bits.push(`프로필 ${s.profileVisits}`);
    if (s.bookmarks > 0) bits.push(`북마크 ${s.bookmarks}`);
    if (s.replies > 0) bits.push(`답글 ${s.replies}`);
    if (s.detailExpands > 0) bits.push(`상세열람 ${s.detailExpands}`);
    if (s.revenue > 0) bits.push(`수익 ${s.revenue}`);
    const feat = s.features
      ? `${s.features.topicGuess}/${s.features.lengthBucket}`
      : "";
    const snip = s.contentSnippet.replace(/\s+/g, " ").slice(0, 90);
    patterns.push(
      `[${s.weightedScore.toFixed(1)}] (${bits.join(", ") || "eng"}) ${feat} ${snip}`
    );
  }

  const summaryKo =
    successes.length === 0
      ? "이번 주기 검증된 고성과 패턴이 거의 없음 — 기존 DNA 유지."
      : `검증 고성과 ${successes.length}건. 팔로워·프로필·수익·북마크·토론 신호 우선 반영.`;

  return {
    patterns,
    summaryKo,
    successCount: successes.length,
    analyzedCount: scored.length,
  };
}

export function buildCreatorDnaHint(
  scored: ScoredPostMetrics[]
): CreatorDnaPayload {
  const successes = scored.filter((s) => s.isSuccess);
  const manualBoost = successes.filter((s) => s.origin === "manual");
  const topicPreference: string[] = [];
  const structures: string[] = [];

  for (const s of successes.slice(0, 8)) {
    if (s.features?.topicGuess && s.features.topicGuess !== "reply")
      topicPreference.push(s.features.topicGuess);
    if (s.replies >= 3) structures.push("토론 유발형 관찰");
    if (s.bookmarks >= 2) structures.push("저장 가치 실용 팁");
    if (s.features?.lengthBucket === "long") structures.push("장문 분석");
    if (s.features?.lengthBucket === "short") structures.push("짧은 실사용 메모");
    if (s.features?.hasNumbers) structures.push("구체 숫자 포함");
    if (s.detailExpands >= 20) structures.push("상세 열람 유도 구조");
  }
  if (manualBoost.length > 0) structures.push("수동 작성 고성과 — premium");

  return {
    writingRhythm: "해요체 중심 자연 믹스",
    tone: "솔직한 실소유·필드 체감",
    hookStyle: "패턴 반복 금지",
    observationStyle: "구체 숫자·장면 중심",
    analysisStyle: "과장 없는 장기 비전",
    humorStyle: "가벼운 ㅋㅋ 수준",
    topicPreference: [...new Set(topicPreference)].slice(0, 8),
    successfulStructures: [...new Set(structures)].slice(0, 8),
    summaryKo:
      successes.length > 0
        ? `고성과 ${successes.length}건 기준 Creator DNA (수동 ${manualBoost.length})`
        : "성과 부족 — 기존 Creator DNA 유지",
  };
}

export function buildAudienceDnaHint(
  scored: ScoredPostMetrics[]
): AudienceDnaPayload {
  const successes = scored.filter((s) => s.isSuccess);
  const interests = successes
    .map((s) => s.features?.topicGuess || s.contentSnippet.slice(0, 30))
    .filter((t) => t && t !== "reply")
    .slice(0, 10);

  return {
    interestGraph: [...new Set(interests)],
    sentiment: "unknown",
    topicMovement: [...new Set(interests)].slice(0, 5),
    followerInterests: [...new Set(interests)],
    summaryKo:
      successes.length > 0
        ? `고성과 주제 ${[...new Set(interests)].length}개를 Audience 신호로 반영`
        : "Audience DNA는 Fedica 관심 신호 우선 유지",
  };
}

export function buildPerformanceDna(
  scored: ScoredPostMetrics[]
): PerformanceDnaPayload {
  const successes = scored
    .filter((s) => s.isSuccess)
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 15);

  const whyPatterns: string[] = [];
  const topStructures: string[] = [];
  const lengthWins: string[] = [];
  const topicWins: string[] = [];

  for (const s of successes) {
    const reasons: string[] = [];
    if (s.followersGained > 0) reasons.push("팔로워 증가");
    if (s.profileVisits >= 5) reasons.push("프로필 유입");
    if (s.bookmarks >= 2) reasons.push("저장 가치");
    if (s.detailExpands >= 15) reasons.push("상세 읽기");
    if (s.replies >= 3) reasons.push("토론");
    if (s.features?.hasNumbers) reasons.push("숫자 근거");
    if (s.features && !s.features.isReply) reasons.push("원글");
    const snip = s.contentSnippet.replace(/\s+/g, " ").slice(0, 70);
    whyPatterns.push(
      `${reasons.join("+") || "engagement"} | ${s.features?.topicGuess || "?"} | ${snip}`
    );
    if (s.features?.lengthBucket) lengthWins.push(s.features.lengthBucket);
    if (s.features?.topicGuess && s.features.topicGuess !== "reply")
      topicWins.push(s.features.topicGuess);
    if (s.features?.lengthBucket === "long" && s.detailExpands > 10)
      topStructures.push("장문+상세열람");
    if (s.features?.hasNumbers && s.bookmarks > 0)
      topStructures.push("숫자+저장");
    if (!s.features?.isReply && s.profileVisits > 0)
      topStructures.push("원글+프로필");
  }

  const lengthCount: Record<string, number> = {};
  for (const l of lengthWins) lengthCount[l] = (lengthCount[l] || 0) + 1;
  const topicCount: Record<string, number> = {};
  for (const t of topicWins) topicCount[t] = (topicCount[t] || 0) + 1;

  return {
    whyPatterns: whyPatterns.slice(0, 12),
    topStructures: [...new Set(topStructures)].slice(0, 8),
    lengthWins: Object.entries(lengthCount)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}×${v}`),
    topicWins: Object.entries(topicCount)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}×${v}`),
    summaryKo:
      successes.length > 0
        ? `Performance DNA: 고성과 ${successes.length}건에서 성공 요인 추출`
        : "Performance DNA: 이번 주기 고성과 부족",
  };
}

export function buildRevenueDna(
  scored: ScoredPostMetrics[]
): RevenueDnaPayload {
  const withRev = scored.filter((s) => s.revenue > 0);
  if (withRev.length === 0) {
    return {
      revenueByTopic: [],
      notes: ["현재 수익 데이터 0 — Revenue DNA 대기"],
      summaryKo: "Revenue DNA: 수익 신호 없음 (구조만 유지)",
    };
  }
  const byTopic: Record<string, number> = {};
  for (const s of withRev) {
    const t = s.features?.topicGuess || "other";
    byTopic[t] = (byTopic[t] || 0) + s.revenue;
  }
  return {
    revenueByTopic: Object.entries(byTopic)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`),
    notes: [`수익 포스트 ${withRev.length}건`],
    summaryKo: `Revenue DNA: ${withRev.length}건 수익 신호 반영`,
  };
}
