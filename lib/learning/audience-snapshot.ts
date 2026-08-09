/**
 * Audience DNA — Snapshot History + Current State + Movement + Confidence
 * Fedica posting-time fields are NEVER stored or scored here.
 */

export type AudienceConfidence = "HIGH" | "MEDIUM" | "LOW";
export type MovementStatus =
  | "RISING"
  | "STABLE"
  | "DECLINING"
  | "NEW_SIGNAL"
  | "INSUFFICIENT_HISTORY";

export type AudienceSnapshot = {
  snapshot_id: string;
  batch_id: string;
  period_start: string | null;
  period_end: string | null;
  imported_at: string;
  source: "fedica";
  evidence_type: "audience_snapshot";
  composition: {
    geography?: Record<string, number | string>;
    language?: Record<string, number | string>;
    occupation?: Record<string, number | string>;
    age?: Record<string, number | string>;
    gender?: Record<string, number | string>;
    accountAge?: Record<string, number | string>;
  };
  quality?: {
    audienceQuality?: string | number;
    activity?: string | number;
    newFollowers?: number;
    unfollows?: number;
  };
  engagement?: { topThemes?: string[]; engagerNotes?: string[] };
  affinity?: { alsoFollow?: Array<{ name: string; share?: number | string }> };
  interests?: string[];
  topicCategories?: string[];
  sentiment?: string;
  coverage_note?: string;
};

export type AudienceMovementItem = {
  signal: string;
  from?: string | number;
  to?: string | number;
  status: MovementStatus;
  confidence: AudienceConfidence;
  note?: string;
};

export type AudienceCurrentState = {
  as_of_snapshot_id: string;
  composition_summary: string[];
  quality_summary: string[];
  affinity_summary: string[];
  interests: string[];
  sentiment: string;
  confidence: AudienceConfidence;
};

export type AudienceIntelligenceForPlanner = {
  current_state: AudienceCurrentState;
  movement: AudienceMovementItem[];
  snapshot_count: number;
  history_note: string;
  usage: "strategic_context_only";
};

const TIME_NOISE =
  /best\s*time|posting\s*time|time\s*zone|timezone|reach by time|followers by time|최적.*시간|게시\s*시간|타임존|following demographics/i;

