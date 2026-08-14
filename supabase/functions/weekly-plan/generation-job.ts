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
import { writeSlotBatch, V11_WRITER_MODEL } from "./order-write-pipeline.ts";
import { inferWeeklyQuota, quotaFromCadence, QUOTA_DAYS, QUOTA_PER_DAY_MIN, QUOTA_PER_DAY_MAX } from "./quota-inference.ts";

const EXPAND_BATCH = 6;
const JUDGE_BATCH = 16;
const WRITE_CHUNK = 2;
const COLLISION_DAYS = 30;

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
  return Math.min(16, Math.max(6, Math.ceil(slots / 7)));
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
    label_ko: "주간 할당량 추론…",
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
  if (lockedAt && Date.now() - lockedAt < 40000) return publicView(row);

  row.locked_at = new Date().toISOString();
  await saveRow(args.supabase, row);

  try {
    if (row.step === "quota") await stepQuota(args.supabase, args.xaiKey, row);
    else if (row.step === "expand") await stepExpand(args.supabase, args.xaiKey, row);
    else if (row.step === "judge") await stepJudge(row);
    else if (row.step === "select") await stepSelect(args.supabase, row);
    else if (row.step === "write") await stepWrite(args.supabase, args.xaiKey, args.userId, row);
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
  return { publishedEvidence, learned };
}

async function stepQuota(supabase: any, xaiKey: string, row: any) {
  const st = row.state;
  const intentText = String(st.topic || "").trim();
  const { learned } = await loadEvidence(supabase, st.publishedTopics || [], intentText);
  const quota = xaiKey
    ? await inferWeeklyQuota({
      xaiKey,
      cadence: learned.cadence,
      clusterWeights: learned.cluster_weights,
      userDirectN: learned.user_direct_n,
      performanceHints: learned.performance_pattern_hints,
      learning: learned.learning,
      explicitCreatorIntent: intentText || undefined,
      model: V11_WRITER_MODEL,
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
  ].filter(Boolean).join("\n");
  row.step = "expand";
  row.label_ko = `시드 추론 0/${quota.required_slots}…`;
}

async function stepExpand(supabase: any, xaiKey: string, row: any) {
  const st = row.state;
  const required = Number(row.required_slots) || 0;
  const intentText = String(st.topic || "").trim();
  const published = (st.publishedTopics || []).map(String);
  const { publishedEvidence, learned } = await loadEvidence(supabase, published, intentText);
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
  const candidates: any[] = [...(gated.passed || [])];
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
    model: V11_WRITER_MODEL,
    timeoutMs: 32000,
  });
  st.dim_batch = Number(st.dim_batch || 0) + 1;
  const added: any[] = [];
  for (const s of xaiRes.seeds || []) {
    if (/관찰·판단 축/.test(String(s.concrete_subject || ""))) continue;
    added.push({
      ...s,
      source_role: "SEED_SOURCE",
      source_trace: { source_role: "SEED_SOURCE", source_type: "CREATOR_SEED_REASONING", leakage_guard_result: "PASS" },
    });
  }
  st.gated = [...(st.gated || []), ...added];
  for (const s of added) {
    if (s.concrete_subject) priorSubjects.push(String(s.concrete_subject));
  }
  st.prior_subjects = priorSubjects.slice(-priorSubjectCap(required));
  st.last_expand_error = xaiRes.error || "";
  if (added.length <= 0) {
    st.empty_streak = Number(st.empty_streak || 0) + 1;
    if (st.empty_streak >= 4) {
      row.status = "error";
      row.error = `Grok 시드 추론이 반복 실패했습니다 (${st.gated.length}/${required}). 템플릿으로 채우지 않습니다.` +
        (st.last_expand_error ? ` 원인: ${st.last_expand_error}` : "");
      row.label_ko = "시드 추론 실패";
      row.summary = [row.summary, st.last_expand_error ? `expand: ${st.last_expand_error}` : ""].filter(Boolean).join("\n");
      return;
    }
  } else {
    st.empty_streak = 0;
  }
  row.label_ko = `시드 추론 ${st.gated.length}/${required}…`;
  if (st.gated.length >= required || st.dim_batch >= st.max_expand) {
    if (st.gated.length < required) {
      row.status = "error";
      row.error = `시드 ${st.gated.length}/${required}. 할당량을 채우지 못해 중단합니다.`;
      return;
    }
    row.step = "judge";
    row.label_ko = "시드 판정…";
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
  if (eligibleOf(judged).length < required && st.topup < st.max_topup) {
    st.topup = Number(st.topup || 0) + 1;
    row.step = "expand";
    row.label_ko = `할당량 보충 ${eligibleOf(judged).length}/${required}…`;
    return;
  }
  if (eligibleOf(judged).length < required) {
    row.status = "error";
    row.error = `판정 통과 ${eligibleOf(judged).length}/${required}. Grok이 할당량을 채우지 못했습니다.`;
    return;
  }
  row.step = "select";
  row.label_ko = "주간 배치…";
}

