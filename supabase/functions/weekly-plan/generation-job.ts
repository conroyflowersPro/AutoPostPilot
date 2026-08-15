/**
 * Weekly generate job: persist state, one Grok/write tick per Edge invoke.
 * Text week only. Video is out of scope.
 */
import {
  applyLocalGates,
  bootstrapCandidatesFromDimensions,
  collectLearnedSeedSignals,
  createSeedIdFactory,
  isSelectableStatus,
  canServeEditorialMode,
  evaluateEditorialSeedQuality,
  conceptualDiversityScore,
  conceptualRepetitionLevel,
  ideaAngleKey,
  parseEditorialMode,
  type ConcreteSeed,
} from "./seed-engine.ts";
import { allocateEditorialSlots, buildEditorialQueue, lengthForEditorial, type EditorialMode } from "./editorial-mix.ts";
import { judgeSeedGrounding } from "./runtime-grounding.ts";
import { guardCandidateAgainstManualLeakage, type RecentManualPost } from "./manual-leakage-guard.ts";
import { isSeedEligibleRole, type SourceRole } from "./source-roles.ts";
import { redistributeDailyTopics } from "./daily-topic-distribute.ts";
import { expandSeedSupplyWithXai } from "./seed-supply-expansion.ts";
import { writeSlotBatch, V11_SEED_MODEL } from "./order-write-pipeline.ts";
import { evaluateOrder8cCompletionGate } from "./weekly-count-ledger.ts";
import { inferWeeklyQuota, quotaFromCadence, QUOTA_DAYS, QUOTA_PER_DAY_MIN, QUOTA_PER_DAY_MAX } from "./quota-inference.ts";
import { loadPlannerIntelligence } from "./planner-intelligence.ts";
import {
  isAdjacentExpansionSeed,
  pickDayForAdjacent,
  enforceAdjacentPerDay,
} from "./adjacent-expansion.ts";
import {
  MASS_PER_DAY_MAX,
  isPersonalInterestSubject,
  isKoreaOnlySituation,
  hasExpertJargon,
  pickDayForMass,
  enforceMassPerDay,
  demoteExperienceOnMassSlots,
  placeableSeedCount,
} from "./seed-scope.ts";
import {
  HUMOR_SOURCE_TYPE,
  isHumorFillSeed,
  isFrozenHumorClone,
} from "./humor-fill.ts";
import {
  overlayClusterWeightsWithIntent14d,
  clusterPriorityFromMix,
} from "./creator-intent-14d.ts";
import { audienceBarrierSignalsFromActivityMeta } from "./audience-reaction-intelligence.ts";
import {
  ARCHIVE_EXPERIENCE_FALLBACK,
  buildRecentExperienceCandidates,
  experienceCandidateToSeedFields,
  resolveExperienceSupply,
} from "./experience-evidence.ts";

const EXPAND_BATCH = 10;
const JUDGE_BATCH = 16;
const WRITE_CHUNK = 1;
const COLLISION_DAYS = 30;
const JOB_LOCK_MS = 90000;

export type JobStep = "quota" | "expand" | "judge" | "select" | "write" | "done";

export type JobPublic = {
  success: true;
  job_id: string;
  status: "running" | "done" | "error";
  step: JobStep;
  label_ko: string;
  saved_count: number;
  required_slots: number;
  summary: string;
  error: string | null;
  learning?: unknown;
};

function expandRoundBudget(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  const fill = Math.ceil((slots * 1.2) / 3);
  return Math.min(36, Math.max(16, fill + 8));
}
function topupRoundBudget(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  return Math.min(16, Math.max(6, Math.ceil(slots / 3)));
}
function priorSubjectCap(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  return Math.max(80, slots * 2);
}

function majorKey(cluster: string, subject: string): string {
  const c = (cluster || "").toUpperCase();
  const s = (subject || "").toLowerCase();
  if (c.includes("CYBER") || /cybertruck|사이버/.test(s)) return "CYBERTRUCK";
  if (c === "FSD" || /\bfsd\b/.test(s)) return "FSD";
  if (/robotaxi|로보택시|curb|주정차|승하차/.test(s) || c === "ROBOTAXI") return "ROBOTAXI";
  if (/lafc|bmo|직관/.test(s) || c === "LAFC") return "LAFC";
  if (c === "AI_TECH" || /\bai\b|grok|그록/.test(s)) return "AI_TECH";
  if (c === "GAMING" || /게임/.test(s)) return "GAMING";
  return c || "OTHER";
}

function compactSlotLite(seed: ConcreteSeed, dayOffset: number, slot: number, mode: EditorialMode) {
  return {
    slotId: `D${dayOffset + 1}P${slot}`,
    dayOffset,
    primaryTopic: seed.concrete_subject,
    topic_cluster: seed.cluster,
    cluster: seed.cluster,
    concrete_subject: seed.concrete_subject,
    editorial_mode: mode,
    length_mode: lengthForEditorial(mode),
    angle: seed.point_or_tension || "",
    actionType: "ORIGINAL",
    planning_source: "PHASED_SEED",
    idea_angle_key: ideaAngleKey(seed),
    seed_id: seed.seed_id,
    creator_evidence_available: !!seed.creator_evidence_available,
    primary_source: seed.primary_source,
    source_type: seed.source_type || seed.primary_source,
    evidence_source_ids: seed.evidence_source_ids || [],
    cite_episode_hint: (seed as any).cite_episode_hint || "",
    source_kind: (seed as any).source_kind || "",
    adjacent_expansion: isAdjacentExpansionSeed(seed as any),
    claim_types: seed.claim_types || [],
    inference_type: seed.inference_type || "UNKNOWN",
    grounding_status: seed.grounding_status || "UNKNOWN",
    grounding_reasons: seed.grounding_reasons || [],
    final_text: "",
    generation_status: "PENDING_GENERATION",
  };
}

