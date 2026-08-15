/**
 * Interest promotion: Exploration → Emerging → Secondary → Core.
 * One published success does not promote. Promote one step only after
 * growth signals repeat across analyze cycles (followers / profile visits /
 * bookmarks / meaningful replies).
 * Never overwrites Creator DNA core interests.
 */
import type { ScoredPostMetrics } from "./types";

export const INTEREST_STAGES = ["exploration", "emerging", "secondary", "core"] as const;
export type InterestStage = (typeof INTEREST_STAGES)[number];

export type InterestLadderEntry = {
  topic: string;
  stage: InterestStage;
  signalCycles: number;
};

/** Personal-interest originals already in Creator DNA — stay Core. */
export const CREATOR_CORE_TOPICS = new Set([
  "fsd_field",
  "cybertruck",
  "gaming",
  "lafc",
]);

const CYCLES_TO_PROMOTE = 2;

export function hasTopicGrowthSignal(posts: ScoredPostMetrics[]): boolean {
  const hits = posts.filter(
    (p) =>
      (Number(p.followersGained) || 0) > 0 ||
      (Number(p.profileVisits) || 0) > 0 ||
      (Number(p.bookmarks) || 0) > 0 ||
      (Number(p.replies) || 0) > 0,
  );
  return hits.length >= 1;
}

export function nextStage(stage: InterestStage): InterestStage {
  const i = INTEREST_STAGES.indexOf(stage);
  return INTEREST_STAGES[Math.min(INTEREST_STAGES.length - 1, i + 1)];
}

export function promoteInterestLadder(
  previous: InterestLadderEntry[] | null | undefined,
  scored: ScoredPostMetrics[],
): InterestLadderEntry[] {
  const prevMap = new Map<string, InterestLadderEntry>();
  for (const e of previous || []) {
    if (!e?.topic) continue;
    prevMap.set(e.topic, {
      topic: e.topic,
      stage: INTEREST_STAGES.includes(e.stage as InterestStage)
        ? (e.stage as InterestStage)
        : "exploration",
      signalCycles: Math.max(0, Number(e.signalCycles) || 0),
    });
  }

  const byTopic = new Map<string, ScoredPostMetrics[]>();
  for (const s of scored || []) {
    if (s.features?.isReply) continue;
    const topic = String(s.features?.topicGuess || "").trim();
    if (!topic || topic === "reply" || topic === "other") continue;
    const arr = byTopic.get(topic) || [];
    arr.push(s);
    byTopic.set(topic, arr);
  }

  const topics = new Set([...prevMap.keys(), ...byTopic.keys(), ...CREATOR_CORE_TOPICS]);
  const out: InterestLadderEntry[] = [];

  for (const topic of topics) {
    const coreLock = CREATOR_CORE_TOPICS.has(topic);
    const prev = prevMap.get(topic);
    let stage: InterestStage = coreLock ? "core" : prev?.stage || "exploration";
    let cycles = prev?.signalCycles || 0;
    const posts = byTopic.get(topic) || [];
    const signal = posts.length > 0 && hasTopicGrowthSignal(posts);

    if (coreLock) {
      out.push({ topic, stage: "core", signalCycles: signal ? Math.max(cycles, 1) : cycles });
      continue;
    }

    if (signal) cycles += 1;
    else cycles = 0;

    if (signal && cycles >= CYCLES_TO_PROMOTE && stage !== "core") {
      stage = nextStage(stage);
      cycles = 0;
    }

    out.push({ topic, stage, signalCycles: cycles });
  }

  return out.sort((a, b) => a.topic.localeCompare(b.topic));
}

export function interestLadderPromptLines(ladder: InterestLadderEntry[] | null | undefined): string[] {
  const rows = ladder || [];
  if (rows.length === 0) {
    return [
      "INTEREST LADDER: UNKNOWN / insufficient published+analytics cycles. Do not promote a topic from one result. Core Creator interests stay core.",
    ];
  }
  return [
    "INTEREST LADDER (Exploration → Emerging → Secondary → Core). Promote only after repeated growth/profile/bookmark/reply signals across cycles. Never from one post.",
    ...rows.slice(0, 12).map((e) => `${e.topic}: ${e.stage} (signalCycles ${e.signalCycles})`),
  ];
}