async function stepSelect(supabase: any, row: any) {
  const st = row.state;
  const required = Number(row.required_slots) || 0;
  const postsPerDay = Math.min(QUOTA_PER_DAY_MAX, Math.max(QUOTA_PER_DAY_MIN, Number(st.posts_per_day) || 4));
  const mix = allocateEditorialSlots(required, undefined);
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
    pool.push(s);
  }
  const selectedWeekly: ConcreteSeed[] = [];
  const queue = buildEditorialQueue(mix.allocation as any);
  const outDays: Array<{ dayOffset: number; posts: any[] }> = Array.from({ length: QUOTA_DAYS }, (_, i) => ({
    dayOffset: i,
    posts: [],
  }));
  for (const plannedMode of queue) {
    const mode = plannedMode as EditorialMode;
    const cands = pool
      .map((s, i) => ({ s, i, div: conceptualDiversityScore(s, selectedWeekly) }))
      .filter(({ s }) => canServeEditorialMode(s, mode))
      .sort((a, b) => b.div - a.div);
    let picked: ConcreteSeed | null = null;
    for (const { s, i } of cands) {
      if (conceptualRepetitionLevel(s, selectedWeekly) === "HIGH") continue;
      picked = s;
      pool.splice(i, 1);
      break;
    }
    if (!picked) continue;
    selectedWeekly.push(picked);
    let bestDay = 0;
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
  const redistributed = redistributeDailyTopics(outDays, postsPerDay);
  for (let di = 0; di < redistributed.days.length; di++) {
    redistributed.days[di].posts.forEach((p: any, si: number) => {
      p.dayOffset = di;
      p.slotId = `D${di + 1}P${si + 1}`;
    });
  }
  const totalPlanned = redistributed.days.reduce((s, d) => s + d.posts.length, 0);
  if (totalPlanned < required && st.select_tries < st.max_topup) {
    st.select_tries = Number(st.select_tries || 0) + 1;
    row.step = "expand";
    row.label_ko = `계획 부족 → 시드 추가 ${st.select_tries}…`;
    return;
  }
  if (totalPlanned < required) {
    row.status = "error";
    row.error = `주간 계획이 ${totalPlanned}/${required}입니다. 할당량을 채운 뒤에만 저장합니다.`;
    return;
  }
  st.days = redistributed.days;
  st.write_flat = redistributed.days.flatMap((d) => d.posts || []);
  st.write_index = 0;
  row.summary = [
    row.summary,
    `expand_seeds: ${(st.gated || []).length} · judged: ${(st.judged || []).length} · planned: ${totalPlanned}`,
  ].filter(Boolean).join("\n");
  row.step = "write";
  row.label_ko = `초안 생성 0/${totalPlanned}…`;
}

async function stepWrite(supabase: any, xaiKey: string, userId: string, row: any) {
  const st = row.state;
  const flat: any[] = st.write_flat || [];
  const i = Number(st.write_index || 0);
  if (i >= flat.length) {
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
    xaiKey: xaiKey || null,
    voiceRows: (voiceActs || []) as any,
  });
  for (const p of posts) {
    const text = String(p.final_text || p.content || "").trim();
    if (!text) {
      st.write_errors = [...(st.write_errors || []), `${p.slotId || "slot"} 빈 초안`];
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
        writer_model: "grok-4.6",
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
  row.label_ko = `초안 생성 ${row.saved_count}/${flat.length}…`;
  if (st.write_index >= flat.length) {
    const required = Number(row.required_slots) || 0;
    row.step = "done";
    if (row.saved_count < required) {
      row.status = "error";
      row.error = `초안 ${row.saved_count}/${required}만 저장됨. ${(st.write_errors || []).slice(0, 3).join(" · ")}`;
      row.label_ko = row.error;
    } else {
      row.status = "done";
      row.label_ko = `완료: ${row.saved_count}개 draft 저장`;
    }
  }
}
