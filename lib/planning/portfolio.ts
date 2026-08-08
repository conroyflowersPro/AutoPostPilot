/**
 * Editorial portfolio helpers — diversity & narrowing detection (v5.4.2)
 * Soft guardrail only. No hard category quotas.
 * Multi-signal: topic + angle + writing approach + sequence.
 * Expansion seeds are not a closed whitelist.
 */

const CORE_CLUSTER = /fsd|cybertruck|로봇|로보택시|robotaxi|hw3|v14|lite|사이버/i;

export type IntentStrength = "explicit_focus" | "preferred" | "open" | "absent";

export function topicClusterKey(topic: string): string {
  const t = (topic || "").toLowerCase();
  if (/fsd|hw3|v14|lite|자율|오토파일럿/.test(t)) return "fsd";
  if (/cybertruck|사이버/.test(t)) return "cybertruck";
  if (/robotaxi|로보택시|cybercab/.test(t)) return "robotaxi";
  if (/lafc|축구|리그|경기/.test(t)) return "lafc";
  if (/grok|xai|ai|앱|업무|개발/.test(t)) return "ai_work";
  if (/optimus|옵티머스|제조|스케일|에너지|인프라/.test(t)) return "ecosystem";
  if (/일상|가족|소유|팁|생활|비용|실패/.test(t)) return "daily";
  if (/투자|비전|장기/.test(t)) return "vision";
  if (/게임|도지|doge/.test(t)) return "side";
  return "other";
}

export type PortfolioStats = {
  totalSlots: number;
  clusterCounts: Record<string, number>;
  coreShare: number;
  uniqueClusters: number;
  approachRepetition: number;
  maxSameClusterRun: number;
  narrowingRisk: "low" | "medium" | "high";
  noteKo: string;
};

