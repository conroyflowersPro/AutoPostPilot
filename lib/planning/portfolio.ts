/**
 * Editorial portfolio helpers — diversity & narrowing detection.
 * Not mechanical category quotas.
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

export function analyzePortfolio(
  topics: string[]
): PortfolioStats {
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
