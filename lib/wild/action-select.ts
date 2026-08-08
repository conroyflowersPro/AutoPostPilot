/**
 * Wild Card ACTION SELECTION (v5.4.2)
 * Opportunity → ORIGINAL | QUOTE | REPOST | SKIP
 *
 * Required generation path:
 * DISCOVERY → FREE/GROWTH → ACTION → Creator Intelligence
 * → CLAIM GATE → CREATOR VOICE PASS → Creator suggestion
 */

export type WildAction = "ORIGINAL" | "QUOTE" | "REPOST" | "SKIP";
export type WildMode = "FREE" | "GROWTH";

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
  mode: WildMode;
};

export type ActionSelectionResult = {
  action: WildAction;
  reasonKo: string;
  targetGrowthObjective: string;
  confidence: "low" | "medium" | "high";
  requiresClaimGate: boolean;
  requiresCreatorVoicePass: boolean;
};

export function selectWildAction(op: WildOpportunity): ActionSelectionResult {
  const value = op.strategicValue || "low";
  const needsGates =
    op.mode === "GROWTH" ||
    Boolean(op.hasCreatorHistoricalEpisode) ||
    Boolean(op.creatorCanAddMeaning);

  if (value === "none") {
    return {
      action: "SKIP",
      reasonKo: "전략적 가치가 없어 스킵.",
      targetGrowthObjective: "balanced",
      confidence: "high",
      requiresClaimGate: false,
      requiresCreatorVoicePass: false,
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
      requiresClaimGate: true,
      requiresCreatorVoicePass: true,
    };
  }

  if (op.creatorCanAddMeaning || op.hasCurrentOpinion) {
    return {
      action: "ORIGINAL",
      reasonKo: "Creator가 의미 있는 관점을 추가할 수 있어 Original 프레임이 적합.",
      targetGrowthObjective:
        op.mode === "GROWTH" ? "followers" : "profile_visits",
      confidence: "medium",
      requiresClaimGate: true,
      requiresCreatorVoicePass: true,
    };
  }

  if (op.usefulToAudienceWithoutAddition) {
    return {
      action: "REPOST",
      reasonKo: "추가 의견은 약하지만 오디언스에 유용 — Repost가 적합.",
      targetGrowthObjective: "bookmarks",
      confidence: "medium",
      requiresClaimGate: false,
      requiresCreatorVoicePass: false,
    };
  }

  if (value === "low") {
    return {
      action: "SKIP",
      reasonKo: "가치 신호가 약해 스킵 권장.",
      targetGrowthObjective: "balanced",
      confidence: "low",
      requiresClaimGate: false,
      requiresCreatorVoicePass: false,
    };
  }

  return {
    action: "ORIGINAL",
    reasonKo: "기본: Creator 관점으로 재프레이밍 가능한 기회로 판단.",
    targetGrowthObjective: op.mode === "GROWTH" ? "followers" : "balanced",
    confidence: "low",
    requiresClaimGate: needsGates,
    requiresCreatorVoicePass: needsGates,
  };
}

export type ClaimGateInput = {
  action: WildAction;
  draftText: string;
  hasCreatorHistoricalEpisode?: boolean;
  hasCurrentOpinion?: boolean;
  claimsFirstPersonExperience?: boolean;
};

export type ClaimGateResult = {
  pass: boolean;
  reasonKo: string;
};

export function runClaimGate(input: ClaimGateInput): ClaimGateResult {
  if (input.action === "SKIP" || input.action === "REPOST") {
    return { pass: true, reasonKo: "Claim Gate 해당 없음." };
  }
  if (
    input.claimsFirstPersonExperience &&
    !input.hasCreatorHistoricalEpisode &&
    !input.hasCurrentOpinion
  ) {
    return {
      pass: false,
      reasonKo:
        "1인칭 경험 주장이 있으나 검증된 Creator episode/opinion 없음 — 차단.",
    };
  }
  return {
    pass: true,
    reasonKo: "Claim Gate 통과 (또는 1인칭 경험 주장 없음).",
  };
}
