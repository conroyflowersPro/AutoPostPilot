/**
 * ORDER 4 — Audience Reaction Intelligence
 * Not a "will people like this" predictor.
 * Understands likely psychological reaction. Does not manipulate reaction.
 * NEVER: few-shot wording, copy comments, topic→mechanism map, Creator DNA from audience text.
 * NEVER: silent paid X API. Unpublished AI drafts are not evidence.
 */
export const ORDER4_VERSION = "order4_audience_reaction_v1";
export const ORDER4_NO_TOPIC_MECHANISM_MAP = true as const;
export const ORDER4_RAW_TEXT_NOT_FOR_GENERATION = true as const;
export const ORDER4_NO_INDIVIDUAL_PROFILING = true as const;

/** Published origin classification (premium signal for manual) */
export type PublishedOriginClass =
  | "MANUAL_PUBLISHED"
  | "AI_ASSISTED_PUBLISHED"
  | "UNKNOWN_PUBLISHED"
  | "UNPUBLISHED_AI";

/** Reader behavior taxonomy — multi-label allowed */
export type ReaderBehaviorCategory =
  | "PERSONAL_STORY"
  | "SHARED_EXPERIENCE"
  | "SELF_COMPARISON"
  | "AGREEMENT"
  | "DISAGREEMENT"
  | "EXCEPTION"
  | "CORRECTION"
  | "ADDITIONAL_INFORMATION"
  | "MEMORY_RECALL"
  | "HABIT_DISCLOSURE"
  | "PREFERENCE_DISCLOSURE"
  | "OPINION_DISCLOSURE"
  | "QUESTION"
  | "HUMOR_RESPONSE"
  | "SOCIAL_SUPPORT"
  | "CURIOSITY"
  | "DEBATE"
  | "EMOJI_ONLY"
  | "LOW_INFORMATION"
  | "IRRELEVANT"
  | "SPAM"
  | "OTHER";

export type StoryInvitationLevel = "STRONG" | "MODERATE" | "WEAK" | "NONE";
export type ParticipationBarrierLevel = "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
export type ComprehensionBarrierLevel = "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
export type MechanismValidationState =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "NOT_SUPPORTED"
  | "INSUFFICIENT_EVIDENCE";
export type AudienceEvidenceStatus =
  | "ELIGIBLE"
  | "ANALYZED"
  | "SKIPPED_UNPUBLISHED"
  | "SKIPPED_NO_ID"
  | "SKIPPED_DRAFT"
  | "INSUFFICIENT_EVIDENCE";

export type SelfProjectionEvidence = {
  readers_shared_experience: boolean;
  readers_compared_self: boolean;
  readers_recalled_memory: boolean;
  readers_disclosed_habit: boolean;
  readers_supplied_example: boolean;
  readers_expressed_opinion: boolean;
  readers_challenged_claim: boolean;
  readers_asked_detail: boolean;
  readers_reacted_without_projection: boolean;
  self_projection_strength: "STRONG" | "MODERATE" | "WEAK" | "NONE" | "UNKNOWN";
};

export type PerformanceContextLite = {
  impressions?: number | null;
  likes?: number | null;
  replies?: number | null;
  reposts?: number | null;
  quotes?: number | null;
  bookmarks?: number | null;
  profile_visits?: number | null;
  followers_gained?: number | null;
};

export type AudienceReactionRecord = {
  published_post_id: string;
  source_role?: string | null;
  published_origin: PublishedOriginClass;
  audience_evidence_status: AudienceEvidenceStatus;
  reply_count_analyzed: number;
  meaningful_reply_count: number;
  reader_behavior_distribution: Partial<Record<ReaderBehaviorCategory, number>>;
  dominant_reader_behaviors: ReaderBehaviorCategory[];
  self_projection_evidence: SelfProjectionEvidence;
  story_invitation_evidence: StoryInvitationLevel;
  participation_barrier_evidence: ParticipationBarrierLevel;
  comprehension_barrier_evidence: ComprehensionBarrierLevel;
  predicted_reaction_mechanism: string | null;
  mechanism_validation: MechanismValidationState;
  evidence_confidence: number; // 0..1
  creator_origin_weight: number; // manual higher
  performance_context: PerformanceContextLite;
  analyzed_at: string;
  order4_version: string;
  /** Never for generation — internal classification only; omit raw text from persisted paths */
  _raw_text_retained_for_generation: false;
};