function normalizeAngleKey(angle: string): string {
  return String(angle || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

export function analyzePortfolio(
  topics: string[],
  angles: string[] = [],
  writingApproaches: string[] = []
): PortfolioStats {
  const clusterCounts: Record<string, number> = {};
  const clusters: string[] = [];
  for (const t of topics) {
    const k = topicClusterKey(t);
    clusterCounts[k] = (clusterCounts[k] || 0) + 1;
    clusters.push(k);
  }
  const total = topics.length || 1;
  const core =
    (clusterCounts.fsd || 0) +
    (clusterCounts.cybertruck || 0) +
    (clusterCounts.robotaxi || 0);
  const coreShare = core / total;
  const uniqueClusters = Object.keys(clusterCounts).length;

  const angleKeys = angles.map(normalizeAngleKey).filter(Boolean);
  const angleCounts: Record<string, number> = {};
  for (const a of angleKeys) angleCounts[a] = (angleCounts[a] || 0) + 1;
  const maxAngle = Math.max(0, ...Object.values(angleCounts));
  const angleRep = angleKeys.length ? maxAngle / angleKeys.length : 0;

  const wa = writingApproaches.map((w) => String(w || "observation").toLowerCase());
  const waCounts: Record<string, number> = {};
  for (const w of wa) waCounts[w] = (waCounts[w] || 0) + 1;
  const maxWa = Math.max(0, ...Object.values(waCounts));
  const waRep = wa.length ? maxWa / wa.length : 0;
  const approachRepetition = Math.max(angleRep, waRep);

  let maxRun = 1;
  let run = 1;
  for (let i = 1; i < clusters.length; i++) {
    if (clusters[i] === clusters[i - 1]) {
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else run = 1;
  }

  let narrowingRisk: PortfolioStats["narrowingRisk"] = "low";
  if (coreShare >= 0.75 || uniqueClusters <= 2 || approachRepetition >= 0.7 || maxRun >= 4) {
    narrowingRisk = "high";
  } else if (coreShare >= 0.55 || uniqueClusters <= 3 || approachRepetition >= 0.5 || maxRun >= 3) {
    narrowingRisk = "medium";
  }

  const noteKo =
    narrowingRisk === "high"
      ? "주간 포트폴리오가 주제·앵글·접근 방식에서 과도하게 수렴 — 확장 슬롯 강화 필요."
      : narrowingRisk === "medium"
        ? "코어/유사 앵글 비중 높음 — expansion value 있는 슬롯을 일부 유지."
        : "클러스터·앵글 다양성 양호 — 정체성 유지와 확장 균형.";

  return {
    totalSlots: topics.length,
    clusterCounts,
    coreShare,
    uniqueClusters,
    approachRepetition,
    maxSameClusterRun: maxRun,
    narrowingRisk,
    noteKo,
  };
}

export function classifyIntentStrength(intentKeywords: string): IntentStrength {
  const raw = (intentKeywords || "").trim();
  if (!raw) return "absent";
  const lower = raw.toLowerCase();
  if (/집중|focus|heavily|only|이번\s*주\s*만|반드시|꼭|주로\s*다뤄|core\s*focus|explicit/i.test(lower)) {
    return "explicit_focus";
  }
  const tokens = raw.split(/[,，、\s]+/).map((s) => s.trim()).filter((s) => s.length >= 2);
  if (tokens.length >= 3) return "open";
  if (tokens.length >= 1) return "preferred";
  return "open";
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

export const EXPANSION_SEED_CANDIDATES: Array<{
  primaryTopic: string;
  angle: string;
  contentType: string;
  cluster: string;
  expansionValue: "medium" | "high";
}> = [
  {
    primaryTopic: "LAFC / 축구 일상",
    angle: "경기장·시즌 분위기에서 느낀 현장 디테일",
    contentType: "other_interest",
    cluster: "lafc",
    expansionValue: "high",
  },
  {
    primaryTopic: "소유·일상 팁",
    angle: "실소유 경험에서 나온 실용 메모 (주차·적재·생활 접점)",
    contentType: "observation",
    cluster: "daily",
    expansionValue: "high",
  },
  {
    primaryTopic: "Grok / xAI 업무 관찰",
    angle: "실제 업무·테스트에서 느낀 제품·한도·컬렉션 포인트",
    contentType: "observation",
    cluster: "ai_work",
    expansionValue: "high",
  },
  {
    primaryTopic: "장기 비전 해석",
    angle: "제품·인프라 방향에 대한 개인 해석 (주가 제외)",
    contentType: "opinion",
    cluster: "vision",
    expansionValue: "medium",
  },
  {
    primaryTopic: "Optimus / 생태계 관찰",
    angle: "제조·스케일·에너지 접점에서 본 장기 그림",
    contentType: "opinion",
    cluster: "ecosystem",
    expansionValue: "medium",
  },
  {
    primaryTopic: "솔직한 소유 실패/비용",
    angle: "실제로 겪은 불편·비용·실수에서 나온 교훈",
    contentType: "observation",
    cluster: "daily",
    expansionValue: "high",
  },
  {
    primaryTopic: "게임 / 도지 가벼운 관찰",
    angle: "일상 취미 한 줄 관찰 (가볍게, 강요 없음)",
    contentType: "other_interest",
    cluster: "side",
    expansionValue: "medium",
  },
];

export const EXPANSION_CANDIDATES = EXPANSION_SEED_CANDIDATES;

export type EnforceOptions = {
  intentKeywords?: string;
  intentStrength?: IntentStrength;
};

export function enforcePortfolioDiversity(
  days: Array<{ dayOffset: number; posts: any[] }>,
  intentKeywordsOrOpts: string | EnforceOptions = ""
): { days: typeof days; changed: boolean; note: string; intentStrength: IntentStrength } {
  const opts: EnforceOptions =
    typeof intentKeywordsOrOpts === "string"
      ? { intentKeywords: intentKeywordsOrOpts }
      : intentKeywordsOrOpts || {};
  const intentKeywords = opts.intentKeywords || "";
  const intentStrength =
    opts.intentStrength || classifyIntentStrength(intentKeywords);

  const allTopics = days.flatMap((d) =>
    (d.posts || []).map((p) => String(p.primaryTopic || ""))
  );
  const allAngles = days.flatMap((d) =>
    (d.posts || []).map((p) => String(p.angle || ""))
  );
  const allApproaches = days.flatMap((d) =>
    (d.posts || []).map((p) =>
      String(p.postStrategy?.writingApproach || p.contentType || "observation")
    )
  );
  const stats = analyzePortfolio(allTopics, allAngles, allApproaches);

  if (stats.narrowingRisk === "low") {
    return { days, changed: false, note: stats.noteKo, intentStrength };
  }

  let maxReplace = stats.narrowingRisk === "high" ? 2 : 1;
  if (intentStrength === "explicit_focus") {
    maxReplace = Math.max(0, maxReplace - 1);
  } else if (intentStrength === "preferred" && stats.narrowingRisk === "medium") {
    maxReplace = Math.min(maxReplace, 1);
  }

  if (maxReplace === 0) {
    return {
      days,
      changed: false,
      note: stats.noteKo + " (Creator Intent explicit focus — 다양성 가드레일 완화)",
      intentStrength,
    };
  }

  let replaced = 0;
  const usedClusters = new Set(
    Object.entries(stats.clusterCounts)
      .filter(([, c]) => c > 0)
      .map(([k]) => k)
  );

  const candidates = EXPANSION_SEED_CANDIDATES.filter(
    (c) => !usedClusters.has(c.cluster) || (stats.clusterCounts[c.cluster] || 0) < 2
  );

  const intentToks = (intentKeywords || "")
    .split(/[,，、\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2);
  const ranked = [...candidates].sort((a, b) => {
    const aHit = intentToks.some((t) =>
      (a.primaryTopic + a.angle).toLowerCase().includes(t)
    );
    const bHit = intentToks.some((t) =>
      (b.primaryTopic + b.angle).toLowerCase().includes(t)
    );
    return Number(bHit) - Number(aHit);
  });

  const newDays = days.map((d) => ({
    ...d,
    posts: (d.posts || []).map((p) => ({ ...p })),
  }));

  const scoredSlots: Array<{ dayIdx: number; postIdx: number; score: number }> = [];
  newDays.forEach((day, di) => {
    (day.posts || []).forEach((p, pi) => {
      if (!isCoreHeavyTopic(String(p.primaryTopic || ""))) return;
      const cluster = topicClusterKey(String(p.primaryTopic || ""));
      const angleKey = normalizeAngleKey(String(p.angle || ""));
      const sameAngle = allAngles.filter(
        (a) => normalizeAngleKey(a) === angleKey && angleKey
      ).length;
      scoredSlots.push({
        dayIdx: di,
        postIdx: pi,
        score: (stats.clusterCounts[cluster] || 0) + sameAngle * 2,
      });
    });
  });
  scoredSlots.sort((a, b) => b.score - a.score);

  for (const slot of scoredSlots) {
    if (replaced >= maxReplace) break;
    const cand = ranked[replaced];
    if (!cand) break;
    const p = newDays[slot.dayIdx].posts[slot.postIdx];
    newDays[slot.dayIdx].posts[slot.postIdx] = {
      ...p,
      primaryTopic: cand.primaryTopic,
      subtopic: undefined,
      angle: cand.angle,
      contentType: cand.contentType,
      expansionValue: cand.expansionValue,
      creatorIntentAligned: intentToks.length
        ? intentToks.some((t) =>
            (cand.primaryTopic + cand.angle).toLowerCase().includes(t)
          )
        : true,
      postStrategy: {
        ...(p.postStrategy || {}),
        strategicAngle: cand.angle.slice(0, 120),
        hookStyle: p.postStrategy?.hookStyle || "direct_observation",
        writingApproach: p.postStrategy?.writingApproach || "observation",
        experienceUsage: p.postStrategy?.experienceUsage || "low",
        opinionStrength: p.postStrategy?.opinionStrength || "low",
        observationLevel: p.postStrategy?.observationLevel || "medium",
        technicalDepth: p.postStrategy?.technicalDepth || "none",
        emotionalLevel: p.postStrategy?.emotionalLevel || "low",
        predictionLevel: p.postStrategy?.predictionLevel || "none",
        questionUsage: p.postStrategy?.questionUsage ?? false,
        ctaUsage: p.postStrategy?.ctaUsage ?? false,
        targetGrowthObjective:
          cand.expansionValue === "high" ? "expansion" : "balanced",
        mediaUsefulness: p.postStrategy?.mediaUsefulness || "optional",
        hypothesisNote:
          "서버 soft 다양성 가드레일 교체 슬롯 — 가설만, 게시 후 검증. Expansion ≠ invented experience.",
      },
    };
    replaced += 1;
  }

  const newTopics = newDays.flatMap((d) =>
    (d.posts || []).map((p) => String(p.primaryTopic || ""))
  );
  const newAngles = newDays.flatMap((d) =>
    (d.posts || []).map((p) => String(p.angle || ""))
  );
  const newStats = analyzePortfolio(newTopics, newAngles);

  return {
    days: newDays,
    changed: replaced > 0,
    note:
      replaced > 0
        ? `다양성 가드레일: 유사 코어 ${replaced}개 슬롯 soft 교체. ${newStats.noteKo}`
        : stats.noteKo,
    intentStrength,
  };
}