export function stripPostingTimeFields<T extends Record<string, unknown>>(
  input: T
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (TIME_NOISE.test(k) || TIME_NOISE.test(String(v))) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

export function filterInterestList(items: string[]): string[] {
  return (items || [])
    .map((x) => String(x).trim())
    .filter((x) => x && !TIME_NOISE.test(x))
    .slice(0, 40);
}

export function createAudienceSnapshot(input: {
  batch_id: string;
  period_start?: string | null;
  period_end?: string | null;
  interests?: string[];
  topicCategories?: string[];
  sentiment?: string;
  composition?: AudienceSnapshot["composition"];
  quality?: AudienceSnapshot["quality"];
  engagement?: AudienceSnapshot["engagement"];
  affinity?: AudienceSnapshot["affinity"];
  coverage_note?: string;
}): AudienceSnapshot {
  const id = `aud-snap-${input.batch_id}-${Date.now()}`;
  return {
    snapshot_id: id,
    batch_id: input.batch_id,
    period_start: input.period_start || null,
    period_end: input.period_end || null,
    imported_at: new Date().toISOString(),
    source: "fedica",
    evidence_type: "audience_snapshot",
    composition: input.composition || {},
    quality: input.quality,
    engagement: input.engagement,
    affinity: input.affinity,
    interests: filterInterestList(input.interests || []),
    topicCategories: filterInterestList(input.topicCategories || []),
    sentiment: input.sentiment || "unknown",
    coverage_note: input.coverage_note,
  };
}

export function buildCurrentState(
  snap: AudienceSnapshot,
  confidence: AudienceConfidence = "MEDIUM"
): AudienceCurrentState {
  const composition_summary: string[] = [];
  if (snap.composition?.language)
    composition_summary.push(
      `language: ${JSON.stringify(snap.composition.language).slice(0, 120)}`
    );
  if (snap.composition?.geography)
    composition_summary.push(
      `geo: ${JSON.stringify(snap.composition.geography).slice(0, 120)}`
    );
  if (snap.composition?.occupation)
    composition_summary.push(
      `occupation: ${JSON.stringify(snap.composition.occupation).slice(0, 120)}`
    );

  const quality_summary: string[] = [];
  if (snap.quality?.audienceQuality != null)
    quality_summary.push(`quality: ${snap.quality.audienceQuality}`);
  if (snap.quality?.activity != null)
    quality_summary.push(`activity: ${snap.quality.activity}`);
  if (snap.quality?.newFollowers != null)
    quality_summary.push(`new_followers: ${snap.quality.newFollowers}`);

  const affinity_summary =
    snap.affinity?.alsoFollow?.slice(0, 8).map((a) =>
      a.share != null ? `${a.name} (${a.share})` : a.name
    ) || [];

  return {
    as_of_snapshot_id: snap.snapshot_id,
    composition_summary,
    quality_summary,
    affinity_summary,
    interests: snap.interests || [],
    sentiment: snap.sentiment || "unknown",
    confidence,
  };
}

export function computeAudienceMovement(
  previous: AudienceSnapshot | null,
  current: AudienceSnapshot
): AudienceMovementItem[] {
  if (!previous) {
    return [
      {
        signal: "audience_history",
        status: "INSUFFICIENT_HISTORY",
        confidence: "LOW",
        note: "Single snapshot only — no movement inference",
      },
    ];
  }
  const items: AudienceMovementItem[] = [];
  const prevI = new Set(previous.interests || []);
  const currI = new Set(current.interests || []);
  for (const i of currI) {
    if (!prevI.has(i)) {
      items.push({
        signal: `interest:${i}`,
        status: "NEW_SIGNAL",
        confidence: "LOW",
        note: "Appeared in latest snapshot only",
      });
    }
  }
  const prevAff = new Set(
    (previous.affinity?.alsoFollow || []).map((a) => a.name.toLowerCase())
  );
  for (const a of current.affinity?.alsoFollow || []) {
    if (!prevAff.has(a.name.toLowerCase())) {
      items.push({
        signal: `affinity:${a.name}`,
        status: "NEW_SIGNAL",
        confidence: "LOW",
      });
    }
  }
  if (items.length === 0) {
    items.push({
      signal: "overall",
      status: "STABLE",
      confidence: "MEDIUM",
      note: "No clear interest/affinity deltas between snapshots",
    });
  }
  return items.slice(0, 20);
}

export function audienceConfidence(opts: {
  snapshotCount: number;
  hasComposition: boolean;
  hasAffinity: boolean;
  interestCount: number;
}): AudienceConfidence {
  let score = 0;
  if (opts.snapshotCount >= 3) score += 2;
  else if (opts.snapshotCount === 2) score += 1;
  if (opts.hasComposition) score += 1;
  if (opts.hasAffinity) score += 1;
  if (opts.interestCount >= 5) score += 1;
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

export function buildAudienceIntelligenceForPlanner(
  snapshots: AudienceSnapshot[]
): AudienceIntelligenceForPlanner {
  const sorted = [...snapshots].sort((a, b) =>
    a.imported_at.localeCompare(b.imported_at)
  );
  const current = sorted[sorted.length - 1];
  if (!current) {
    return {
      current_state: {
        as_of_snapshot_id: "none",
        composition_summary: [],
        quality_summary: [],
        affinity_summary: [],
        interests: [],
        sentiment: "unknown",
        confidence: "LOW",
      },
      movement: [
        {
          signal: "audience_history",
          status: "INSUFFICIENT_HISTORY",
          confidence: "LOW",
        },
      ],
      snapshot_count: 0,
      history_note: "No audience snapshots yet",
      usage: "strategic_context_only",
    };
  }
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const conf = audienceConfidence({
    snapshotCount: sorted.length,
    hasComposition: Object.keys(current.composition || {}).length > 0,
    hasAffinity: (current.affinity?.alsoFollow?.length || 0) > 0,
    interestCount: current.interests?.length || 0,
  });
  return {
    current_state: buildCurrentState(current, conf),
    movement: computeAudienceMovement(prev, current),
    snapshot_count: sorted.length,
    history_note:
      sorted.length < 2
        ? "First snapshot — movement not inferred"
        : `${sorted.length} snapshots retained; current relevance prioritized`,
    usage: "strategic_context_only",
  };
}

export function formatAudienceIntelligenceForPlanner(
  intel: AudienceIntelligenceForPlanner
): string {
  const lines = [
    "AUDIENCE DNA (strategic context only — not writing topics)",
    `Snapshot count: ${intel.snapshot_count}`,
    `Confidence: ${intel.current_state.confidence}`,
    `Sentiment: ${intel.current_state.sentiment}`,
    intel.current_state.composition_summary.length
      ? `Composition: ${intel.current_state.composition_summary.join(" · ")}`
      : "Composition: (thin)",
    intel.current_state.interests.length
      ? `Interests (signals): ${intel.current_state.interests.slice(0, 12).join(", ")}`
      : "Interests: (none)",
    intel.current_state.affinity_summary.length
      ? `Affinity: ${intel.current_state.affinity_summary.slice(0, 6).join(", ")}`
      : "Affinity: (none)",
    "Movement:",
    ...intel.movement.slice(0, 8).map(
      (m) =>
        `- ${m.signal}: ${m.status} (${m.confidence})${m.note ? ` — ${m.note}` : ""}`
    ),
    intel.history_note,
    "Do NOT copy interests as primaryTopic. Translate only when Creator DNA allows.",
  ];
  return lines.join("\n");
}