export type AggregateAudienceMemory = {
  aggregate_id: string;
  period_start?: string | null;
  period_end?: string | null;
  posts_analyzed: number;
  manual_posts_analyzed: number;
  ai_assisted_posts_analyzed: number;
  reader_behavior_totals: Partial<Record<ReaderBehaviorCategory, number>>;
  strong_self_projection_rate: number | null;
  story_invitation_distribution: Partial<Record<StoryInvitationLevel, number>>;
  mechanism_validation_rates: Partial<Record<MechanismValidationState, number>>;
  participation_barrier_tendencies: Partial<Record<ParticipationBarrierLevel, number>>;
  /** Contextual patterns only — NOT topic→mechanism deterministic maps */
  contextual_patterns: string[];
  confidence: number;
  updated_at: string;
  order4_version: string;
  contains_raw_comment_examples: false;
};

export type ReplyInput = {
  reply_id?: string;
  /** Transient classification input only — never persist into generation paths */
  text?: string | null;
  is_spam?: boolean;
  is_emoji_only?: boolean;
};

export type PublishedPostInput = {
  published_post_id?: string | null;
  is_published: boolean;
  is_ai_draft?: boolean;
  is_rejected_draft?: boolean;
  published_origin?: PublishedOriginClass | null;
  source_role?: string | null;
  predicted_reaction_mechanism?: string | null;
  replies?: ReplyInput[];
  performance?: PerformanceContextLite;
  analyzed_at?: string;
};

const MEANINGFUL: Set<ReaderBehaviorCategory> = new Set([
  "PERSONAL_STORY",
  "SHARED_EXPERIENCE",
  "SELF_COMPARISON",
  "MEMORY_RECALL",
  "HABIT_DISCLOSURE",
  "PREFERENCE_DISCLOSURE",
  "OPINION_DISCLOSURE",
  "ADDITIONAL_INFORMATION",
  "EXCEPTION",
  "CORRECTION",
  "DEBATE",
  "QUESTION",
  "CURIOSITY",
]);

const SELF_PROJ: Set<ReaderBehaviorCategory> = new Set([
  "PERSONAL_STORY",
  "SHARED_EXPERIENCE",
  "SELF_COMPARISON",
  "MEMORY_RECALL",
  "HABIT_DISCLOSURE",
  "PREFERENCE_DISCLOSURE",
]);

/** Lightweight structural classifiers — NOT generation templates */
const PATTERNS: Array<{ cat: ReaderBehaviorCategory; re: RegExp }> = [
  // Note: avoid relying on \b for Hangul (JS word boundaries are ASCII-oriented)
  { cat: "PERSONAL_STORY", re: /(i (once|remember|had|was|went|tried)|my (car|drive|experience|story)|저도|나는|제가|예전에|그때)/i },
  { cat: "SHARED_EXPERIENCE", re: /(same here|me too|같은 경험|저도\s*그래|완전\s*동감|나도\s*그)/i },
  { cat: "SELF_COMPARISON", re: /(compared to me|for me|내\s*경우|저는\s*반대로|나는\s*다름)/i },
  { cat: "AGREEMENT", re: /(agree|exactly|맞아요|동의|그죠|팩트)/i },
  { cat: "DISAGREEMENT", re: /(disagree|nope|아닌데|반대|그건\s*아닌)/i },
  { cat: "EXCEPTION", re: /(except|unless|다만|예외|근데\s*나는)/i },
  { cat: "CORRECTION", re: /(actually|correction|정정|사실\s*은|그게\s*아니라)/i },
  { cat: "ADDITIONAL_INFORMATION", re: /(also|btw|참고로|추가로|그리고\s*하나)/i },
  { cat: "MEMORY_RECALL", re: /(remember when|예전에|기억나|그때\s*그)/i },
  { cat: "HABIT_DISCLOSURE", re: /(i always|i usually|나는\s*맨날|습관|매번)/i },
  { cat: "PREFERENCE_DISCLOSURE", re: /(i prefer|i like|나는\s*이게|선호|더\s*좋아)/i },
  { cat: "OPINION_DISCLOSURE", re: /(i think|imo|내\s*생각|개인적으로|솔직히)/i },
  { cat: "QUESTION", re: /\?|吗|까요|나요|인가요|\bhow\b|\bwhat\b|왜|어떻게/i },
  { cat: "HUMOR_RESPONSE", re: /(lol|lmao|ㅋㅋ|ㅎㅎ|haha)/i },
  { cat: "SOCIAL_SUPPORT", re: /(congrats|화이팅|응원|대단|\bnice\b)/i },
  { cat: "CURIOSITY", re: /(curious|wonder|궁금|알고\s*싶)/i },
  { cat: "DEBATE", re: /(\bbut\b|however|반론|그런데\s*말이야)/i },
];

