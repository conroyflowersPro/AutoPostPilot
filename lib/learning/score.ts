/**
 * Learning scores → Intelligence payloads.
 * Planner Memory stores abstract validated patterns only — never post wording.
 * Performance DNA must not overwrite Creator DNA.
 * Revenue DNA must not dominate Planner.
 * Manual published successes are a higher-value signal than AI drafts.
 */
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
    .sort((a, b) => {
      const boostA = a.origin === "manual" ? 1000 : 0;
      const boostB = b.origin === "manual" ? 1000 : 0;
      return b.weightedScore + boostB - (a.weightedScore + boostA);
    })
    .slice(0, 12);

  const patterns: string[] = [];
  for (const s of successes) {
    const bits: string[] = [];
    if (s.origin === "manual") bits.push("MANUAL_PREMIUM");
    if (s.followersGained > 0) bits.push("팔로워증가");
    if (s.profileVisits > 0) bits.push("프로필방문");
    if (s.bookmarks > 0) bits.push("북마크");
    if (s.replies > 0) bits.push("댓글");
    if (s.detailExpands > 0) bits.push("상세열람");
    if (s.revenue > 0) bits.push("수익");
    const feat = s.features
      ? [
          s.features.topicGuess,
          s.features.subtopic,
          s.features.lengthBucket,
          s.features.hookStyle,
          s.features.writingApproach,
          s.features.mediaType,
        ]
          .filter(Boolean)
          .join("/")
      : "feature?";
    patterns.push(
      `[${s.weightedScore.toFixed(1)}] (${bits.join(", ") || "eng"}) ${feat}`
    );
  }

  const summaryKo =
    successes.length === 0
      ? "이번 주기 검증된 고성과 패턴이 거의 없음 — 기존 DNA 유지."
      : `검증 고성과 ${successes.length}건의 추상 패턴만 저장. 문장 원문은 기억하지 않음. 직접 쓴 성공은 AI 초안보다 높은 학습 신호.`;

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
  const manualWins = scored.filter(
    (s) => s.isSuccess && s.origin === "manual"
  );
  const structures: string[] = [];
  if (manualWins.length > 0) {
    structures.push(
      "USER_DIRECT success is a higher-value learning signal than AI drafts"
    );
  }

  return {
    writingRhythm: "UNCHANGED — Performance DNA must not overwrite Creator DNA",
    tone: "UNCHANGED — Performance DNA must not overwrite Creator DNA",
    hookStyle: "UNCHANGED — Performance DNA must not overwrite Creator DNA",
    observationStyle: "UNCHANGED — Performance DNA must not overwrite Creator DNA",
    analysisStyle: "UNCHANGED — Performance DNA must not overwrite Creator DNA",
    humorStyle: "UNCHANGED — Performance DNA must not overwrite Creator DNA",
    topicPreference: [],
    successfulStructures: structures,
    summaryKo:
      manualWins.length > 0
        ? `직접 쓴 고성과 ${manualWins.length}건은 높은 가치 신호. Creator DNA는 천천히. AP 성과는 Performance DNA로.`
        : "성과는 Performance DNA / Planner Memory로만. Creator DNA는 덮어쓰지 않음.",
  };
}