function eligibleOf(rows: any[]) {
  return (rows || []).filter((s: any) => s?.status === "ELIGIBLE" || s?.status === "HIGH_VALUE");
}

function publicView(row: any): JobPublic {
  const state = row.state || {};
  return {
    success: true,
    job_id: row.id,
    status: row.status,
    step: row.step,
    label_ko: row.label_ko || "",
    saved_count: Number(row.saved_count) || 0,
    required_slots: Number(row.required_slots) || 0,
    summary: row.summary || "",
    error: row.error || null,
    learning: state.learning || null,
  };
}

async function saveRow(supabase: any, row: any) {
  const { error } = await supabase.from("generation_jobs").update({
    status: row.status,
    step: row.step,
    saved_count: row.saved_count,
    required_slots: row.required_slots,
    label_ko: row.label_ko,
    summary: row.summary,
    error: row.error,
    state: row.state,
    locked_at: row.locked_at,
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (error) throw new Error(error.message);
}

export async function startWeeklyJob(args: {
  supabase: any;
  userId: string;
  startDate: string;
  topic: string;
  lafc_matches: unknown[];
  publishedTopics: string[];
  scheduledTopics: string[];
}): Promise<JobPublic> {
  const state = {
    startDate: args.startDate,
    topic: args.topic,
    lafc_matches: args.lafc_matches || [],
    publishedTopics: args.publishedTopics || [],
    scheduledTopics: args.scheduledTopics || [],
    gated: [] as any[],
    judged: [] as any[],
    prior_subjects: [] as string[],
    dim_batch: 0,
    empty_streak: 0,
    last_expand_error: "",
    days: [] as any[],
    write_flat: [] as any[],
    write_index: 0,
    write_errors: [] as string[],
    max_expand: 20,
    max_topup: 6,
    topup: 0,
    select_tries: 0,
    adjacent_fill: false,
    humor_fill: false,
    compact_next: false,
    adjacent_rounds: 0,
    posts_per_day: 4,
    quota: null as any,
    learning: null as any,
  };
  const { data: running } = await args.supabase
    .from("generation_jobs")
    .select("id, status, step, saved_count, required_slots, label_ko, summary, error, state")
    .eq("user_id", args.userId)
    .eq("status", "running")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (running) return publicView(running);

  const insert = {
    user_id: args.userId,
    status: "running",
    step: "quota",
    saved_count: 0,
    required_slots: 0,
    label_ko: "3일 할당량 추론…",
    summary: "",
    error: null,
    state,
  };
  const { data, error } = await args.supabase
    .from("generation_jobs")
    .insert(insert)
    .select("id, status, step, saved_count, required_slots, label_ko, summary, error, state")
    .single();
  if (error) {
    const m = String(error.message || "generation_jobs insert failed");
    if (/does not exist|schema cache|Could not find the table/i.test(m)) {
      throw new Error("generation_jobs 테이블이 없습니다. 마이그레이션을 적용한 뒤 다시 시도하세요.");
    }
    throw new Error(m);
  }
  return publicView(data);
}

export async function statusWeeklyJob(supabase: any, userId: string, jobId?: string): Promise<JobPublic | null> {
  let q = supabase.from("generation_jobs").select("id, status, step, saved_count, required_slots, label_ko, summary, error, state").eq("user_id", userId);
  if (jobId) q = q.eq("id", jobId);
  else q = q.eq("status", "running").order("updated_at", { ascending: false }).limit(1);
  const { data, error } = jobId ? await q.maybeSingle() : await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? publicView(data) : null;
}

export async function tickWeeklyJob(args: {
  supabase: any;
  userId: string;
  jobId: string;
  xaiKey: string;
  openaiKey?: string;
}): Promise<JobPublic> {
  const { data: row, error } = await args.supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", args.jobId)
    .eq("user_id", args.userId)
    .single();
  if (error || !row) throw new Error(error?.message || "job not found");
  if (row.status !== "running") return publicView(row);

  const lockedAt = row.locked_at ? Date.parse(String(row.locked_at)) : 0;
  if (lockedAt && Date.now() - lockedAt < JOB_LOCK_MS) return publicView(row);

  row.locked_at = new Date().toISOString();
  await saveRow(args.supabase, row);

  try {
    if (row.step === "quota") await stepQuota(args.supabase, args.xaiKey, row);
    else if (row.step === "expand") await stepExpand(args.supabase, args.xaiKey, row);
    else if (row.step === "judge") await stepJudge(row);
    else if (row.step === "select") await stepSelect(args.supabase, row);
    else if (row.step === "write") await stepWrite(args.supabase, args.openaiKey || "", args.userId, row);
    else {
      row.status = "done";
      row.label_ko = `완료: ${row.saved_count}개 draft 저장`;
    }
  } catch (e: any) {
    row.status = "error";
    row.error = String(e?.message || e).slice(0, 240);
    row.label_ko = "작업 실패";
  }
  row.locked_at = null;
  await saveRow(args.supabase, row);
  return publicView(row);
}

async function loadEvidence(supabase: any, extraSubjects: string[], intentText: string) {
  const since = new Date(Date.now() - COLLISION_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: actRows } = await supabase
    .from("account_activities")
    .select("text_body, post_type, action_type, published_at, system_origin_class, x_post_id, meta")
    .gte("published_at", since)
    .limit(400);
  const publishedEvidence: any[] = [];
  for (const row of actRows || []) {
    const t = String(row.text_body || "").trim();
    if (t.length < 12) continue;
    const pt = String(row.post_type || row.action_type || "").toUpperCase();
    if (pt.includes("REPLY") || pt.includes("REPOST") || pt.includes("RETWEET")) continue;
    const soc = String(row.system_origin_class || "").toUpperCase();
    if (soc && /AP_PIPELINE|APP|SYSTEM|AUTOPOST|FEDICA_AUTO|GENERATED/.test(soc)) continue;
    publishedEvidence.push({
      text: t,
      source_id: row.x_post_id,
      published_at: row.published_at,
      post_type: pt,
      meta: row.meta,
      system_origin_class: soc,
    });
  }
  const learned = collectLearnedSeedSignals({
    publishedSubjects: extraSubjects,
    publishedEvidence,
    intentText,
  });
  const { intent, cluster_weights } = overlayClusterWeightsWithIntent14d(
    learned.cluster_weights,
    (actRows || []) as any[],
  );
  learned.cluster_weights = cluster_weights;
  const experience = buildRecentExperienceCandidates(
    (actRows || []).map((r: any) => ({
      ...r,
      post_type: r.post_type || r.action_type,
    })),
  );
  const intelligence = await loadPlannerIntelligence(supabase, learned.recent_angle_labels);
  return { publishedEvidence, learned, experience, intent14d: intent, intelligence };
}

async function stepQuota(supabase: any, xaiKey: string, row: any) {
  const st = row.state;
  const intentText = String(st.topic || "").trim();
  const { learned, intent14d, intelligence } = await loadEvidence(supabase, st.publishedTopics || [], intentText);
  st.cluster_weights = learned.cluster_weights;
  st.intent14d_top = (intent14d?.publishing_interests || []).slice(0, 6);
  const quota = xaiKey
    ? await inferWeeklyQuota({
      xaiKey,
      cadence: learned.cadence,
      clusterWeights: learned.cluster_weights,
      userDirectN: learned.user_direct_n,
      performanceHints: learned.performance_pattern_hints,
      learning: learned.learning,
      intelligence,
      explicitCreatorIntent: intentText || undefined,
      model: V11_SEED_MODEL,
      timeoutMs: 18000,
    })
    : quotaFromCadence(learned.cadence, intentText);
  st.quota = quota;
  st.learning = learned.learning;
  st.posts_per_day = quota.posts_per_day;
  row.required_slots = quota.required_slots;
  st.max_expand = expandRoundBudget(quota.required_slots);
  st.max_topup = topupRoundBudget(quota.required_slots);
  row.summary = [
    `quota: ${quota.posts_per_day}/day × ${QUOTA_DAYS} = ${quota.required_slots}`,
    quota.rationale,
    learned.learning?.note_ko ? `학습: ${learned.learning.stage} · ${learned.learning.note_ko}` : "",
    (st.intent14d_top || []).length
      ? `14일 관심: ${(st.intent14d_top as string[]).join(", ")}`
      : "14일 관심: cold",
  ].filter(Boolean).join("\n");
  row.step = "expand";
  row.label_ko = `시드 추론 0/${quota.required_slots}…`;
}

async function stepExpand(supabase: any, xaiKey: string, row: any) {
  const st = row.state;
  const required = Number(row.required_slots) || 0;
  const intentText = String(st.topic || "").trim();
  const published = (st.publishedTopics || []).map(String);
  const { publishedEvidence, learned, experience, intent14d, intelligence } = await loadEvidence(supabase, published, intentText);
  st.cluster_weights = learned.cluster_weights;
  st.intent14d_top = (intent14d?.publishing_interests || []).slice(0, 6);
  if (!xaiKey) {
    row.status = "error";
    row.error = "SEED_INFERENCE_REQUIRES_XAI";
    row.label_ko = "xAI 키 없음";
    return;
  }
  const priorSubjects: string[] = st.prior_subjects || [];
  const remaining = Math.max(0, Math.max(required, Math.ceil(required * 1.15)) - priorSubjects.length);
  const existingHeld: ConcreteSeed[] = priorSubjects.map((s: string, i: number) => ({
    seed_id: `prior-${i + 1}`,
    cluster: "HELD",
    dimension: "PRIOR",
    concrete_subject: String(s).slice(0, 100),
    subject_signature: String(s).toLowerCase().slice(0, 80),
  }));
  const local = st.dim_batch === 0
    ? bootstrapCandidatesFromDimensions({ publishedSubjects: published, publishedEvidence, intentText })
    : [];
  const gated = applyLocalGates(local, [], createSeedIdFactory("s"));
  const experienceSeeds: any[] = [];
  if (!st.experience_injected) {
    const needExp = Math.min(
      QUOTA_DAYS,
      Math.max(1, Math.ceil(required * 0.25)),
    );
    const resolved = resolveExperienceSupply(needExp, experience || [], ARCHIVE_EXPERIENCE_FALLBACK);
    let n = 0;
    for (const c of resolved.selected) {
      if (!c.seed_eligible && c.source_role !== "SEED_SOURCE" && c.source_role !== "USER_EXPLICIT_SEED") continue;
      n += 1;
      const fields = experienceCandidateToSeedFields(c);
      experienceSeeds.push({
        seed_id: `exp-cite-${n}`,
        ...fields,
        source_role: fields.source_role || "SEED_SOURCE",
        source_trace: {
          source_role: fields.source_role || "SEED_SOURCE",
          source_type: "EXPERIENCE_CITE_RELATED",
          leakage_guard_result: "PASS",
        },
      });
      if (c.concrete_subject) priorSubjects.push(String(c.concrete_subject));
    }
    st.experience_injected = true;
    st.experience_n = experienceSeeds.length;
    row.summary = [row.summary, `경험시드: ${experienceSeeds.length} · 인용 후속 · 동일 내용 금지`].filter(Boolean).join("\n");
  }
  const candidates: any[] = [...experienceSeeds, ...(gated.passed || [])];
  const massAtCap = ((st.gated || []) as any[]).filter((s: any) =>
    !isPersonalInterestSubject(String(s.concrete_subject || ""), String(s.cluster || "")),
  ).length >= QUOTA_DAYS * MASS_PER_DAY_MAX;
  const humorFill = !!st.humor_fill || !!st.adjacent_fill;
  const compact = !!st.compact_next;
  const xaiRes = await expandSeedSupplyWithXai({
    xaiKey,
    needed: Math.max(Math.min(EXPAND_BATCH, remaining), 1),
    existing: [...candidates, ...existingHeld] as ConcreteSeed[],
    explicitCreatorIntent: intentText || undefined,
    recentPublishedAngles: [...learned.recent_angle_labels, ...published].slice(0, 30),
    performancePatternHints: learned.performance_pattern_hints,
    clusterInterestWeights: learned.cluster_weights,
    registryInterestHints: learned.registry_interest_hints,
    userDirectN: learned.user_direct_n,
    learning: learned.learning,
    intelligence,
    adjacentRing: false,
    humorRing: humorFill || massAtCap || compact,
    compactRetry: compact,
    model: V11_SEED_MODEL,
    timeoutMs: compact ? 20000 : 32000,
  });
  st.dim_batch = Number(st.dim_batch || 0) + 1;
  const grokAdded: any[] = [];
  for (const s of xaiRes.seeds || []) {
    if (/관찰·판단 축/.test(String(s.concrete_subject || ""))) continue;
    if (isKoreaOnlySituation(String(s.concrete_subject || ""))) continue;
    if (hasExpertJargon(String(s.concrete_subject || ""))) continue;
    if (isFrozenHumorClone(String(s.concrete_subject || ""))) continue;
    const rowSeed = humorFill
      ? {
        ...s,
        source_role: "SEED_SOURCE",
        source_type: HUMOR_SOURCE_TYPE,
        requested_editorial_mode: "CASUAL_OBSERVATION",
        source_trace: { source_role: "SEED_SOURCE", source_type: HUMOR_SOURCE_TYPE, leakage_guard_result: "PASS" },
      }
      : {
        ...s,
        source_role: "SEED_SOURCE",
        source_trace: { source_role: "SEED_SOURCE", source_type: "CREATOR_SEED_REASONING", leakage_guard_result: "PASS" },
      };
    grokAdded.push(rowSeed);
  }
  const added: any[] = [...experienceSeeds, ...grokAdded];
  if (humorFill) {
    st.humor_fill = false;
    st.adjacent_fill = false;
  }
  st.gated = [...(st.gated || []), ...added];
  for (const s of added) {
    if (s.concrete_subject) priorSubjects.push(String(s.concrete_subject));
  }
  st.prior_subjects = priorSubjects.slice(-priorSubjectCap(required));
  st.last_expand_error = xaiRes.error || "";
  let placeable = placeableSeedCount(st.gated || [], QUOTA_DAYS, MASS_PER_DAY_MAX);
  if (grokAdded.length <= 0) {
    st.empty_streak = Number(st.empty_streak || 0) + 1;
    if (st.empty_streak >= 4 && (st.gated || []).length < 1) {
      row.status = "error";
      row.error = `Grok 시드 추론이 반복 실패했습니다 (${st.gated.length}/${required}). 템플릿으로 채우지 않습니다.` +
        (st.last_expand_error ? ` 원인: ${st.last_expand_error}` : "");
      row.label_ko = "시드 추론 실패";
      row.summary = [row.summary, st.last_expand_error ? `expand: ${st.last_expand_error}` : ""].filter(Boolean).join("\n");
      return;
    }
    if (!compact) {
      st.compact_next = true;
      row.label_ko = `시드 짧게 재추론 ${placeable}/${required}…`;
      if (st.last_expand_error) {
        row.summary = [row.summary, `expand: ${st.last_expand_error}`].filter(Boolean).join("\n");
      }
      return;
    }
    st.compact_next = false;
    if (placeable >= required && (st.gated || []).length > 0) {
      row.step = "judge";
      row.label_ko = "시드 판정…";
      return;
    }
    if (placeable < required && st.dim_batch < st.max_expand) {
      st.humor_fill = true;
      row.label_ko = `유머·관심 시드로 할당량 보충 ${placeable}/${required}…`;
      if (st.last_expand_error) {
        row.summary = [row.summary, `expand: ${st.last_expand_error}`].filter(Boolean).join("\n");
      }
      return;
    }
  } else {
    st.empty_streak = 0;
    st.compact_next = false;
  }
  row.label_ko = humorFill
    ? `유머 시드 ${placeable}/${required}…`
    : `시드 추론 ${placeable}/${required}…`;
  const filled = required > 0 && placeable >= required;
  if (filled || st.dim_batch >= st.max_expand) {
    if (st.gated.length < 1) {
      row.status = "error";
      row.error = `시드 ${st.gated.length}/${required}. 할당량을 채우지 못해 중단합니다.` +
        (st.last_expand_error ? ` 원인: ${st.last_expand_error}` : "");
      return;
    }
    row.step = "judge";
    row.label_ko = "시드 판정…";
  } else if (placeable < required) {
    st.humor_fill = true;
  }
}

async function stepJudge(row: any) {
  const st = row.state;
  const start = (st.judged || []).length;
  const batch = (st.gated || []).slice(start, start + JUDGE_BATCH);
  const judged = [...(st.judged || [])];
  for (const b of batch) {
    const mode = parseEditorialMode(b.requested_editorial_mode || b.editorial_mode) || "INFORMATIVE";
    const g = judgeSeedGrounding({
      concrete_subject: String(b.concrete_subject || ""),
      point_or_tension: b.point_or_tension ? String(b.point_or_tension) : undefined,
      editorial_mode: mode,
      cluster: b.cluster ? String(b.cluster) : undefined,
      creator_evidence_available: !!b.creator_evidence_available,
      experience_required: !!b.experience_required,
      primary_source: b.primary_source ? String(b.primary_source) : undefined,
      evidence_source_ids: Array.isArray(b.evidence_source_ids) ? b.evidence_source_ids.map(String) : undefined,
    });
    if (!g.pass) {
      judged.push({ ...b, status: "REJECTED", editorial_fit: "POOR" });
      continue;
    }
    const q = evaluateEditorialSeedQuality(b, mode);
    if (!q.pass) {
      const onlyMissingLived = q.reasons.length === 1 && q.reasons[0] === "NO_CREATOR_EVIDENCE";
      if (onlyMissingLived) {
        judged.push({
          ...b,
          status: isSelectableStatus(b.status) ? b.status : "ELIGIBLE",
          editorial_fit: "ACCEPTABLE",
          requested_editorial_mode: "INFORMATIVE",
          editorial_mode: "INFORMATIVE",
          experience_required: false,
        });
        continue;
      }
      judged.push({ ...b, status: "HOLD", editorial_fit: "POOR" });
      continue;
    }
    judged.push({
      ...b,
      status: isSelectableStatus(b.status) ? b.status : "ELIGIBLE",
      editorial_fit: "ACCEPTABLE",
      requested_editorial_mode: mode,
    });
  }
  st.judged = judged;
  const required = Number(row.required_slots) || 0;
  if (judged.length < (st.gated || []).length) {
    row.label_ko = `시드 판정 ${judged.length}/${st.gated.length}…`;
    return;
  }
  const eligibleN = eligibleOf(judged).length;
  if (eligibleN < required && st.topup < st.max_topup) {
    st.topup = Number(st.topup || 0) + 1;
    row.step = "expand";
    row.label_ko = `할당량 보충 ${eligibleN}/${required}…`;
    return;
  }
  if (eligibleN < 1) {
    row.status = "error";
    row.error = `판정 통과 ${eligibleN}/${required}. Grok이 할당량을 채우지 못했습니다.`;
    return;
  }
  row.step = "select";
  row.label_ko = "주간 배치…";
}

async function stepSelect(supabase: any, row: any) {
  const st = row.state;
  const required = Number(row.required_slots) || 0;
  const postsPerDay = Math.min(QUOTA_PER_DAY_MAX, Math.max(QUOTA_PER_DAY_MIN, Number(st.posts_per_day) || 4));
  const since = new Date(Date.now() - COLLISION_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: acts } = await supabase
    .from("account_activities")
    .select("text_body, post_type, action_type, published_at, system_origin_class, meta, x_post_id")
    .gte("published_at", since)
    .limit(500);
  const recentManualSelect: RecentManualPost[] = (acts || [])
    .map((r: any) => ({
      text: String(r.text_body || "").trim(),
      source_id: r.x_post_id,
      published_at: r.published_at,
      post_type: String(r.post_type || r.action_type || ""),
    }))
    .filter((r: RecentManualPost) => r.text.length >= 12);
  let pool: ConcreteSeed[] = [];
  for (const s of st.judged || []) {
    if (!s?.concrete_subject) continue;
    if (!isSelectableStatus(s.status)) continue;
    const role = (s.source_role as SourceRole) || "SEED_SOURCE";
    if (!isSeedEligibleRole(role)) continue;
    const g = guardCandidateAgainstManualLeakage({
      source_role: role,
      concrete_subject: String(s.concrete_subject || ""),
      point_or_tension: s.point_or_tension ? String(s.point_or_tension) : undefined,
      recent_manual: recentManualSelect,
      user_explicit: role === "USER_EXPLICIT_SEED",
    });
    if (!g.allow_as_seed) continue;
    if (isKoreaOnlySituation(String(s.concrete_subject || ""))) continue;
    if (hasExpertJargon(String(s.concrete_subject || ""))) continue;
    if (isFrozenHumorClone(String(s.concrete_subject || ""))) continue;
    pool.push(s);
  }
  const expSupply = pool.filter((s) => canServeEditorialMode(s, "EXPERIENCE") && !isAdjacentExpansionSeed(s) && isPersonalInterestSubject(String(s.concrete_subject || ""), String(s.cluster || ""))).length;
  const expPct = expSupply > 0
    ? Math.round((Math.min(expSupply, required) / Math.max(required, 1)) * 100)
    : 0;
  const mix = allocateEditorialSlots(required, {
    INFORMATIVE: 35,
    COMPARE: 15,
    OPINION: 20,
    EXPERIENCE: expPct,
    CASUAL_OBSERVATION: 15,
  });
  const selectedWeekly: ConcreteSeed[] = [];
  const queue = buildEditorialQueue(mix.allocation as any);
  const outDays: Array<{ dayOffset: number; posts: any[] }> = Array.from({ length: QUOTA_DAYS }, (_, i) => ({
    dayOffset: i,
    posts: [],
  }));
  for (const plannedMode of queue) {
    const mode = plannedMode as EditorialMode;
    const clusterMix: Record<string, number> = {};
    for (const w of (st.cluster_weights || []) as Array<{ cluster: string; n: number }>) {
      if (w?.cluster) clusterMix[w.cluster] = Number(w.n) || 0;
    }
    const cands = pool
      .map((s, i) => ({ s, i, div: conceptualDiversityScore(s, selectedWeekly) }))
      .filter(({ s }) => {
        if (!canServeEditorialMode(s, mode) || isAdjacentExpansionSeed(s)) return false;
        if (mode === "EXPERIENCE") {
          return isPersonalInterestSubject(String(s.concrete_subject || ""), String(s.cluster || ""));
        }
        return true;
      })
      .sort((a, b) => {
        const d = b.div - a.div;
        if (d !== 0) return d;
        return clusterPriorityFromMix(clusterMix, String(b.s.cluster || "")) -
          clusterPriorityFromMix(clusterMix, String(a.s.cluster || ""));
      });
    let picked: ConcreteSeed | null = null;
    for (const { s, i } of cands) {
      if (conceptualRepetitionLevel(s, selectedWeekly) === "HIGH" && selectedWeekly.length >= Math.ceil(required * 0.5)) continue;
      const personal = isPersonalInterestSubject(String(s.concrete_subject || ""), String(s.cluster || "")) ||
        mode === "EXPERIENCE";
      if (!personal && pickDayForMass(outDays, postsPerDay, MASS_PER_DAY_MAX) < 0) continue;
      picked = s;
      pool.splice(i, 1);
      break;
    }
    if (!picked) continue;
    selectedWeekly.push(picked);
    const personal = isPersonalInterestSubject(String(picked.concrete_subject || ""), String(picked.cluster || "")) ||
      mode === "EXPERIENCE";
    let bestDay = personal ? -1 : pickDayForMass(outDays, postsPerDay, MASS_PER_DAY_MAX);
    if (bestDay < 0) {
      bestDay = 0;
      let bestScore = 1e9;
      for (let d = 0; d < QUOTA_DAYS; d++) {
        if (outDays[d].posts.length >= postsPerDay) continue;
        const n = outDays[d].posts.filter(
          (p) => majorKey(p.cluster, p.concrete_subject) === majorKey(picked!.cluster, picked!.concrete_subject),
        ).length;
        const score = n * 10 + outDays[d].posts.length;
        if (score < bestScore) {
          bestScore = score;
          bestDay = d;
        }
      }
    }
    if (outDays[bestDay].posts.length >= postsPerDay) {
      for (let d = 0; d < QUOTA_DAYS; d++) {
        if (outDays[d].posts.length < postsPerDay) {
          bestDay = d;
          break;
        }
      }
    }
    outDays[bestDay].posts.push(compactSlotLite(picked, bestDay, outDays[bestDay].posts.length + 1, mode));
  }
  let totalPlanned = outDays.reduce((s, d) => s + d.posts.length, 0);
  while (totalPlanned < required) {
    const idx = pool.findIndex((s) => isAdjacentExpansionSeed(s) && isSelectableStatus(s.status as any));
    if (idx < 0) break;
    const day = pickDayForAdjacent(outDays, postsPerDay, MASS_PER_DAY_MAX);
    if (day < 0) break;
    const seed = pool.splice(idx, 1)[0];
    selectedWeekly.push(seed);
    const mode = (parseEditorialMode(String(seed.requested_editorial_mode || "")) === "EXPERIENCE"
      ? "INFORMATIVE"
      : parseEditorialMode(String(seed.requested_editorial_mode || "INFORMATIVE"))) as EditorialMode;
    outDays[day].posts.push(compactSlotLite(seed, day, outDays[day].posts.length + 1, mode === "EXPERIENCE" ? "INFORMATIVE" : mode));
    totalPlanned += 1;
  }
  while (totalPlanned < required && pool.length > 0) {
    const idx = pool.findIndex((s) => {
      if (!isSelectableStatus(s.status as any)) return false;
      if (isAdjacentExpansionSeed(s)) return false;
      const mode = parseEditorialMode(String(s.requested_editorial_mode || s.editorial_mode || "INFORMATIVE"));
      if (mode === "EXPERIENCE" && !canServeEditorialMode(s, "EXPERIENCE")) return false;
      return true;
    });
    if (idx < 0) break;
    let day = -1;
    for (let d = 0; d < outDays.length; d++) {
      if (outDays[d].posts.length >= postsPerDay) continue;
      day = d;
      break;
    }
    if (day < 0) break;
    const seed = pool.splice(idx, 1)[0];
    selectedWeekly.push(seed);
    let mode = parseEditorialMode(String(seed.requested_editorial_mode || seed.editorial_mode || "INFORMATIVE"));
    if (isHumorFillSeed(seed)) mode = "CASUAL_OBSERVATION";
    if (mode === "EXPERIENCE" && !canServeEditorialMode(seed, "EXPERIENCE")) mode = "INFORMATIVE";
    const personal = isPersonalInterestSubject(String(seed.concrete_subject || ""), String(seed.cluster || ""));
    if (!personal) {
      const mDay = pickDayForMass(outDays, postsPerDay, MASS_PER_DAY_MAX);
      if (mDay >= 0) day = mDay;
      else continue;
    }
    if (mode === "EXPERIENCE" && !personal) mode = "INFORMATIVE";
    outDays[day].posts.push(compactSlotLite(seed, day, outDays[day].posts.length + 1, mode));
    totalPlanned += 1;
  }
  const redistributed = redistributeDailyTopics(outDays, postsPerDay);
  enforceAdjacentPerDay(redistributed.days, postsPerDay, MASS_PER_DAY_MAX);
  enforceMassPerDay(redistributed.days, MASS_PER_DAY_MAX);
  demoteExperienceOnMassSlots(redistributed.days);
  for (let di = 0; di < redistributed.days.length; di++) {
    redistributed.days[di].posts.forEach((p: any, si: number) => {
      p.dayOffset = di;
      p.slotId = `D${di + 1}P${si + 1}`;
    });
  }
  const totalAfter = redistributed.days.reduce((s, d) => s + d.posts.length, 0);
  const adjacentPlanned = redistributed.days.reduce(
    (s, d) => s + (d.posts || []).filter((p: any) => isAdjacentExpansionSeed(p)).length,
    0,
  );
  if (totalAfter < required && Number(st.adjacent_rounds || 0) < 2) {
    st.adjacent_rounds = Number(st.adjacent_rounds || 0) + 1;
    st.humor_fill = true;
    st.compact_next = false;
    st.adjacent_fill = false;
    row.step = "expand";
    row.label_ko = `유머·관심 시드로 할당량 보충 ${totalAfter}/${required}…`;
    row.summary = [row.summary, `계획 ${totalAfter}/${required} → Grok이 관심 시드를 더 추론`].filter(Boolean).join("\n");
    return;
  }
  const totalFilled = redistributed.days.reduce((s, d) => s + d.posts.length, 0);
  if (totalFilled < 1) {
    row.status = "error";
    row.error = `3일 계획이 0/${required}입니다.`;
    return;
  }
  for (let di = 0; di < redistributed.days.length; di++) {
    redistributed.days[di].posts.forEach((p: any, si: number) => {
      p.dayOffset = di;
      p.slotId = `D${di + 1}P${si + 1}`;
    });
  }
  st.days = redistributed.days;
  st.write_flat = redistributed.days.flatMap((d) => d.posts || []);
  st.write_index = 0;
  st.weekly_signatures = [];
  st.write_outcomes = [];
  const short = totalFilled < required;
  row.summary = [
    row.summary,
    `expand_seeds: ${(st.gated || []).length} · judged: ${(st.judged || []).length} · planned: ${totalFilled}/${required}` +
      (adjacentPlanned ? ` · 대중 ${adjacentPlanned}(하루 최대 ${MASS_PER_DAY_MAX})` : "") +
      (short ? " · 추론된 시드만 작성 (고정 목록으로 채우지 않음)" : ""),
  ].filter(Boolean).join("\n");
  row.step = "write";
  row.label_ko = `초안 생성 0/${st.write_flat.length}…`;
}

function attachCountLedger(row: any) {
  const st = row.state || {};
  const outcomes = Array.isArray(st.write_outcomes) ? st.write_outcomes : [];
  const required = Number(row.required_slots) || outcomes.length;
  const gate = evaluateOrder8cCompletionGate({
    requested_slots: Math.max(required, outcomes.length),
    slots: outcomes,
  });
  st.count_ledger = {
    planned: required,
    generated: outcomes.filter((s: any) => String(s.final_text || "").trim()).length,
    judged: outcomes.filter((s: any) => String(s.judge_status || "")).length,
    accepted: gate.ledger.publishable_slots,
    regenerated: gate.ledger.regenerated_pass_slots,
    blocked: gate.ledger.blocked_slots,
    count_integrity_pass: gate.ledger.missing_slots === 0 && gate.ledger.duplicate_slot_ids.length === 0,
    missing_slots: gate.ledger.missing_slots,
    duplicate_slot_ids: gate.ledger.duplicate_slot_ids,
  };
  const L = st.count_ledger;
  const line =
    `개수: planned ${L.planned} · generated ${L.generated} · judged ${L.judged} · accepted ${L.accepted} · regenerated ${L.regenerated} · blocked ${L.blocked}`;
  row.summary = [row.summary, line].filter(Boolean).join("\n");
  if (!L.count_integrity_pass) {
    row.summary += `\n개수 검증 실패: missing ${L.missing_slots}`;
  }
}

async function stepWrite(supabase: any, openaiKey: string, userId: string, row: any) {
  const st = row.state;
  const flat: any[] = st.write_flat || [];
  const i = Number(st.write_index || 0);
  if (i >= flat.length) {
    attachCountLedger(row);
    row.status = row.saved_count > 0 ? "done" : "error";
    row.step = "done";
    row.label_ko = row.saved_count > 0
      ? `완료: ${row.saved_count}개 draft 저장`
      : "초안이 저장되지 않았습니다.";
    if (row.status === "error") row.error = (st.write_errors || []).slice(0, 3).join(" · ") || "작성 실패";
    return;
  }
  const chunk = flat.slice(i, i + WRITE_CHUNK);
  const voiceSince = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const { data: voiceActs } = await supabase
    .from("account_activities")
    .select("text_body, post_type, action_type, published_at, system_origin_class, meta")
    .gte("published_at", voiceSince)
    .limit(400);
  const posts = await writeSlotBatch({
    slots: chunk,
    openaiKey: openaiKey || null,
    voiceRows: (voiceActs || []) as any,
    audienceSignals: audienceBarrierSignalsFromActivityMeta((voiceActs || []) as any),
    weekSignatures: st.weekly_signatures || [],
    skipSelectiveRegen: true,
  });
  st.write_outcomes = Array.isArray(st.write_outcomes) ? st.write_outcomes : [];
  st.weekly_signatures = Array.isArray(st.weekly_signatures) ? st.weekly_signatures : [];
  for (let k = 0; k < posts.length; k++) {
    const p = posts[k];
    const text = String(p.final_text || p.content || "").trim();
    st.write_outcomes.push({
      slotId: p.slotId,
      slot_id: p.slotId,
      final_text: text,
      generation_status: p.generation_status,
      judge_status: p.judge_status || "",
      semantic_regen_attempts: p.semantic_regen_attempts || 0,
      slot_final_state: p.slot_final_state || (text ? "ACCEPTED_PASS" : "BLOCKED"),
      regeneration_route_history: p.regeneration_route_history || [],
      writer_call_attempted: p.writer_call_attempted,
      block_reasons: p.block_reasons || [],
    });
    if (text && p.structural_signature) {
      st.weekly_signatures.push(p.structural_signature);
    }
    if (!text) {
      st.write_errors = [...(st.write_errors || []), `${p.slotId || "slot"} 빈 초안`];
      const subj = String((chunk[k] as any)?.concrete_subject || "");
      if (!(chunk[k] as any)?._write_retry && !isFrozenHumorClone(subj)) {
        st.write_flat = [...(st.write_flat || []), { ...chunk[k], _write_retry: true }];
      }
      continue;
    }
    let ins = await supabase.from("SeungContent").insert({
      content: text,
      status: "draft",
      pipeline_id: "42303",
      user_id: userId,
      topic: String(p.primaryTopic || p.concrete_subject || ""),
      strategy_json: {
        system_origin_class: "AP_PIPELINE",
        slotId: p.slotId || null,
        writer_model: "gpt-4o",
        engine: "v11_inferred_quota_fill",
        job_id: row.id,
      },
    });
    if (ins.error) {
      ins = await supabase.from("SeungContent").insert({
        content: text,
        status: "draft",
        pipeline_id: "42303",
        user_id: userId,
      });
    }
    if (!ins.error) row.saved_count = Number(row.saved_count || 0) + 1;
  }
  st.write_index = i + chunk.length;
  const planned = (st.write_flat || []).length;
  row.label_ko = `초안 생성 ${row.saved_count}/${planned}…`;
  if (st.write_index >= planned) {
    const required = Number(row.required_slots) || 0;
    row.step = "done";
    attachCountLedger(row);
    if (row.saved_count < required) {
      if (row.saved_count > 0) {
        row.status = "done";
        row.error = null;
        row.label_ko = `리뷰: ${row.saved_count}개 저장 · 할당 ${row.saved_count}/${required}`;
      } else {
        row.status = "error";
        row.error = `초안 ${row.saved_count}/${required}만 저장됨. ${(st.write_errors || []).slice(0, 3).join(" · ")}`;
        row.label_ko = row.error;
      }
    } else {
      row.status = "done";
      row.label_ko = `완료: ${row.saved_count}개 draft 저장 · 리뷰하세요`;
    }
  }
}