export function classifyReplyBehaviors(reply: ReplyInput): ReaderBehaviorCategory[] {
  if (reply.is_spam) return ["SPAM"];
  if (reply.is_emoji_only) return ["EMOJI_ONLY"];
  const text = (reply.text || "").trim();
  if (!text) return ["LOW_INFORMATION"];
  if (text.length <= 2) return ["LOW_INFORMATION"];
  const out: ReaderBehaviorCategory[] = [];
  for (const { cat, re } of PATTERNS) {
    if (re.test(text)) out.push(cat);
  }
  if (out.length === 0) out.push("OTHER");
  // multi-label allowed — dedupe
  return Array.from(new Set(out));
}

export function isEligiblePublishedEvidence(post: PublishedPostInput): {
  eligible: boolean;
  status: AudienceEvidenceStatus;
  reason?: string;
} {
  if (post.is_ai_draft || post.is_rejected_draft) {
    return { eligible: false, status: "SKIPPED_DRAFT", reason: "unpublished_or_rejected_ai_draft" };
  }
  if (!post.is_published) {
    return { eligible: false, status: "SKIPPED_UNPUBLISHED", reason: "not_published" };
  }
  if (post.published_origin === "UNPUBLISHED_AI") {
    return { eligible: false, status: "SKIPPED_UNPUBLISHED", reason: "unpublished_ai_origin" };
  }
  if (!post.published_post_id) {
    return { eligible: false, status: "SKIPPED_NO_ID", reason: "missing_published_post_id" };
  }
  return { eligible: true, status: "ELIGIBLE" };
}

export function resolvePublishedOrigin(post: PublishedPostInput): PublishedOriginClass {
  if (post.published_origin) return post.published_origin;
  if (post.is_ai_draft || !post.is_published) return "UNPUBLISHED_AI";
  if (post.source_role === "CREATOR_LEARNING_SIGNAL" || post.source_role === "USER_EXPLICIT_SEED") {
    return "MANUAL_PUBLISHED";
  }
  return "UNKNOWN_PUBLISHED";
}

export function creatorOriginWeight(origin: PublishedOriginClass): number {
  switch (origin) {
    case "MANUAL_PUBLISHED":
      return 1.0;
    case "AI_ASSISTED_PUBLISHED":
      return 0.55;
    case "UNKNOWN_PUBLISHED":
      return 0.4;
    default:
      return 0;
  }
}

function emptySelfProjection(): SelfProjectionEvidence {
  return {
    readers_shared_experience: false,
    readers_compared_self: false,
    readers_recalled_memory: false,
    readers_disclosed_habit: false,
    readers_supplied_example: false,
    readers_expressed_opinion: false,
    readers_challenged_claim: false,
    readers_asked_detail: false,
    readers_reacted_without_projection: false,
    self_projection_strength: "UNKNOWN",
  };
}

