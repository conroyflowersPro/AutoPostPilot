/**
 * Editorial portfolio helpers — diversity & narrowing detection.
 * Not mechanical category quotas.
 * v5.4.1: enforcePortfolioDiversity soft-replaces over-narrow plans.
 */

const CORE_CLUSTER = /fsd|cybertruck|로봇|로보택시|robotaxi|hw3|v14|lite|사이버/i;

export function topicClusterKey(topic: string): string {
  const t = (topic || "").toLowerCase();
  if (/fsd|hw3|v14|lite|자율|오토파일럿/.test(t)) return "fsd";
  if (/cybertruck|사이버/.test(t)) return "cybertruck";
  if (/robotaxi|로보택시|cybercab/.test(t)) return "robotaxi";
  if (/lafc|축구|리그|경기/.test(t)) return "lafc";
  if (/grok|xai|ai|앱|업무|개발/.test(t)) return "ai_work";
  if (/optimus|옵티머스|제조|스케일|에너지|인프라/.test(t)) return "ecosystem";
  if (/일상|가족|소유|팁|생활/.test(t)) return "daily";
  if (/투자|비전|장기/.test(t)) return "vision";
  if (/게임|도지|doge/.test(t)) return "side";
  return "other";
}

export type PortfolioStats = {
  totalSlots: number;
  clusterCounts: Record<string, number>;
  coreShare: number;
  uniqueClusters: number;
  narrowingRisk: "low" | "medium" | "high";
  noteKo: string;
};

export function analyzePortfolio(topics: string[]): PortfolioStats {
  const clusterCounts: Record<string, number> = {};
  for (const t of topics) {
    const k = topicClusterKey(t);
    clusterCounts[k] = (clusterCounts[k] || 0) + 1;
  }
  const total = topics.length || 1;
  const core =
    (clusterCounts.fsd || 0) +
    (clusterCounts.cybertruck || 0) +
    (clusterCounts.robotaxi || 0);
  const coreShare = core / total;
  const uniqueClusters = Object.keys(clusterCounts).length;

  let narrowingRisk: PortfolioStats["narrowingRisk"] = "low";
  if (coreShare >= 0.75 || uniqueClusters <= 2) narrowingRisk = "high";
  else if (coreShare >= 0.55 || uniqueClusters <= 3) narrowingRisk = "medium";

  const noteKo =
    narrowingRisk === "high"
      ? "주간 포트폴리오가 기존 Tesla 코어에 과도하게 수렴 — 확장 슬롯 강화 필요."
      : narrowingRisk === "medium"
        ? "코어 비중 높음 — expansion value 있는 슬롯을 일부 유지."
        : "클러스터 다양성 양호 — 정체성 유지와 확장 균형.";

  return {
    totalSlots: topics.length,
    clusterCounts,
    coreShare,
    uniqueClusters,
    narrowingRisk,
    noteKo,
  };
}

