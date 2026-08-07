import {
  METRIC_WEIGHTS,
  type NormalizedPostMetrics,
  type ScoredPostMetrics,
  type PlannerMemoryPayload,
  type CreatorDnaPayload,
  type AudienceDnaPayload,
} from "./types";

function logScale(n: number): number {
  if (!n || n <= 0) return 0;
  return Math.log10(1 + n);
}

/** Weighted score — followers/profile/bookmarks dominate; impressions weak */
export function scorePost(m: NormalizedPostMetrics): number {
  return (
    METRIC_WEIGHTS.followersGained * logScale(m.followersGained) +
    METRIC_WEIGHTS.profileVisits * logScale(m.profileVisits) +
    METRIC_WEIGHTS.bookmarks * logScale(m.bookmarks) +
    METRIC_WEIGHTS.replies * logScale(m.replies) +
    METRIC_WEIGHTS.reposts * logScale(m.reposts) +
    METRIC_WEIGHTS.likes * logScale(m.likes) +
    METRIC_WEIGHTS.impressions * logScale(m.impressions) +
    METRIC_WEIGHTS.quotes * logScale(m.quotes)
  );
}

export function scoreAll(rows: NormalizedPostMetrics[]): ScoredPostMetrics[] {
  const scored = rows.map((m) => ({
    ...m,
    weightedScore: scorePost(m),
    isSuccess: false,
  }));
  if (scored.length === 0) return scored;

  const scores = scored.map((s) => s.weightedScore).sort((a, b) => a - b);
  const idx = Math.floor(scores.length * 0.7);
  const threshold = Math.max(scores[idx] ?? 0, scores[Math.floor(scores.length / 2)] * 1.15);

  for (const s of scored) {
    s.isSuccess = s.weightedScore >= threshold && s.weightedScore > 0;
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
    if (s.profileVisits > 0) bits.push(`프로필방문 ${s.profileVisits}`);
    if (s.bookmarks > 0) bits.push(`북마크 ${s.bookmarks}`);
    if (s.replies > 0) bits.push(`답글 ${s.replies}`);
    const snip = s.contentSnippet.replace(/\s+/g, " ").slice(0, 100);
    patterns.push(
      `[score ${s.weightedScore.toFixed(1)}] (${bits.join(", ") || "engagement"}) ${snip}`
    );
  }

  const summaryKo =
    successes.length === 0
      ? "이번 주기 검증된 고성과 패턴이 거의 없음 — 기존 Creator DNA 유지."
      : `검증 고성과 ${successes.length}건. 팔로워·프로필·북마크·토론이 강한 패턴만 Memory에 반영.`;

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
    const t = s.contentSnippet.slice(0, 40);
    if (t) topicPreference.push(t);
    if (s.replies >= 3) structures.push("토론 유발형 관찰");
    if (s.bookmarks >= 2) structures.push("저장 가치 있는 실용 팁");
    if (s.contentSnippet.length > 200) structures.push("장문 분석 에세이");
    if (s.contentSnippet.length < 80) structures.push("짧은 실사용 메모");
  }
  if (manualBoost.length > 0) {
    structures.push("수동 작성 고성과 — premium learning");
  }

  return {
    writingRhythm: "해요체 중심 자연 믹스 (검증 성과 기준)",
    tone: "솔직한 실소유·필드 체감",
    hookStyle: "패턴 반복 금지, 다양화",
    observationStyle: "구체 숫자·장면 중심",
    analysisStyle: "과장 없는 장기 비전 해석",
    humorStyle: "가벼운 ㅋㅋ 수준만",
    topicPreference: [...new Set(topicPreference)].slice(0, 8),
    successfulStructures: [...new Set(structures)].slice(0, 8),
    summaryKo:
      successes.length > 0
        ? `고성과 ${successes.length}건 기준 Creator DNA 갱신 (수동 ${manualBoost.length})`
        : "성과 부족 — 기존 Creator DNA 유지",
  };
}

export function buildAudienceDnaHint(
  scored: ScoredPostMetrics[]
): AudienceDnaPayload {
  const successes = scored.filter((s) => s.isSuccess);
  const interests = successes
    .map((s) => s.contentSnippet.slice(0, 30))
    .filter(Boolean)
    .slice(0, 10);

  return {
    interestGraph: interests,
    sentiment: "unknown",
    topicMovement: interests.slice(0, 5),
    followerInterests: interests,
    summaryKo:
      successes.length > 0
        ? `고성과 콘텐츠 주제 ${interests.length}개를 Audience 신호로 반영`
        : "Audience DNA는 Fedica 관심 신호 우선 유지",
  };
}