export function buildSelfProjectionEvidence(
  dist: Partial<Record<ReaderBehaviorCategory, number>>,
  replyCount: number
): SelfProjectionEvidence {
  const e = emptySelfProjection();
  if (replyCount === 0) {
    e.self_projection_strength = "UNKNOWN";
    return e;
  }
  e.readers_shared_experience = (dist.SHARED_EXPERIENCE || 0) + (dist.PERSONAL_STORY || 0) > 0;
  e.readers_compared_self = (dist.SELF_COMPARISON || 0) > 0;
  e.readers_recalled_memory = (dist.MEMORY_RECALL || 0) > 0;
  e.readers_disclosed_habit = (dist.HABIT_DISCLOSURE || 0) > 0;
  e.readers_supplied_example = (dist.PERSONAL_STORY || 0) + (dist.ADDITIONAL_INFORMATION || 0) > 0;
  e.readers_expressed_opinion = (dist.OPINION_DISCLOSURE || 0) > 0;
  e.readers_challenged_claim =
    (dist.DISAGREEMENT || 0) + (dist.CORRECTION || 0) + (dist.DEBATE || 0) > 0;
  e.readers_asked_detail = (dist.QUESTION || 0) + (dist.CURIOSITY || 0) > 0;
  const projHits = Array.from(SELF_PROJ).reduce((s, k) => s + (dist[k] || 0), 0);
  const shallow =
    (dist.AGREEMENT || 0) + (dist.EMOJI_ONLY || 0) + (dist.LOW_INFORMATION || 0) + (dist.SOCIAL_SUPPORT || 0);
  e.readers_reacted_without_projection = projHits === 0 && shallow > 0;
  if (projHits >= 3) e.self_projection_strength = "STRONG";
  else if (projHits >= 2) e.self_projection_strength = "MODERATE";
  else if (projHits >= 1) e.self_projection_strength = "WEAK";
  else e.self_projection_strength = "NONE";
  return e;
}

/**
 * Story invitation from behavior quality, NOT reply count alone.
 * Few meaningful personal replies can still be STRONG.
 * High shallow reply count must not auto-STRONG.
 */
export function evaluateStoryInvitation(
  dist: Partial<Record<ReaderBehaviorCategory, number>>,
  meaningfulCount: number,
  replyCount: number
): StoryInvitationLevel {
  if (replyCount === 0) return "NONE";
  const personal =
    (dist.PERSONAL_STORY || 0) +
    (dist.SHARED_EXPERIENCE || 0) +
    (dist.SELF_COMPARISON || 0) +
    (dist.MEMORY_RECALL || 0) +
    (dist.HABIT_DISCLOSURE || 0);
  const shallow =
    (dist.AGREEMENT || 0) + (dist.EMOJI_ONLY || 0) + (dist.LOW_INFORMATION || 0) + (dist.HUMOR_RESPONSE || 0);
  if (personal >= 2 || (personal >= 1 && meaningfulCount >= 2 && personal >= shallow)) return "STRONG";
  if (personal >= 1 || meaningfulCount >= 2) return "MODERATE";
  if (meaningfulCount >= 1 || (dist.OPINION_DISCLOSURE || 0) > 0) return "WEAK";
  // agreement alone ≠ story invitation
  if (shallow > 0 && personal === 0) return "NONE";
  return "NONE";
}

/**
 * Participation barrier independent of engagement volume.
 */
export function evaluateParticipationBarrier(
  dist: Partial<Record<ReaderBehaviorCategory, number>>,
  replyCount: number
): ParticipationBarrierLevel {
  if (replyCount === 0) return "UNKNOWN";
  const personal =
    (dist.PERSONAL_STORY || 0) + (dist.SHARED_EXPERIENCE || 0) + (dist.HABIT_DISCLOSURE || 0);
  const simple = (dist.AGREEMENT || 0) + (dist.DISAGREEMENT || 0) + (dist.EMOJI_ONLY || 0);
  const expertish = (dist.CORRECTION || 0) + (dist.ADDITIONAL_INFORMATION || 0) + (dist.DEBATE || 0);
  const categories = Object.keys(dist).filter((k) => (dist[k as ReaderBehaviorCategory] || 0) > 0).length;
  if (personal > 0 && simple > 0 && categories >= 3) return "VERY_LOW";
  if (personal > 0 || simple >= 2) return "LOW";
  if (expertish > 0 && personal === 0 && simple === 0) return "HIGH";
  if (categories >= 2) return "MODERATE";
  return "MODERATE";
}

