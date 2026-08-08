/**
 * Wild Card ACTION SELECTION
 * Opportunity → ORIGINAL | QUOTE | REPOST | SKIP
 * Hypothesis only — validated later by real X outcomes.
 */

export type WildAction = "ORIGINAL" | "QUOTE" | "REPOST" | "SKIP";

export type WildOpportunity = {
  summary: string;
  sourceUrl?: string;
  sourceAuthor?: string;
  topicGuess?: string;
  hasCreatorHistoricalEpisode?: boolean;
  hasCurrentOpinion?: boolean;
  creatorCanAddMeaning?: boolean;
  usefulToAudienceWithoutAddition?: boolean;
  strategicValue?: "none" | "low" | "medium" | "high";
  mode: "FREE" | "GROWTH";
};

export type ActionSelectionResult = {
  action: WildAction;
  reasonKo: string;
  targetGrowthObjective: string;
  confidence: "low" | "medium" | "high";
};

export function selectWildAction(op: WildOpportunity): ActionSelectionResult {
  const value = op.strategicValue || "low";

  if (value === "none") {
    return {
      action: "SKIP",
      reasonKo: "전략적 가치가 없어 스킵.",
      targetGrowthObjective: "balanced",
      confidence: "high",
    };
  }

  if (
    op.hasCreatorHistoricalEpisode &&
    (op.hasCurrentOpinion || op.creatorCanAddMeaning)
  ) {
    return {
      action: "QUOTE",
      reasonKo:
        "과거 경험·현재 의견과 연결 시 맥락 가치가 커져 Quote가 Original보다 유리할 수 있음.",
      targetGrowthObjective: "replies",
      confidence: "medium",
    };
  }

  if (op.creatorCanAddMeaning || op.hasCurrentOpinion) {
    return {
      action: "ORIGINAL",
      reasonKo: "Creator가 의미 있는 관점을 추가할 수 있어 Original 프레임이 적합.",
      targetGrowthObjective:
        op.mode === "GROWTH" ? "followers" : "profile_visits",
      confidence: "medium",
    };
  }

  if (op.usefulToAudienceWithoutAddition) {
    return {
      action: "REPOST",
      reasonKo: "추가 의견은 약하지만 오디언스에 유용 — Repost가 적합.",
      targetGrowthObjective: "bookmarks",
      confidence: "medium",
    };
  }

  if (value === "low") {
    return {
      action: "SKIP",
      reasonKo: "가치 신호가 약해 스킵 권장.",
      targetGrowthObjective: "balanced",
      confidence: "low",
    };
  }

  return {
    action: "ORIGINAL",
    reasonKo: "기본: Creator 관점으로 재프레이밍 가능한 기회로 판단.",
    targetGrowthObjective: op.mode === "GROWTH" ? "followers" : "balanced",
    confidence: "low",
  };
}