export function creatorIntentPresent(
  intentKeywords: string,
  topics: string[],
  angles: string[]
): boolean {
  const raw = (intentKeywords || "").trim();
  if (!raw) return true;
  const tokens = raw
    .split(/[,，、\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2)
    .slice(0, 12);
  if (tokens.length === 0) return true;
  const hay = (topics.join(" ") + " " + angles.join(" ")).toLowerCase();
  return tokens.some((tok) => hay.includes(tok));
}

export function isCoreHeavyTopic(topic: string): boolean {
  return CORE_CLUSTER.test(topic || "");
}

/** Authentic expansion candidates the Creator can own with evidence */
export const EXPANSION_CANDIDATES: Array<{
  primaryTopic: string;
  angle: string;
  contentType: string;
  targetLength: "short" | "medium" | "long";
  cluster: string;
}> = [
  {
    primaryTopic: "LAFC / 축구 일상",
    angle: "시즌·경기장에서 느낀 분위기와 팬 경험",
    contentType: "other_interest",
    targetLength: "short",
    cluster: "lafc",
  },
  {
    primaryTopic: "소유 팁 / 실사용 메모",
    angle: "장기 소유하면서 반복적으로 느낀 실용 디테일",
    contentType: "observation",
    targetLength: "short",
    cluster: "daily",
  },
  {
    primaryTopic: "앱·업무 / Grok·xAI 관찰",
    angle: "실제 사용·테스트하면서 느낀 실무 포인트",
    contentType: "observation",
    targetLength: "medium",
    cluster: "ai_work",
  },
  {
    primaryTopic: "장기 비전 / 제품 방향",
    angle: "단기 등락이 아닌 제품·인프라 관점의 개인 해석",
    contentType: "opinion",
    targetLength: "medium",
    cluster: "vision",
  },
  {
    primaryTopic: "솔직한 소유 비용·실패 메모",
    angle: "과장 없이 기록해 둔 실제 비용·불편 포인트",
    contentType: "observation",
    targetLength: "short",
    cluster: "daily",
  },
  {
    primaryTopic: "일상 운전 / 필드 관찰",
    angle: "특정 기능이 아닌 전체 운전 리듬에서 느낀 변화",
    contentType: "observation",
    targetLength: "medium",
    cluster: "daily",
  },
];

/**
 * Soft diversity guard: if portfolio is too narrow, replace 1–2 core slots
 * with authentic expansion candidates. DNA remains the writing lens.
 */
export function enforcePortfolioDiversity(
  days: any[],
  creatorIntent: string = ""
): { days: any[]; changed: boolean; note: string } {
  const allTopics = days.flatMap((d: any) =>
    (d.posts || []).map((p: any) => String(p.primaryTopic || ""))
  );
  const stats = analyzePortfolio(allTopics);
  if (stats.narrowingRisk === "low") {
    return { days, changed: false, note: stats.noteKo };
  }

  const replaceCount = stats.narrowingRisk === "high" ? 2 : 1;
  let replaced = 0;
  const usedClusters = new Set(
    allTopics.map((t) => topicClusterKey(t)).filter((c) => c !== "fsd" && c !== "cybertruck" && c !== "robotaxi")
  );

  const candidates = EXPANSION_CANDIDATES.filter(
    (c) => !usedClusters.has(c.cluster)
  );
  if (candidates.length === 0) {
    return { days, changed: false, note: stats.noteKo + " (확장 후보 소진)" };
  }

  const newDays = days.map((d: any) => {
    if (replaced >= replaceCount) return d;
    const posts = (d.posts || []).map((p: any) => {
      if (replaced >= replaceCount) return p;
      if (!isCoreHeavyTopic(String(p.primaryTopic || ""))) return p;
      const cand = candidates[replaced % candidates.length];
      replaced += 1;
      return {
        ...p,
        primaryTopic: cand.primaryTopic,
        angle: cand.angle,
        contentType: cand.contentType,
        targetLength: cand.targetLength,
        expansionValue: "high",
        creatorIntentAligned: true,
        postStrategy: p.postStrategy || {
          strategicAngle: "observation-first",
          hookStyle: "direct_observation",
          writingApproach: "observation",
          experienceUsage: "low",
          opinionStrength: "low",
          observationLevel: "medium",
          technicalDepth: "low",
          emotionalLevel: "low",
          predictionLevel: "none",
          questionUsage: false,
          ctaUsage: false,
          targetGrowthObjective: "expansion",
          mediaUsefulness: "optional",
          hypothesisNote: "다양성 가드레일 교체 슬롯 — 가설만, 게시 후 검증",
        },
      };
    });
    return { ...d, posts };
  });

  const newTopics = newDays.flatMap((d: any) =>
    (d.posts || []).map((p: any) => String(p.primaryTopic || ""))
  );
  const newStats = analyzePortfolio(newTopics);
  return {
    days: newDays,
    changed: replaced > 0,
    note:
      replaced > 0
        ? `다양성 가드레일: 코어 ${replaced}개 슬롯을 확장 후보로 교체. ${newStats.noteKo}`
        : stats.noteKo,
  };
}