export function evaluateComprehensionBarrier(
  dist: Partial<Record<ReaderBehaviorCategory, number>>,
  replyCount: number
): ComprehensionBarrierLevel {
  if (replyCount === 0) return "UNKNOWN";
  const clarify = (dist.QUESTION || 0) + (dist.CORRECTION || 0);
  const relevant =
    (dist.AGREEMENT || 0) +
    (dist.DISAGREEMENT || 0) +
    (dist.PERSONAL_STORY || 0) +
    (dist.OPINION_DISCLOSURE || 0);
  if (clarify >= 2 && relevant === 0) return "HIGH";
  if (clarify >= 1) return "MODERATE";
  if (relevant > 0) return "LOW";
  return "UNKNOWN";
}

/**
 * Mechanism validation: compare predicted mechanism to actual behavior.
 * NO topic→mechanism mapping.
 */
export function validateReactionMechanism(
  predicted: string | null | undefined,
  dist: Partial<Record<ReaderBehaviorCategory, number>>,
  replyCount: number,
  selfProj: SelfProjectionEvidence
): MechanismValidationState {
  if (replyCount === 0 || !predicted || predicted === "NONE") {
    return "INSUFFICIENT_EVIDENCE";
  }
  const id = predicted;
  let hits = 0;
  let expected = 0;
  const has = (c: ReaderBehaviorCategory) => (dist[c] || 0) > 0;

  // Behavior expectations by mechanism family — structural, not topic
  if (id.includes("EXPERIENCE") || id.includes("EMPATHY") || id === "M2_EXPERIENCE_EMPATHY") {
    expected = 1;
    if (selfProj.readers_shared_experience || has("PERSONAL_STORY") || has("SHARED_EXPERIENCE")) hits++;
  } else if (id.includes("DEBATE") || id.includes("SURPRISE") || id === "M1_SURPRISE_DEBATE_CHANGE") {
    expected = 1;
    if (has("DISAGREEMENT") || has("DEBATE") || has("CORRECTION") || has("OPINION_DISCLOSURE")) hits++;
  } else if (id.includes("BLANK") || id === "M9_EVERYDAY_BLANK_FILLING") {
    expected = 1;
    if (has("QUESTION") === false && (has("ADDITIONAL_INFORMATION") || has("PERSONAL_STORY") || has("HABIT_DISCLOSURE")))
      hits++;
    else if (has("ADDITIONAL_INFORMATION") || has("HABIT_DISCLOSURE") || has("PREFERENCE_DISCLOSURE")) hits++;
  } else if (id.includes("SELF_DEPRECATING") || id === "M8_SELF_DEPRECATING_DISCLOSURE") {
    expected = 1;
    if (has("SOCIAL_SUPPORT") || has("SHARED_EXPERIENCE") || has("PERSONAL_STORY")) hits++;
  } else if (id.includes("LIFE_PATTERN") || id === "M4_LIFE_PATTERN_EXPOSURE") {
    expected = 1;
    if (has("HABIT_DISCLOSURE") || has("SHARED_EXPERIENCE") || has("SELF_COMPARISON")) hits++;
  } else if (id.includes("GROUP") || id === "M7_GROUP_BEHAVIOR_DISCOVERY") {
    expected = 1;
    if (has("SHARED_EXPERIENCE") || has("AGREEMENT") || has("OPINION_DISCLOSURE")) hits++;
  } else if (id.includes("EVIDENCE") || id === "M3_EVIDENCE_JUDGMENT") {
    expected = 1;
    if (has("ADDITIONAL_INFORMATION") || has("CORRECTION") || has("OPINION_DISCLOSURE") || has("DEBATE")) hits++;
  } else {
    // generic: any meaningful engagement supports partially
    expected = 1;
    if (Object.keys(dist).some((k) => MEANINGFUL.has(k as ReaderBehaviorCategory) && (dist[k as ReaderBehaviorCategory] || 0) > 0))
      hits++;
  }

  if (hits >= expected && (selfProj.self_projection_strength === "STRONG" || selfProj.self_projection_strength === "MODERATE" || hits > 0)) {
    if (hits >= expected) return "SUPPORTED";
  }
  if (hits > 0) return "PARTIALLY_SUPPORTED";
  // shallow only
  if ((dist.AGREEMENT || 0) + (dist.EMOJI_ONLY || 0) > 0) return "PARTIALLY_SUPPORTED";
  return "NOT_SUPPORTED";
}