export function buildAudienceDnaHint(
  scored: ScoredPostMetrics[]
): AudienceDnaPayload {
  const published = scored.filter((s) => !s.features?.isReply);
  if (published.length === 0) {
    return {
      interestGraph: [],
      sentiment: "unknown",
      topicMovement: [],
      followerInterests: [],
      summaryKo:
        "Audience DNA: UNKNOWN / insufficient evidence. Primary source is X Analytics. Do not invent interest.",
    };
  }
  const topicScore: Record<string, number> = {};
  for (const s of published) {
    const t = s.features?.topicGuess;
    if (!t || t === "reply") continue;
    topicScore[t] =
      (topicScore[t] || 0) +
      (s.followersGained > 0 ? 4 : 0) +
      (s.profileVisits > 0 ? 3 : 0) +
      (s.bookmarks > 0 ? 2 : 0) +
      (s.replies > 0 ? 2 : 0);
  }
  const ranked = Object.entries(topicScore)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  return {
    interestGraph: ranked.slice(0, 10),
    sentiment: "unknown",
    topicMovement: ranked.slice(0, 5),
    followerInterests: ranked.slice(0, 8),
    summaryKo:
      ranked.length > 0
        ? `Audience DNA: X Analytics 주제 반응 ${ranked.length}개. Fedica는 보조. Creator DNA를 덮지 않음. 문장 원문 없음.`
        : "Audience DNA: UNKNOWN / insufficient evidence. Primary source is X Analytics.",
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
  const strategyWins: string[] = [];
  const actionTypeWins: string[] = [];

  for (const s of successes) {
    const reasons: string[] = [];
    if (s.followersGained > 0) reasons.push("팔로워 증가");
    if (s.profileVisits >= 5) reasons.push("프로필 유입");
    if (s.bookmarks >= 2) reasons.push("저장 가치");
    if (s.detailExpands >= 15) reasons.push("상세 읽기");
    if (s.replies >= 3) reasons.push("토론");
    if (s.features?.hasNumbers) reasons.push("숫자 근거");
    if (s.features && !s.features.isReply) reasons.push("원글");
    whyPatterns.push(
      `${reasons.join("+") || "engagement"} | ${s.features?.topicGuess || "?"} | ${s.features?.hookStyle || "hook?"} | ${s.origin === "manual" ? "MANUAL_PREMIUM" : s.origin}`
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

    if (s.features?.actionType && s.features.actionType !== "UNKNOWN") {
      actionTypeWins.push(s.features.actionType);
    } else if (s.features?.isReply) {
      actionTypeWins.push("REPLY");
    } else {
      actionTypeWins.push("ORIGINAL");
    }
    if (s.features?.writingApproach || s.features?.strategicAngle) {
      strategyWins.push(
        `${s.features.actionType || "ORIGINAL"} / ${s.features.topicGuess || "?"} / ${s.features.writingApproach || "?"}`
      );
    }
  }

  const lengthCount: Record<string, number> = {};
  for (const l of lengthWins) lengthCount[l] = (lengthCount[l] || 0) + 1;
  const topicCount: Record<string, number> = {};
  for (const t of topicWins) topicCount[t] = (topicCount[t] || 0) + 1;
  const actionCount: Record<string, number> = {};
  for (const a of actionTypeWins) actionCount[a] = (actionCount[a] || 0) + 1;
  const stratCount: Record<string, number> = {};
  for (const s of strategyWins) stratCount[s] = (stratCount[s] || 0) + 1;

  return {
    whyPatterns: whyPatterns.slice(0, 12),
    topStructures: [...new Set(topStructures)].slice(0, 8),
    lengthWins: Object.entries(lengthCount)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}×${v}`),
    topicWins: Object.entries(topicCount)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}×${v}`),
    strategyWins: Object.entries(stratCount)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}×${v}`)
      .slice(0, 12),
    actionTypeWins: Object.entries(actionCount)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}×${v}`),
    summaryKo:
      successes.length >= 2
        ? `Performance DNA: 반복 가능 신호 ${successes.length}건. 해석 순서는 팔로워→프로필→수익→북마크→댓글. Creator DNA를 덮어쓰지 않음.`
        : successes.length === 1
        ? "Performance DNA: 단일 고성과는 hypothesis. 반복 사이클 전까지 검증된 패턴이 아님."
        : "Performance DNA: UNKNOWN / insufficient evidence. 빈 값을 성공으로 쓰지 않음.",
  };
}

export function buildRevenueDna(
  scored: ScoredPostMetrics[],
  accountPayout?: { amountUsd: number; period?: string; nextPayout?: string } | null
): RevenueDnaPayload {
  const withRev = scored.filter((s) => s.revenue > 0);
  if (withRev.length === 0) {
    if (accountPayout && accountPayout.amountUsd > 0) {
      return {
        revenueByTopic: [],
        notes: [
          `계정 지급 ${accountPayout.amountUsd} USD (${accountPayout.period || "window"}). 글 단위 수익은 UNKNOWN.`,
          ...(accountPayout.nextPayout ? [`다음 지급 ${accountPayout.nextPayout}.`] : []),
          "영상 Estimated Revenue 0은 이 지급액이 아님.",
          "진정성·장기 신뢰보다 우선하지 않음. 한 슬라이스로 할당량을 올리지 않음. 글에 금액을 쓰지 않음.",
        ],
        summaryKo: `Revenue DNA: 계정 지급 ${accountPayout.amountUsd} USD부터 시작. 글 단위는 UNKNOWN. 전략을 지배하지 않음.`,
      };
    }
    return {
      revenueByTopic: [],
      notes: [
        "현재 수익 데이터 0 — Revenue DNA 대기",
        "진정성·장기 신뢰보다 우선하지 않음. Planner 최상위 목적을 침범하지 않음.",
      ],
      summaryKo: "Revenue DNA: UNKNOWN / insufficient evidence. 빈 수익을 성공 패턴으로 쓰지 않음. 전략을 지배하지 않음.",
    };
  }
  const byTopic: Record<string, number> = {};
  for (const s of withRev) {
    const t = s.features?.topicGuess || "other";
    byTopic[t] = (byTopic[t] || 0) + s.revenue;
  }
  const trustWarn = withRev.some(
    (s) => s.revenue > 0 && s.followersGained <= 0 && s.profileVisits <= 0 && s.bookmarks <= 0
  );
  return {
    revenueByTopic: Object.entries(byTopic)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`),
    notes: [
      `수익 포스트 ${withRev.length}건`,
      "진정성·장기 신뢰보다 우선하지 않음. Planner 최상위 목적을 침범하지 않음.",
      ...(trustWarn
        ? ["WARNING: 수익은 있으나 팔로워·프로필·북마크 신호가 약함 — 단기 수익이 신뢰/품질을 해칠 수 있음"]
        : []),
    ],
    summaryKo: `Revenue DNA: ${withRev.length}건 수익 신호. 전략을 지배하지 않음.`,
  };
}