export function evidenceConfidence(replyCount: number, meaningfulCount: number): number {
  if (replyCount === 0) return 0;
  const base = Math.min(1, replyCount / 8);
  const quality = Math.min(1, meaningfulCount / Math.max(1, replyCount));
  return Math.round((0.4 * base + 0.6 * quality) * 100) / 100;
}

export function analyzePublishedPostAudience(post: PublishedPostInput): AudienceReactionRecord {
  const gate = isEligiblePublishedEvidence(post);
  const origin = resolvePublishedOrigin(post);
  const analyzedAt = post.analyzed_at || new Date().toISOString();
  const emptyDist: Partial<Record<ReaderBehaviorCategory, number>> = {};

  if (!gate.eligible) {
    return {
      published_post_id: post.published_post_id || "",
      source_role: post.source_role || null,
      published_origin: origin,
      audience_evidence_status: gate.status,
      reply_count_analyzed: 0,
      meaningful_reply_count: 0,
      reader_behavior_distribution: emptyDist,
      dominant_reader_behaviors: [],
      self_projection_evidence: emptySelfProjection(),
      story_invitation_evidence: "NONE",
      participation_barrier_evidence: "UNKNOWN",
      comprehension_barrier_evidence: "UNKNOWN",
      predicted_reaction_mechanism: post.predicted_reaction_mechanism || null,
      mechanism_validation: "INSUFFICIENT_EVIDENCE",
      evidence_confidence: 0,
      creator_origin_weight: creatorOriginWeight(origin),
      performance_context: post.performance || {},
      analyzed_at: analyzedAt,
      order4_version: ORDER4_VERSION,
      _raw_text_retained_for_generation: false,
    };
  }

  const dist: Partial<Record<ReaderBehaviorCategory, number>> = {};
  let meaningful = 0;
  for (const r of post.replies || []) {
    const cats = classifyReplyBehaviors(r);
    for (const c of cats) {
      dist[c] = (dist[c] || 0) + 1;
      if (MEANINGFUL.has(c)) meaningful++;
    }
  }
  const replyCount = (post.replies || []).length;
  // meaningful replies: unique replies that had at least one meaningful cat
  let meaningfulReplies = 0;
  for (const r of post.replies || []) {
    const cats = classifyReplyBehaviors(r);
    if (cats.some((c) => MEANINGFUL.has(c))) meaningfulReplies++;
  }
  meaningful = meaningfulReplies;

  const selfProj = buildSelfProjectionEvidence(dist, replyCount);
  const story = evaluateStoryInvitation(dist, meaningful, replyCount);
  const part = evaluateParticipationBarrier(dist, replyCount);
  const comp = evaluateComprehensionBarrier(dist, replyCount);
  const mechVal = validateReactionMechanism(
    post.predicted_reaction_mechanism,
    dist,
    replyCount,
    selfProj
  );
  const dominant = Object.entries(dist)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5)
    .map(([k]) => k as ReaderBehaviorCategory);

  return {
    published_post_id: post.published_post_id!,
    source_role: post.source_role || null,
    published_origin: origin,
    audience_evidence_status: replyCount === 0 ? "INSUFFICIENT_EVIDENCE" : "ANALYZED",
    reply_count_analyzed: replyCount,
    meaningful_reply_count: meaningful,
    reader_behavior_distribution: dist,
    dominant_reader_behaviors: dominant,
    self_projection_evidence: selfProj,
    story_invitation_evidence: story,
    participation_barrier_evidence: part,
    comprehension_barrier_evidence: comp,
    predicted_reaction_mechanism: post.predicted_reaction_mechanism || null,
    mechanism_validation: mechVal,
    evidence_confidence: evidenceConfidence(replyCount, meaningful),
    creator_origin_weight: creatorOriginWeight(origin),
    performance_context: post.performance || {},
    analyzed_at: analyzedAt,
    order4_version: ORDER4_VERSION,
    _raw_text_retained_for_generation: false,
  };
}

/** Strip any raw text before generation / seed pipelines */
export function toGenerationSafeAudienceEvidence(
  rec: AudienceReactionRecord
): Omit<AudienceReactionRecord, never> & { raw_comments?: never; reply_texts?: never } {
  const { ...safe } = rec;
  return {
    ...safe,
    _raw_text_retained_for_generation: false,
  };
}

/** Manual posts must not auto-become seeds (ORDER 0B) */
export function audienceEvidenceMayBecomeSeed(_rec: AudienceReactionRecord): false {
  return false;
}

export function audienceEvidenceMayBecomeCreatorDna(_rec: AudienceReactionRecord): false {
  return false;
}

export function aggregateAudienceMemory(
  records: AudienceReactionRecord[],
  opts?: { aggregate_id?: string; period_start?: string; period_end?: string }
): AggregateAudienceMemory {
  const analyzed = records.filter((r) => r.audience_evidence_status === "ANALYZED" || r.audience_evidence_status === "INSUFFICIENT_EVIDENCE");
  const totals: Partial<Record<ReaderBehaviorCategory, number>> = {};
  const storyDist: Partial<Record<StoryInvitationLevel, number>> = {};
  const mechRates: Partial<Record<MechanismValidationState, number>> = {};
  const partTend: Partial<Record<ParticipationBarrierLevel, number>> = {};
  let strongProj = 0;
  let manual = 0;
  let ai = 0;
  let confSum = 0;
  for (const r of analyzed) {
    if (r.published_origin === "MANUAL_PUBLISHED") manual++;
    if (r.published_origin === "AI_ASSISTED_PUBLISHED") ai++;
    if (r.self_projection_evidence.self_projection_strength === "STRONG") strongProj++;
    storyDist[r.story_invitation_evidence] = (storyDist[r.story_invitation_evidence] || 0) + 1;
    mechRates[r.mechanism_validation] = (mechRates[r.mechanism_validation] || 0) + 1;
    partTend[r.participation_barrier_evidence] = (partTend[r.participation_barrier_evidence] || 0) + 1;
    confSum += r.evidence_confidence;
    for (const [k, v] of Object.entries(r.reader_behavior_distribution)) {
      totals[k as ReaderBehaviorCategory] = (totals[k as ReaderBehaviorCategory] || 0) + (v as number);
    }
  }
  const n = analyzed.length || 1;
  return {
    aggregate_id: opts?.aggregate_id || `agg_${Date.now()}`,
    period_start: opts?.period_start || null,
    period_end: opts?.period_end || null,
    posts_analyzed: analyzed.length,
    manual_posts_analyzed: manual,
    ai_assisted_posts_analyzed: ai,
    reader_behavior_totals: totals,
    strong_self_projection_rate: analyzed.length ? strongProj / analyzed.length : null,
    story_invitation_distribution: storyDist,
    mechanism_validation_rates: mechRates,
    participation_barrier_tendencies: partTend,
    contextual_patterns: [
      "patterns_are_contextual_evidence_not_topic_maps",
      "no_deterministic_topic_to_mechanism",
    ],
    confidence: analyzed.length ? Math.round((confSum / n) * 100) / 100 : 0,
    updated_at: new Date().toISOString(),
    order4_version: ORDER4_VERSION,
    contains_raw_comment_examples: false,
  };
}

export type Order4Diagnostics = {
  order4_audience_reaction: true;
  order4_version: string;
  eligible_published_posts: number;
  posts_skipped: number;
  skip_reasons: Record<string, number>;
  comments_analyzed: number;
  comments_excluded: number;
  reader_behavior_counts: Partial<Record<ReaderBehaviorCategory, number>>;
  mechanism_validation_counts: Partial<Record<MechanismValidationState, number>>;
  manual_vs_ai: { manual: number; ai_assisted: number; unknown: number };
  no_topic_mechanism_map: true;
  raw_text_for_generation: false;
};

export function buildOrder4Diagnostics(records: AudienceReactionRecord[]): Order4Diagnostics {
  const skip: Record<string, number> = {};
  let eligible = 0;
  let skipped = 0;
  let comments = 0;
  const behaviors: Partial<Record<ReaderBehaviorCategory, number>> = {};
  const mech: Partial<Record<MechanismValidationState, number>> = {};
  let manual = 0,
    ai = 0,
    unknown = 0;
  for (const r of records) {
    if (r.audience_evidence_status === "ANALYZED" || r.audience_evidence_status === "INSUFFICIENT_EVIDENCE") {
      eligible++;
      comments += r.reply_count_analyzed;
      mech[r.mechanism_validation] = (mech[r.mechanism_validation] || 0) + 1;
      for (const [k, v] of Object.entries(r.reader_behavior_distribution)) {
        behaviors[k as ReaderBehaviorCategory] = (behaviors[k as ReaderBehaviorCategory] || 0) + (v as number);
      }
    } else {
      skipped++;
      skip[r.audience_evidence_status] = (skip[r.audience_evidence_status] || 0) + 1;
    }
    if (r.published_origin === "MANUAL_PUBLISHED") manual++;
    else if (r.published_origin === "AI_ASSISTED_PUBLISHED") ai++;
    else if (r.published_origin === "UNKNOWN_PUBLISHED") unknown++;
  }
  return {
    order4_audience_reaction: true,
    order4_version: ORDER4_VERSION,
    eligible_published_posts: eligible,
    posts_skipped: skipped,
    skip_reasons: skip,
    comments_analyzed: comments,
    comments_excluded: 0,
    reader_behavior_counts: behaviors,
    mechanism_validation_counts: mech,
    manual_vs_ai: { manual, ai_assisted: ai, unknown },
    no_topic_mechanism_map: true,
    raw_text_for_generation: false,
  };
}

/** Generation-safe barrier hints from engagement meta. Never uses comment wording. */
export function audienceBarrierSignalsFromActivityMeta(
  rows: Array<{ meta?: Record<string, unknown> | null }>,
): {
  participation_barrier_tendency?: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN" | null;
  comprehension_barrier_tendency?: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN" | null;
  strong_self_projection_rate?: number | null;
  story_invitation_strength?: string | null;
} | null {
  let replies = 0;
  let n = 0;
  for (const row of rows || []) {
    const meta = (row?.meta || {}) as Record<string, unknown>;
    const pm = ((meta.public_metrics || meta.publicMetrics || {}) as Record<string, unknown>);
    const r = Number(pm.reply_count ?? pm.replies ?? meta.reply_count ?? 0);
    if (!Number.isFinite(r)) continue;
    replies += r;
    n += 1;
  }
  if (n < 1) return null;
  const avg = replies / n;
  return {
    participation_barrier_tendency: avg >= 2 ? "LOW" : avg >= 0.5 ? "MODERATE" : "UNKNOWN",
    comprehension_barrier_tendency: "UNKNOWN",
    strong_self_projection_rate: null,
    story_invitation_strength: avg >= 2 ? "MODERATE" : "WEAK",
  };
}
