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
  conceptualRepetitionLevel,
  isUsableKeywordSubject,
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
import { QUOTA_DAYS, QUOTA_PER_DAY_MIN, QUOTA_PER_DAY_MAX, SEED_POOL_BUFFER } from "./quota-inference.ts";
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
  isSlotTypeLabel,
  pickDayForMass,
  enforceMassPerDay,
  demoteExperienceOnMassSlots,
  placeableSeedCount,
} from "./seed-scope.ts";
import {
  isHumorFillSeed,
  isFrozenHumorClone,
} from "./humor-fill.ts";
import {
  overlayClusterWeightsWithIntent14d,
} from "./creator-intent-14d.ts";
import { audienceBarrierSignalsFromActivityMeta } from "./audience-reaction-intelligence.ts";
import { buildRecentExperienceCandidates } from "./experience-evidence.ts";
import { analyticsLivedSeeds, syncGapLivedSeeds } from "./analytics-lived-seeds.ts";
import { applyNewestLivedExperienceAssignments, isLivedSelfSeed, publicSearchWindows } from "./seed-ownership.ts";
import { fetchOfficialPublicPosts, loadEdgeXAccessToken, OPERATOR_HANDLE } from "./public-x-seed-search.ts";
import {
  attachSeedsForSlots,
  loadRecentXAnalyticsPublished,
  nextStrategyDayOffsets,
  nextUnassignedDayOffsets,
  selectSeedsForDays,
  strategyCoversSevenDays,
  type PlannerSeedAssignment,
  type PlannerSlotIntent,
  type SevenDayStrategy,
  type SevenDayVolume,
} from "./seven-day-planner.ts";
import { stampPlannerSlotTimes } from "./for-you-spread.ts";
import { judgeWeekCount } from "./semantic-judge.ts";
import { BUNDLED_X_ANALYTICS_WINDOW } from "./x-analytics-30d-bundled.ts";
import { buildAudienceXStatus, type AudienceXStatus } from "./audience-x-status.ts";
import {
  creatorRelabelRejectBatch,
  inferCreatorSlotsForDays,
  inferCreatorWeekVolume,
} from "./creator-week-slots.ts";

const EXPAND_BATCH = 10;
const WRITE_CHUNK = 1;
const RECOVER_WRITE_CHUNK = 4;
const COLLISION_DAYS = 30;
/** Shorter than Edge ~60s wall so a killed invoke unlocks and the next tick retries. */
const JOB_LOCK_MS = 55000;
const EXPAND_HARD_CAP = 36;
const CANDIDATE_RESERVE_MIN = SEED_POOL_BUFFER;

export type JobStep = "quota" | "expand" | "strategy" | "select" | "write" | "recover" | "done";

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
  last_reject_ko?: string;
  reject_log?: string[];
  report_ko?: string;
  learning?: unknown;
};

const JUDGE_REASON_KO: Record<string, string> = {
  empty_final_text: "빈 글",
  lived_time_day_count: "N일 전 시점",
  other_viral_inhabited: "남의 바이럴을 내 경험처럼 씀",
  fabricated_factual_claim: "사실 날조",
  seed_meaning_departure: "배정 Seed와 다른 글",
  question_closer: "물음표로 끝내는 참여 유도",
  expert_jargon: "전문가 jargon",
  token_stutter: "토큰 반복",
  generic_thesis: "일반론 결론",
  creator_identity_contradiction: "Creator 정체성 충돌",
  manual_text_leakage: "원문 누수",
  WRITER_FAILURE: "Writer 실패",
  writer_call_failed: "Writer 호출 실패",
  xai_timeout: "Writer 시간 초과",
  xai_key_missing: "Writer 키 없음",
  xai_empty_content: "Writer 빈 응답",
};

function isWriterFailure(reasons: unknown[], judgeStatus?: string): boolean {
  if (String(judgeStatus || "") === "REJECT") return false;
  return (reasons || []).some((r) =>
    /^(writer_call_failed|xai_timeout|WRITER_FAILURE|xai_key_missing|xai_empty_content|xai_http|xai_fetch)/i.test(String(r || "")),
  );
}

/** Slow/unavailable xAI must not end the weekly job. Invalid JSON still uses the 3-try cap. */
export function isTransientXaiError(err: unknown): boolean {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name?: unknown }).name) : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/xai_key_missing|XAI_API_KEY/i.test(msg)) return false;
  if (name === "AbortError" || name === "TimeoutError") return true;
  return /xai_timeout|writer_call_failed|xai_http_429|xai_http_5|xai_fetch|AbortError|timed out/i.test(msg);
}

function holdForXai(row: any, label: string, detail: string) {
  row.status = "running";
  row.label_ko = label;
  const line = String(detail || "").trim();
  if (line) row.summary = [row.summary, line].filter(Boolean).join("\n");
}

function formatPipelineReject(subject: string, reasons: unknown[], judgeStatus?: string): string {
  const prefix = isWriterFailure(reasons, judgeStatus) ? "Writer 실패 ·" : "Judge 거절 ·";
  return `${prefix} ${subject} · ${judgeReasonsKo(reasons)}`;
}

function judgeReasonsKo(reasons: unknown[]): string {
  const raw = (reasons || []).map((r) => String(r || "").trim()).filter(Boolean);
  if (!raw.length) return "이유 코드 없음";
  return raw
    .slice(0, 8)
    .map((r) => {
      const ko = JUDGE_REASON_KO[r];
      return ko && ko !== r ? `${ko} (${r})` : r;
    })
    .join(", ");
}

function appendRejectLog(st: any, line: string) {
  st.reject_log = Array.isArray(st.reject_log) ? st.reject_log : [];
  const text = String(line || "").trim();
  if (!text) return;
  if (st.reject_log[st.reject_log.length - 1] === text) return;
  st.reject_log.push(text);
  if (st.reject_log.length > 40) st.reject_log = st.reject_log.slice(-40);
}

function clip(text: unknown, n: number): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function countBag(items: string[]): string {
  const bag: Record<string, number> = {};
  for (const item of items) {
    const key = String(item || "UNKNOWN").trim() || "UNKNOWN";
    bag[key] = Number(bag[key] || 0) + 1;
  }
  const parts = Object.entries(bag).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return parts.length ? parts.map(([k, n]) => `${k} ${n}`).join(", ") : "없음";
}

function buildJobReportKo(row: any): string {
  const st = row?.state || {};
  const gated: any[] = Array.isArray(st.gated) ? st.gated : [];
  const targeted = gated.filter((s) => String(s?.source_type || "") === "PLANNER_TARGETED_EXPLORATION");
  const outcomes: any[] = Array.isArray(st.write_outcomes) ? st.write_outcomes : [];
  const history: any[] = Array.isArray(st.recovery_history) ? st.recovery_history : [];
  const abandoned = [...abandonedSeedIds(st)];
  const passN = outcomes.filter((o) => String(o?.final_text || "").trim() && String(o?.judge_status || "") !== "REJECT").length;
  const rejectN = outcomes.filter((o) => String(o?.judge_status || "") === "REJECT" || !String(o?.final_text || "").trim()).length;
  const lines: string[] = [
    "생성 보고서",
    `목표 슬롯 ${Number(row.required_slots) || 0} · PASS 저장 ${Number(row.saved_count) || 0} · 상태 ${row.status || ""}`,
    "",
    `1. Seed Generator 후보 ${gated.length}개`,
    `   유형(cluster): ${countBag(gated.map((s) => String(s?.cluster || "UNKNOWN")))}`,
    `   모드: ${countBag(gated.map((s) => String(s?.requested_editorial_mode || s?.editorial_mode || "INFORMATIVE")))}`,
    `   Planner 지정 분야 재추출 ${targeted.length}개 (한 번에 최대 ${TARGETED_EXPLORE_SEED_COUNT}개)`,
  ];
  for (const seed of gated.slice(0, 40)) {
    lines.push(`   - ${clip(seed?.seed_id, 24)} · ${clip(seed?.cluster, 24)} · ${clip(seed?.concrete_subject, 80)}`);
  }
  if (gated.length > 40) lines.push(`   …외 ${gated.length - 40}개`);
  lines.push("", `2. Writer → Judge ${outcomes.length}회 (거절 문장은 지우고 새 배차로만 다시 씀)`);
  for (const o of outcomes.slice(-60)) {
    const pass = String(o?.final_text || "").trim() && String(o?.judge_status || "") !== "REJECT";
    const reasons = judgeReasonsKo(o?.block_reasons || o?.judge_reasons || []);
    lines.push(
      `   - ${pass ? "PASS" : "REJECT"} · seed ${clip(o?.seed_id, 24) || "?"} · ${clip(o?.concrete_subject || o?.slotId, 60)}`,
    );
    if (pass) lines.push(`     글: ${clip(o?.final_text, 140) || "(저장됨)"}`);
    else lines.push(`     이유: ${reasons}`);
  }
  lines.push("", `3. Judge 거절 ${rejectN} · Writer/Judge 시도 중 PASS ${passN}`);
  const planned = (st.planner_strategy?.slots || []).filter((s: any) => s?.planned_pt);
  if (planned.length) {
    lines.push("", "3b. Planner 예정 시각 (America/Los_Angeles, For You 간격)");
    for (const slot of planned.slice(0, 56)) {
      lines.push(`   - ${clip(slot.slot_id, 16)} · D${Number(slot.day_offset) + 1} · ${clip(slot.planned_pt, 32)}`);
    }
  }
  lines.push("", "4. Planner 재배차");
  if (!history.length) lines.push("   없음");
  for (const h of history.slice(-40)) {
    const action = String(h?.action || "");
    if (action === "TARGETED_EXPLORE") {
      lines.push(`   - 슬롯 ${clip(h?.strategy_slot_id, 24)} · 후보 없음 → Seed Generator 그 분야 10개 · ${clip(h?.exploration_direction, 80)}`);
    } else {
      lines.push(`   - 슬롯 ${clip(h?.strategy_slot_id, 24)} · 시드 ${clip(h?.from_seed_id, 24) || "?"} → ${clip(h?.to_seed_id, 24) || "?"} (${action || "RESELECT"})`);
    }
  }
  lines.push("", `5. Planner가 버린 Seed(3회 거절) ${abandoned.length}개: ${abandoned.length ? abandoned.map((id) => clip(id, 24)).join(", ") : "없음"}`);
  lines.push("6. Writer가 거절된 글을 다시 썼는가: 아니오. Judge 거절 문장은 비우고 Planner가 고른 Seed로 새로 씀.");
  lines.push(`7. Seed 재추출: ${targeted.length || history.some((h) => h?.action === "TARGETED_EXPLORE") ? "있음 (해당 분야만, 전체 풀 재시작 아님)" : "없음"}`);
  return lines.join("\n");
}

function rejectLogFromState(st: any): string[] {
  if (Array.isArray(st.reject_log) && st.reject_log.length) return st.reject_log.slice(-40);
  const out: string[] = [];
  for (const o of st.write_outcomes || []) {
    const rejected = String(o?.judge_status || "") === "REJECT" || !String(o?.final_text || "").trim();
    const reasons = o?.block_reasons || o?.judge_reasons || [];
    if (!rejected && !(Array.isArray(reasons) && reasons.length)) continue;
    const subject = String(o?.concrete_subject || o?.slotId || o?.slot_id || "slot").slice(0, 40);
    out.push(formatPipelineReject(subject, reasons, o?.judge_status));
  }
  return out.slice(-40);
}

function expandRoundBudget(requiredSlots: number): number {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  const fill = Math.ceil((slots * 1.2) / 3);
  return Math.min(EXPAND_HARD_CAP, Math.max(16, fill + 8));
}

function quotaFilled(row: any): boolean {
  return judgeWeekCount({
    planned_slots: row.required_slots,
    passed_saved: row.saved_count,
  }).complete;
}

const SEED_REJECT_ABANDON = 3;
/** Planner-targeted Seed Generator refill is one batch of this size, not a single seed. */
const TARGETED_EXPLORE_SEED_COUNT = 10;
/** Same-field Seed refill cap. Batch is still 10. */
const FIELD_REFILL_MAX = 30;

function seedIdOf(slot: any): string {
  return String(slot?.seed_id || "").trim();
}

function bumpSeedReject(st: any, seedId: string): number {
  const id = String(seedId || "").trim();
  st.seed_reject_counts = st.seed_reject_counts && typeof st.seed_reject_counts === "object" ? st.seed_reject_counts : {};
  if (!id) return 0;
  const n = Number(st.seed_reject_counts[id] || 0) + 1;
  st.seed_reject_counts[id] = n;
  return n;
}

function abandonedSeedIds(st: any): Set<string> {
  const out = new Set<string>();
  const counts = st.seed_reject_counts && typeof st.seed_reject_counts === "object" ? st.seed_reject_counts : {};
  for (const [id, n] of Object.entries(counts)) {
    if (id && Number(n) >= SEED_REJECT_ABANDON) out.add(id);
  }
  return out;
}

function savedSeedIds(st: any): Set<string> {
  return new Set(
    (st.write_flat || []).filter((slot: any) => slot?._saved).map((slot: any) => seedIdOf(slot)).filter(Boolean),
  );
}

function remainingUnwrittenSeedIds(st: any): string[] {
  return (st.write_flat || [])
    .slice(Number(st.write_index || 0))
    .map((slot: any) => seedIdOf(slot))
    .filter(Boolean);
}

/** Recover pool is gated Seeds minus saved PASS drafts and 3-strike abandoned Seeds. Not a hard-ban of rejected or unwritten Seeds. */
function recoverSeedPool(st: any): any[] {
  const saved = savedSeedIds(st);
  const abandoned = abandonedSeedIds(st);
  return (st.gated || []).filter((seed: any) => {
    const id = String(seed.seed_id || "");
    return id && !saved.has(id) && !abandoned.has(id);
  });
}

function enqueueRecovery(st: any, item: Record<string, unknown>) {
  st.recovery_queue = Array.isArray(st.recovery_queue) ? st.recovery_queue : [];
  st.recovery_queue.push(item);
}

function takeQueuedRecovery(st: any): any | null {
  st.recovery_queue = Array.isArray(st.recovery_queue) ? st.recovery_queue : [];
  while (st.recovery_queue.length) {
    const next = st.recovery_queue.shift();
    if (next) return next;
  }
  return null;
}

function slotExplorationDirection(slot: any): string {
  return String(slot?.planner_intent || slot?.cluster || slot?.concrete_subject || "creator adjacent field").slice(0, 240);
}

function fieldRefillKey(direction: string): string {
  return String(direction || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

function fieldRefillUsed(st: any, direction: string): number {
  st.field_refill_counts = st.field_refill_counts && typeof st.field_refill_counts === "object"
    ? st.field_refill_counts
    : {};
  return Number(st.field_refill_counts[fieldRefillKey(direction)] || 0);
}

function canRefillField(st: any, direction: string): boolean {
  return fieldRefillUsed(st, direction) < FIELD_REFILL_MAX;
}

function recordFieldRefill(st: any, direction: string, n = TARGETED_EXPLORE_SEED_COUNT) {
  st.field_refill_counts = st.field_refill_counts && typeof st.field_refill_counts === "object"
    ? st.field_refill_counts
    : {};
  const key = fieldRefillKey(direction);
  st.field_refill_counts[key] = Math.min(FIELD_REFILL_MAX, Number(st.field_refill_counts[key] || 0) + n);
}

function missingSlotFingerprint(missing: Array<{ slot_id?: string }>): string {
  return (missing || []).map((item) => String(item.slot_id || "")).filter(Boolean).sort().join(",");
}

function fillUnassignedPlannerSlotsFromPool(args: {
  slots: PlannerSlotIntent[];
  assignments: PlannerSeedAssignment[];
  pool: ConcreteSeed[];
}): PlannerSeedAssignment[] {
  const usedSlots = new Set(args.assignments.map((item) => String(item.slot_id || "")));
  const usedSeeds = new Set(args.assignments.map((item) => String(item.seed_id || "")).filter(Boolean));
  const unused = (args.pool || []).filter((seed) => seed?.seed_id && !usedSeeds.has(String(seed.seed_id)));
  const out = [...args.assignments];
  for (const slot of args.slots || []) {
    if (!slot?.slot_id || usedSlots.has(slot.slot_id)) continue;
    const mode = parseEditorialMode(String(slot.editorial_mode || ""));
    let idx = unused.findIndex((seed) =>
      canServeEditorialMode(seed, mode) && !usedSeeds.has(String(seed.seed_id)),
    );
    if (idx < 0 && mode !== "EXPERIENCE") {
      idx = unused.findIndex((seed) => !usedSeeds.has(String(seed.seed_id)));
    }
    if (idx < 0) continue;
    const seed = unused.splice(idx, 1)[0];
    usedSlots.add(slot.slot_id);
    usedSeeds.add(String(seed.seed_id));
    out.push({
      slot_id: slot.slot_id,
      seed_id: String(seed.seed_id),
      planner_intent: slot.planner_intent,
      editorial_mode: mode,
    });
  }
  return out;
}

function requestTargetedSeedRefill(row: any, pending: any, reason: string) {
  const st = row.state;
  const slot = pending?.slot || pending;
  const direction = slotExplorationDirection(slot);
  if (!canRefillField(st, direction)) {
    st.pending_recovery = null;
    row.step = "write";
    row.summary = [row.summary, `${reason} · 같은 분야 Seed 재추출 한도 ${FIELD_REFILL_MAX}`].filter(Boolean).join("\n");
    return;
  }
  recordFieldRefill(st, direction);
  st.planner_exploration_direction = direction;
  st.planner_missing_count = TARGETED_EXPLORE_SEED_COUNT;
  st.max_expand = Number(st.max_expand || 0) + 4;
  st.pending_recovery = pending;
  row.step = "expand";
  row.label_ko = "Planner 지정 분야 Seed 추가 탐색…";
  row.summary = [row.summary, reason].filter(Boolean).join("\n");
}

function drainRecoveryQueue(st: any): any[] {
  const batch: any[] = [];
  if (st.pending_recovery && !st.pending_recovery.batch) {
    batch.push(st.pending_recovery);
  }
  st.recovery_queue = Array.isArray(st.recovery_queue) ? st.recovery_queue : [];
  while (st.recovery_queue.length) {
    const next = st.recovery_queue.shift();
    if (next) batch.push(next);
  }
  return batch;
}

function beginRecoverIfQueueReady(row: any, required: number): boolean {
  const st = row.state;
  if (Number(st.write_index || 0) < (st.write_flat || []).length) return false;
  if (Array.isArray(st.recover_batch) && st.recover_batch.length) {
    row.step = "recover";
    row.label_ko = `거절 ${st.recover_batch.length}칸 재배차 ${row.saved_count}/${required}…`;
    return true;
  }
  const queued = Array.isArray(st.recovery_queue) ? st.recovery_queue.length : 0;
  const hasPending = !!st.pending_recovery && !st.pending_recovery.batch;
  if (!queued && !hasPending) return false;
  const batch = drainRecoveryQueue(st);
  if (!batch.length) return false;
  st.recover_batch = batch;
  st.recover_relabeled = false;
  st.recover_write = true;
  st.pending_recovery = { batch: true, attempts: 0, strategy_slot_id: batch[0]?.strategy_slot_id, slot: batch[0]?.slot, judge_reasons: batch.flatMap((item: any) => item.judge_reasons || []).slice(0, 12) };
  row.step = "recover";
  row.label_ko = `거절 ${batch.length}칸 Creator DNA 재판단 ${row.saved_count}/${required}…`;
  return true;
}

function canKeepExpanding(st: any): boolean {
  return Number(st.dim_batch || 0) < Number(st.max_expand || 0);
}

function candidatePoolTarget(requiredSlots: number): number {
  const required = Math.round(Number(requiredSlots) || 0);
  if (required <= 0) return EXPAND_BATCH;
  return required + CANDIDATE_RESERVE_MIN;
}

function publicViralSeedCount(gated: any[]): number {
  return (gated || []).filter((s) => !isLivedSelfSeed(s)).length;
}

function expandPoolFilled(requiredSlots: number, gated: any[]): boolean {
  const required = Math.round(Number(requiredSlots) || 0);
  if (required <= 0) return publicViralSeedCount(gated) >= EXPAND_BATCH;
  return (gated || []).length >= candidatePoolTarget(required);
}

function shouldSkipPublicXSearch(
  requiredSlots: number,
  gated: any[],
  targetedExploration: string,
): boolean {
  if (String(targetedExploration || "").trim()) return false;
  return expandPoolFilled(requiredSlots, gated);
}

function plannerStepAfterExpand(st: any): JobStep {
  if (st.pending_recovery || (Array.isArray(st.recover_batch) && st.recover_batch.length)) return "recover";
  if (st.planner_strategy) return "select";
  return "strategy";
}

function labelForPlannerStep(step: JobStep): string {
  if (step === "strategy") return "탐색 완료 · 슬롯 수 정하는 중";
  if (step === "recover") return "Planner 재배차…";
  return "Planner Seed 선택…";
}

function refillRequestCount(deficit: number): number {
  const missing = Math.max(1, Math.ceil(Number(deficit) || 1));
  return Math.min(EXPAND_BATCH, Math.max(TARGETED_EXPLORE_SEED_COUNT, missing));
}

function bumpReason(bag: Record<string, number>, reason: string, n = 1): void {
  if (!reason || n <= 0) return;
  bag[reason] = Number(bag[reason] || 0) + n;
}

/** Drop unsaved candidates. Keep saved drafts. Rebuild days so new seeds can fill holes. */
function keepOnlySavedWriteSlots(st: any): void {
  const saved = (st.write_flat || []).filter((p: any) => p && p._saved);
  const days = Array.from({ length: QUOTA_DAYS }, (_, i) => ({ dayOffset: i, posts: [] as any[] }));
  for (const p of saved) {
    const d = Math.max(0, Math.min(QUOTA_DAYS - 1, Number(p.dayOffset) || 0));
    days[d].posts.push(p);
  }
  for (let di = 0; di < days.length; di++) {
    days[di].posts.forEach((p: any, si: number) => {
      p.dayOffset = di;
      p.slotId = `D${di + 1}P${si + 1}`;
    });
  }
  st.days = days;
  st.write_flat = days.flatMap((d) => d.posts || []);
  st.write_index = st.write_flat.length;
}

function subjectKey(subject: string): string {
  return String(subject || "").replace(/\s+/g, "").toLowerCase();
}

function appendEligibleSeedsToWrite(
  st: any,
  seeds: ConcreteSeed[],
  required: number,
  postsPerDay: number,
): number {
  const days: Array<{ dayOffset: number; posts: any[] }> = Array.isArray(st.days) && st.days.length
    ? st.days
    : Array.from({ length: QUOTA_DAYS }, (_, i) => ({ dayOffset: i, posts: [] }));
  const flat: any[] = Array.isArray(st.write_flat) ? st.write_flat : [];
  const seen = new Set(flat.map((p: any) => subjectKey(p.concrete_subject)));
  let added = 0;
  for (const seed of seeds || []) {
    if (flat.length >= required) break;
    const subj = String(seed.concrete_subject || "");
    if (!isUsableKeywordSubject(subj)) continue;
    if (isSlotTypeLabel(subj) || isKoreaOnlySituation(subj) || isFrozenHumorClone(subj)) continue;
    const key = subjectKey(subj);
    if (!key || seen.has(key)) continue;
    const personal = isPersonalInterestSubject(subj, String(seed.cluster || ""));
    let day = -1;
    if (!personal) {
      day = pickDayForMass(days, postsPerDay, MASS_PER_DAY_MAX);
      if (day < 0) continue;
    } else {
      for (let d = 0; d < days.length; d++) {
        if ((days[d].posts || []).length < postsPerDay) {
          day = d;
          break;
        }
      }
    }
    if (day < 0) continue;
    let mode = parseEditorialMode(String((seed as any).requested_editorial_mode || seed.editorial_mode || "INFORMATIVE")) || "INFORMATIVE";
    if (isHumorFillSeed(seed as any)) mode = "CASUAL_OBSERVATION";
    if (mode === "EXPERIENCE" && !isLivedSelfSeed(seed as any)) {
      continue;
    }
    const slot = compactSlotLite(seed, day, (days[day].posts || []).length + 1, mode as EditorialMode);
    days[day].posts.push(slot);
    flat.push(slot);
    seen.add(key);
    added += 1;
  }
  st.days = days;
  st.write_flat = flat;
  return added;
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

function compactSlotLite(
  seed: ConcreteSeed,
  dayOffset: number,
  slot: number,
  mode: EditorialMode,
  planner?: { strategic_role?: string; planner_intent?: string; strategy_slot_id?: string; planned_at?: string; planned_pt?: string },
) {
  return {
    slotId: `D${dayOffset + 1}P${slot}`,
    dayOffset,
    primaryTopic: seed.concrete_subject,
    topic_cluster: seed.cluster,
    cluster: seed.cluster,
    concrete_subject: seed.concrete_subject,
    editorial_mode: mode,
    strategic_role: planner?.strategic_role || "",
    planner_intent: planner?.planner_intent || "",
    strategy_slot_id: planner?.strategy_slot_id || "",
    planned_at: planner?.planned_at || "",
    planned_pt: planner?.planned_pt || "",
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
    owner: (seed as any).owner || "OTHER",
    occurred_at: (seed as any).occurred_at || "",
    viral: !!(seed as any).viral,
    found_form: (seed as any).found_form || "",
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
    last_reject_ko: state.last_reject_ko || "",
    reject_log: rejectLogFromState(state),
    report_ko: buildJobReportKo(row),
    learning: state.learning || null,
  };
}

const STALE_JOB_KO = "배포로 이전 생성을 멈췄습니다. 다시 눌러 주세요.";
const STOPPED_JOB_KO = "생성을 멈췄습니다.";

function retireStaleRunningJob(row: any, appVersion: string): boolean {
  if (!row || row.status !== "running") return false;
  const stamped = String(row.state?.app_version || "");
  if (stamped && stamped === appVersion) return false;
  row.status = "error";
  row.error = STALE_JOB_KO;
  row.label_ko = "이전 생성 중단";
  row.locked_at = null;
  return true;
}

async function saveRow(supabase: any, row: any) {
  let q = supabase.from("generation_jobs").update({
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
  if (row.status === "running") q = q.eq("status", "running");
  const { error } = await q;
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
  appVersion: string;
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
    attempted_seed_subjects: [] as string[],
    seed_metrics: {
      requested: 0,
      raw_returned: 0,
      normalized_returned: 0,
      accepted: 0,
      rejected_by_reason: {} as Record<string, number>,
    },
    dim_batch: 0,
    empty_streak: 0,
    last_expand_error: "",
    days: [] as any[],
    write_flat: [] as any[],
    write_index: 0,
    write_errors: [] as string[],
    max_expand: 20,
    select_tries: 0,
    adjacent_fill: false,
    humor_fill: false,
    compact_next: false,
    adjacent_rounds: 0,
    write_started: false,
    write_fill_rounds: 0,
    posts_per_day: 4,
    quota: null as any,
    learning: null as any,
    planner_strategy: null as SevenDayStrategy | null,
    planner_volume: null as SevenDayVolume | null,
    planner_slots_partial: [] as PlannerSlotIntent[],
    planner_assignments: [] as PlannerSeedAssignment[],
    planner_strategy_attempts: 0,
    planner_volume_attempts: 0,
    planner_day_batch_attempts: 0,
    planner_selection_attempts: 0,
    planner_selection_failures: 0,
    planner_exploration_direction: "",
    pending_recovery: null as any,
    recovery_queue: [] as any[],
    seed_reject_counts: {} as Record<string, number>,
    field_refill_counts: {} as Record<string, number>,
    job_recovery_count: 0,
    recovery_history: [] as any[],
    app_version: args.appVersion,
  };
  const { data: running } = await args.supabase
    .from("generation_jobs")
    .select("id, status, step, saved_count, required_slots, label_ko, summary, error, state")
    .eq("user_id", args.userId)
    .eq("status", "running")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (running) {
    if (!retireStaleRunningJob(running, args.appVersion)) return publicView(running);
    await saveRow(args.supabase, running);
  }

  const insert = {
    user_id: args.userId,
    status: "running",
    step: "expand",
    saved_count: 0,
    required_slots: 0,
    label_ko: "Seed Generator 공개 X 탐색…",
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

export async function statusWeeklyJob(
  supabase: any,
  userId: string,
  jobId?: string,
  appVersion?: string,
): Promise<JobPublic | null> {
  let q = supabase.from("generation_jobs").select("id, status, step, saved_count, required_slots, label_ko, summary, error, state").eq("user_id", userId);
  if (jobId) q = q.eq("id", jobId);
  else q = q.eq("status", "running").order("updated_at", { ascending: false }).limit(1);
  const { data, error } = jobId ? await q.maybeSingle() : await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (data && appVersion && retireStaleRunningJob(data, appVersion)) {
    await saveRow(supabase, data);
  }
  return data ? publicView(data) : null;
}

export async function stopWeeklyJob(supabase: any, userId: string, jobId: string): Promise<JobPublic> {
  const { data: row, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (error || !row) throw new Error(error?.message || "job not found");
  if (row.status !== "running") return publicView(row);
  row.status = "error";
  row.error = STOPPED_JOB_KO;
  row.label_ko = "생성 멈춤";
  row.locked_at = null;
  await saveRow(supabase, row);
  return publicView(row);
}

export async function tickWeeklyJob(args: {
  supabase: any;
  userId: string;
  jobId: string;
  xaiKey: string;
  appVersion: string;
}): Promise<JobPublic> {
  const { data: row, error } = await args.supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", args.jobId)
    .eq("user_id", args.userId)
    .single();
  if (error || !row) throw new Error(error?.message || "job not found");
  if (row.status !== "running") return publicView(row);
  if (retireStaleRunningJob(row, args.appVersion)) {
    await saveRow(args.supabase, row);
    return publicView(row);
  }

  const lockedAt = row.locked_at ? Date.parse(String(row.locked_at)) : 0;
  if (lockedAt && Date.now() - lockedAt < JOB_LOCK_MS) return publicView(row);

  row.locked_at = new Date().toISOString();
  await saveRow(args.supabase, row);

  try {
    if (
      !row.state?.planner_strategy &&
      ["judge", "select", "write", "recover"].includes(String(row.step || ""))
    ) {
      if (Number(row.saved_count || 0) > 0) {
        row.status = "error";
        row.error = "이전 3일 runtime job입니다. 저장 초안은 보존했습니다. 새 7일 job을 시작하세요.";
        row.label_ko = "7일 Planner로 새로 시작 필요";
      } else {
        row.step = "strategy";
        row.label_ko = "7일 Planner 전략…";
      }
    }
    if (row.status !== "running") {
      // Compatibility transition above completed this tick without another call.
    }
    else if (row.step === "quota") await stepStrategy(args.supabase, args.xaiKey, row);
    else if (row.step === "expand") await stepExpand(args.supabase, args.xaiKey, row);
    else if (row.step === "judge") {
      // Resume compatibility for jobs created before Planner owned selection.
      row.step = row.state?.planner_strategy ? "select" : "strategy";
      row.label_ko = row.state?.planner_strategy ? "Planner Seed 선택…" : "7일 Planner 전략…";
    }
    else if (row.step === "strategy") await stepStrategy(args.supabase, args.xaiKey, row);
    else if (row.step === "select") await stepPlannerSelect(args.supabase, args.xaiKey, row);
    else if (row.step === "write") await stepWrite(args.supabase, args.xaiKey || "", args.userId, row);
    else if (row.step === "recover") await stepRecover(args.supabase, args.xaiKey || "", row);
    else if (quotaFilled(row)) {
      row.status = "done";
      row.step = "done";
      row.label_ko = `완료: ${row.saved_count}개 draft 저장 · 리뷰하세요`;
    } else {
      row.step = "expand";
      row.status = "running";
      row.label_ko = `할당량 이어서 추론 ${row.saved_count}/${row.required_slots}…`;
    }
  } catch (e: any) {
    if (isTransientXaiError(e)) {
      holdForXai(row, "xAI 응답 대기 · 다음 틱에서 이어감…", `xAI 일시 지연: ${String(e?.message || e).slice(0, 160)}`);
    } else {
      row.status = "error";
      row.error = String(e?.message || e).slice(0, 240);
      row.label_ko = "작업 실패";
    }
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

async function loadAudienceXStatus(supabase: any, analytics?: {
  rows: Array<{ post_id?: string | null; published_at?: string; content?: string }>;
}): Promise<AudienceXStatus> {
  const published = analytics || await loadRecentXAnalyticsPublished(supabase, 30);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: syncRows } = await supabase
    .from("account_activities")
    .select("text_body, post_type, action_type, published_at, x_post_id")
    .gte("published_at", since)
    .limit(500);
  const dates = published.rows.map((row) => String(row.published_at || "").slice(0, 10)).filter(Boolean).sort();
  return buildAudienceXStatus({
    analyticsFrom: dates[0],
    analyticsTo: dates[dates.length - 1],
    analyticsPosts: published.rows,
    syncPosts: syncRows || [],
  });
}

/** Seed Generator receives only minimum copy/experience boundary material, never strategic intelligence. */
async function loadSeedBoundaryEvidence(supabase: any) {
  const since = new Date(Date.now() - COLLISION_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await supabase
    .from("account_activities")
    .select("text_body, post_type, action_type, published_at, system_origin_class, x_post_id")
    .gte("published_at", since)
    .limit(400);
  const experience = buildRecentExperienceCandidates((rows || []).map((row: any) => ({
    ...row,
    post_type: row.post_type || row.action_type,
  })));
  return { experience };
}

async function stepExpand(supabase: any, xaiKey: string, row: any) {
  const st = row.state;
  const required = Number(row.required_slots) || 0;
  const intentText = String(st.topic || "").trim();
  if (!xaiKey) {
    row.status = "error";
    row.error = "SEED_INFERENCE_REQUIRES_XAI";
    row.label_ko = "xAI 키 없음";
    return;
  }
  const priorSubjects: string[] = st.prior_subjects || [];
  const poolTarget = candidatePoolTarget(required);
  const targetedExploration = String(st.planner_exploration_direction || "").trim();
  const nextPlannerStep = plannerStepAfterExpand(st);
  const experienceSeeds: any[] = [];
  if (!st.experience_injected) {
    const lived = analyticsLivedSeeds({ limit: 80 });
    let n = 0;
    for (const seed of lived) {
      n += 1;
      experienceSeeds.push({
        ...seed,
        seed_id: seed.seed_id || `lived-30d-${n}`,
        source_trace: {
          source_role: "SEED_SOURCE",
          source_type: "ANALYTICS_LIVED",
          leakage_guard_result: "PASS",
        },
      });
      if (seed.concrete_subject) priorSubjects.push(String(seed.concrete_subject));
    }
    const analyticsIds = new Set(
      lived.flatMap((seed: any) => (Array.isArray(seed.evidence_source_ids) ? seed.evidence_source_ids : []).map(String)).filter(Boolean),
    );
    const bundledPosts = Array.isArray((BUNDLED_X_ANALYTICS_WINDOW as { posts?: Array<{ post_id?: string }> }).posts)
      ? (BUNDLED_X_ANALYTICS_WINDOW as { posts: Array<{ post_id?: string }> }).posts
      : [];
    for (const post of bundledPosts) {
      if (post?.post_id) analyticsIds.add(String(post.post_id));
    }
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: syncRows } = await supabase
      .from("account_activities")
      .select("text_body, post_type, action_type, published_at, x_post_id")
      .gte("published_at", since)
      .limit(500);
    const gap = syncGapLivedSeeds({
      rows: syncRows || [],
      analyticsPostIds: analyticsIds,
      startN: lived.length,
      limit: 40,
    });
    for (const seed of gap) {
      experienceSeeds.push({
        ...seed,
        source_trace: {
          source_role: "SEED_SOURCE",
          source_type: "ANALYTICS_LIVED",
          leakage_guard_result: "PASS",
        },
      });
      if (seed.concrete_subject) priorSubjects.push(String(seed.concrete_subject));
    }
    st.experience_injected = true;
    st.experience_n = experienceSeeds.length;
    row.summary = [row.summary, `경험시드: ${lived.length} Analytics + ${gap.length} 동기화 공백 · 아카이브 폴백 없음`].filter(Boolean).join("\n");
  }
  if (experienceSeeds.length) {
    st.gated = [...(st.gated || []), ...experienceSeeds];
  }
  if (shouldSkipPublicXSearch(required, st.gated || [], targetedExploration)) {
    st.compact_next = false;
    st.prior_subjects = priorSubjects.slice(-priorSubjectCap(required));
    row.step = nextPlannerStep;
    row.label_ko = labelForPlannerStep(nextPlannerStep);
    return;
  }
  const discoveryRemaining = required <= 0
    ? Math.max(0, EXPAND_BATCH - publicViralSeedCount(st.gated || []))
    : Math.max(0, poolTarget - (st.gated || []).length);
  const requestedNow = targetedExploration
    ? TARGETED_EXPLORE_SEED_COUNT
    : Math.max(1, Math.min(EXPAND_BATCH, Math.max(discoveryRemaining, 1)));
  const existingHeld: ConcreteSeed[] = priorSubjects.map((s: string, i: number) => ({
    seed_id: `prior-${i + 1}`,
    cluster: "HELD",
    dimension: "PRIOR",
    concrete_subject: String(s).slice(0, 100),
    subject_signature: String(s).toLowerCase().slice(0, 80),
  }));
  const local = st.dim_batch === 0
    ? bootstrapCandidatesFromDimensions({ publishedSubjects: [], publishedEvidence: [], intentText })
    : [];
  const gated = applyLocalGates(local, [], createSeedIdFactory("s"));
  const candidates: any[] = [...(st.gated || []), ...(gated.passed || [])];
  const compact = !!st.compact_next || !!targetedExploration;
  const windows = publicSearchWindows();
  const searchWindow = windows.near;
  st.public_search_half = "near7";
  const token = await loadEdgeXAccessToken(supabase);
  const officialPublicPosts = await fetchOfficialPublicPosts({ accessToken: token, maxResults: 100 });
  const xaiRes = await expandSeedSupplyWithXai({
    xaiKey,
    needed: requestedNow,
    existing: [...candidates, ...existingHeld] as ConcreteSeed[],
    explicitCreatorIntent: intentText || undefined,
    explorationDirection: String(st.planner_exploration_direction || "") || undefined,
    plannerSlotIntents: Array.isArray(st.planner_strategy?.slots) ? st.planner_strategy.slots : undefined,
    plannerRequestedCount: candidatePoolTarget(required),
    compactRetry: compact,
    model: V11_SEED_MODEL,
    timeoutMs: compact ? 20000 : 40000,
    searchWindow,
    officialPublicPosts,
    excludeHandle: OPERATOR_HANDLE,
  });
  const metrics = st.seed_metrics || (st.seed_metrics = {
    requested: 0,
    raw_returned: 0,
    normalized_returned: 0,
    accepted: 0,
    rejected_by_reason: {},
  });
  metrics.requested += Number(xaiRes.requested || 0);
  metrics.raw_returned += Number(xaiRes.raw_returned || 0);
  metrics.normalized_returned += Number(xaiRes.returned || 0);
  for (const [reason, n] of Object.entries(xaiRes.reject_reasons || {})) {
    bumpReason(metrics.rejected_by_reason, reason, Number(n) || 0);
  }
  if (!isTransientXaiError(xaiRes.error)) {
    st.dim_batch = Number(st.dim_batch || 0) + 1;
  }
  const grokAdded: any[] = [];
  const roundPostRejected: Record<string, number> = {};
  const globallySeen = new Set(
    [...(st.gated || []), ...existingHeld].map((s: any) => subjectKey(String(s.concrete_subject || ""))),
  );
  for (const s of xaiRes.seeds || []) {
    const subject = String(s.concrete_subject || "");
    let rejectReason = "";
    if (/관찰·판단 축/.test(subject)) rejectReason = "ENGINE_LABEL_BODY";
    else if (isSlotTypeLabel(subject)) rejectReason = "SLOT_LABEL_BODY";
    else if (isKoreaOnlySituation(subject)) rejectReason = "KOREA_ONLY";
    else if (isFrozenHumorClone(subject)) rejectReason = "FROZEN_CLONE";
    else if (!isUsableKeywordSubject(subject)) rejectReason = "WEAK_SUBJECT";
    else if (globallySeen.has(subjectKey(subject))) rejectReason = "GLOBAL_DUPLICATE";
    if (rejectReason) {
      bumpReason(metrics.rejected_by_reason, rejectReason);
      bumpReason(roundPostRejected, rejectReason);
      continue;
    }
    globallySeen.add(subjectKey(subject));
    const rowSeed = {
      ...s,
      owner: "OTHER",
      seed_source: "PUBLIC_X",
      viral: true,
      source_role: "SEED_SOURCE",
      source_type: st.planner_exploration_direction ? "PLANNER_TARGETED_EXPLORATION" : "PUBLIC_X",
      source_trace: {
        source_role: "SEED_SOURCE",
        source_type: st.planner_exploration_direction ? "PLANNER_TARGETED_EXPLORATION" : "PUBLIC_X",
        leakage_guard_result: "PASS",
      },
    };
    grokAdded.push(rowSeed);
  }
  metrics.accepted += grokAdded.length;
  st.gated = [...(st.gated || []), ...grokAdded];
  for (const s of grokAdded) {
    if (s.concrete_subject) priorSubjects.push(String(s.concrete_subject));
  }
  st.prior_subjects = priorSubjects.slice(-priorSubjectCap(required));
  st.last_expand_error = xaiRes.error || "";
  const candidateCount = (st.gated || []).length;
  if (grokAdded.length <= 0) {
    const roundReasons: Record<string, number> = {};
    for (const [reason, n] of Object.entries(xaiRes.reject_reasons || {})) {
      bumpReason(roundReasons, reason, Number(n) || 0);
    }
    for (const [reason, n] of Object.entries(roundPostRejected)) {
      bumpReason(roundReasons, reason, Number(n) || 0);
    }
    const reasonText = Object.entries(roundReasons)
      .filter(([, n]) => Number(n) > 0)
      .map(([reason, n]) => `${reason} ${n}`)
      .join(", ");
    row.summary = [
      row.summary,
      `Seed round: 요청 ${xaiRes.requested || 0} · raw ${xaiRes.raw_returned || 0} · 정규화 ${xaiRes.returned || 0} · 추가 0` +
        (reasonText ? ` · 탈락 ${reasonText}` : "") +
        (xaiRes.error ? ` · xAI ${xaiRes.error}` : ""),
    ].filter(Boolean).join("\n");
    if (isTransientXaiError(st.last_expand_error || xaiRes.error)) {
      const poolReady = (st.gated || []).length > 0;
      if (targetedExploration || (required > 0 && poolReady) || (required <= 0 && poolReady)) {
        st.compact_next = false;
        row.step = nextPlannerStep;
        row.label_ko = labelForPlannerStep(nextPlannerStep);
        row.summary = [row.summary, "공개 검색 시간 초과 · 기존 Seed Pool로 Planner 이어감"].filter(Boolean).join("\n");
        return;
      }
      holdForXai(row, "xAI 응답 대기 · Seed 이어감…", `expand: ${st.last_expand_error || xaiRes.error}`);
      return;
    }
    st.empty_streak = Number(st.empty_streak || 0) + 1;
    if (st.empty_streak >= 4 && (st.gated || []).length < 1) {
      row.status = "error";
      row.error = `Grok 시드 추론이 반복 실패했습니다 (${st.gated.length}/${required}). 템플릿으로 채우지 않습니다.` +
        (st.last_expand_error ? ` 원인: ${st.last_expand_error}` : "");
      row.label_ko = "시드 추론 실패";
      row.summary = [row.summary, st.last_expand_error ? `expand: ${st.last_expand_error}` : ""].filter(Boolean).join("\n");
      return;
    }
    const livedReady = Number(st.experience_n || 0) > 0 || (st.gated || []).some((s: any) => isLivedSelfSeed(s));
    if (required <= 0 && livedReady && !targetedExploration) {
      st.compact_next = false;
      row.step = nextPlannerStep;
      row.label_ko = labelForPlannerStep(nextPlannerStep);
      return;
    }
    if (!compact) {
      st.compact_next = true;
      row.label_ko = `Seed 짧게 재추론 ${candidateCount}/${poolTarget}…`;
      if (st.last_expand_error) {
        row.summary = [row.summary, `expand: ${st.last_expand_error}`].filter(Boolean).join("\n");
      }
      return;
    }
    st.compact_next = false;
    if (expandPoolFilled(required, st.gated || []) && (st.gated || []).length > 0) {
      st.planner_exploration_direction = "";
      row.step = nextPlannerStep;
      row.label_ko = labelForPlannerStep(nextPlannerStep);
      return;
    }
    if (!expandPoolFilled(required, st.gated || []) && canKeepExpanding(st)) {
      row.label_ko = targetedExploration
        ? `Planner 지정 분야 Seed 추가 탐색 ${candidateCount}/${poolTarget}…`
        : `Seed 후보 추가 탐색 ${candidateCount}/${poolTarget}…`;
      if (st.last_expand_error) {
        row.summary = [row.summary, `expand: ${st.last_expand_error}`].filter(Boolean).join("\n");
      }
      return;
    }
  } else {
    st.empty_streak = 0;
    st.compact_next = false;
  }
  row.label_ko = st.planner_exploration_direction
    ? `Planner 지정 분야 후보 ${candidateCount}/${poolTarget}…`
    : `Seed 후보 탐색 ${candidateCount}/${poolTarget}…`;
  const filled = expandPoolFilled(required, st.gated || []);
  if (targetedExploration && grokAdded.length > 0) {
    st.planner_exploration_direction = "";
    row.step = nextPlannerStep;
    row.label_ko = nextPlannerStep === "recover" ? "Planner 재배차…" : "Planner Seed 선택…";
    return;
  }
  if (filled) {
    if (st.gated.length < 1) {
      row.status = "error";
      row.error = `시드 ${st.gated.length}/${required}. 할당량을 채우지 못해 중단합니다.` +
        (st.last_expand_error ? ` 원인: ${st.last_expand_error}` : "");
      return;
    }
    row.step = nextPlannerStep;
    row.label_ko = labelForPlannerStep(nextPlannerStep);
  } else if (canKeepExpanding(st)) {
    row.label_ko = targetedExploration
      ? `Planner 지정 분야 Seed 추가 탐색 ${candidateCount}/${poolTarget}…`
      : `Seed 후보 추가 탐색 ${candidateCount}/${poolTarget}…`;
  } else if (st.gated.length < 1) {
    row.status = "error";
    row.error = `시드 ${st.gated.length}/${required}. 할당량을 채우지 못해 중단합니다.` +
      (st.last_expand_error ? ` 원인: ${st.last_expand_error}` : "");
  } else {
    row.step = nextPlannerStep;
    row.label_ko = labelForPlannerStep(nextPlannerStep);
  }
}

async function stepStrategy(supabase: any, xaiKey: string, row: any) {
  const st = row.state;
  if (!xaiKey) {
    row.status = "error";
    row.error = "7일 Planner는 XAI_API_KEY가 필요합니다.";
    row.label_ko = "Planner 키 없음";
    return;
  }
  const intentText = String(st.topic || "").trim();
  const { learned, intent14d } = await loadEvidence(supabase, st.publishedTopics || [], intentText);
  st.cluster_weights = learned.cluster_weights;
  st.intent14d_top = (intent14d?.publishing_interests || []).slice(0, 6);
  st.learning = learned.learning;
  if (!st.quota_context_written) {
    row.summary = [
      learned.learning?.note_ko ? `학습: ${learned.learning.stage} · ${learned.learning.note_ko}` : "",
      (st.intent14d_top || []).length
        ? `14일 관심: ${(st.intent14d_top as string[]).join(", ")}`
        : "14일 관심: cold",
      `수제 원글 리듬: 활성일 평균 ${Number(learned.cadence?.avg_originals_on_active_days) || 0} · 14일 ${Number(learned.cadence?.originals_last_14d) || 0}`,
    ].filter(Boolean).join("\n");
    st.quota_context_written = true;
  }
  const analytics = await loadRecentXAnalyticsPublished(supabase, 30);
  const audience = await loadAudienceXStatus(supabase, analytics);
  st.audience_x_status = audience;
  const analyticsLine = [
    `X Analytics 실제 게시 ${analytics.rows.length}행 · 실제 날짜 ${analytics.coverage_days}일`,
    `동기화 공백 원글 ${audience.sync_gap_originals} · 경험 장면 ${audience.lived_scene_count}`,
    `bundled ${analytics.bundled_source || "none"}${analytics.bundled_error ? ` · ${analytics.bundled_error}` : ""}`,
  ].join(" · ");

  if (!st.planner_volume) {
    const result = await inferCreatorWeekVolume({
      xaiKey,
      audience,
      operatorNote: intentText || undefined,
      timeoutMs: 20000,
    });
    if (!result.ok || !result.value) {
      if (isTransientXaiError(result.error)) {
        holdForXai(row, "xAI 응답 대기 · 칸 수 이어감…", `Creator volume: ${result.error}`);
        return;
      }
      st.planner_volume_attempts = Number(st.planner_volume_attempts || 0) + 1;
      if (st.planner_volume_attempts < 3) {
        row.label_ko = `7일 칸 수 재추론 ${st.planner_volume_attempts}/3…`;
        row.summary = [row.summary, analyticsLine, `Creator volume: ${result.error || "unusable"}`].filter(Boolean).join("\n");
        return;
      }
      row.status = "error";
      row.error = `7일 Creator DNA 칸 수 실패: ${result.error || "unusable"}`;
      row.label_ko = "Creator 칸 수 실패";
      return;
    }
    st.planner_volume = {
      posts_per_day: result.value.posts_per_day,
      summary: result.value.summary,
      profile_diversity_intent: "",
      analytics_request_needed: false,
      analytics_request_reason: "",
    } as SevenDayVolume;
    st.planner_slots_partial = [];
    st.planner_day_batch_attempts = 0;
    const locked = result.value.posts_per_day.reduce((a, b) => a + b, 0);
    row.label_ko = `7일 칸 수 잠금 ${locked}칸 · Creator DNA 슬롯…`;
    row.summary = [
      row.summary,
      analyticsLine,
      `Creator DNA 칸 수 ${locked} · 하루 ${result.value.posts_per_day.join("/")}`,
      `Creator 요약: ${result.value.summary}`,
    ].filter(Boolean).join("\n");
    return;
  }

  const volume = st.planner_volume as SevenDayVolume;
  const partial: PlannerSlotIntent[] = Array.isArray(st.planner_slots_partial) ? st.planner_slots_partial : [];
  const days = nextStrategyDayOffsets(partial, volume.posts_per_day);
  if (days.length) {
    const result = await inferCreatorSlotsForDays({
      xaiKey,
      audience,
      days,
      postsPerDay: volume.posts_per_day,
      already: partial,
      operatorNote: intentText || undefined,
      timeoutMs: 28000,
    });
    if (!result.ok || !result.value) {
      if (isTransientXaiError(result.error)) {
        holdForXai(row, `xAI 응답 대기 · ${days.map((d) => d + 1).join(",")}일차 이어감…`, `Creator day slots: ${result.error}`);
        return;
      }
      st.planner_day_batch_attempts = Number(st.planner_day_batch_attempts || 0) + 1;
      if (st.planner_day_batch_attempts < 3) {
        row.label_ko = `Creator DNA ${days.map((d) => d + 1).join(",")}일차 슬롯 재추론 ${st.planner_day_batch_attempts}/3…`;
        row.summary = [row.summary, `Creator day slots: ${result.error || "unusable"}`].filter(Boolean).join("\n");
        return;
      }
      row.status = "error";
      row.error = `7일 Creator DNA 슬롯 실패 (${days.map((d) => d + 1).join(",")}일차): ${result.error || "unusable"}`;
      row.label_ko = "Creator 슬롯 실패";
      return;
    }
    st.planner_slots_partial = [...partial, ...result.value];
    st.planner_day_batch_attempts = 0;
    const remain = nextStrategyDayOffsets(st.planner_slots_partial, volume.posts_per_day);
    if (remain.length) {
      row.label_ko = `Creator DNA 슬롯 ${st.planner_slots_partial.length}칸 · ${remain.map((d) => d + 1).join(",")}일차…`;
      return;
    }
  }

  const stamped = stampPlannerSlotTimes(String(st.startDate || ""), st.planner_slots_partial as PlannerSlotIntent[]);
  if (!strategyCoversSevenDays(stamped)) {
    row.status = "error";
    row.error = `7일 달력 무결성 실패: ${stamped.length}칸`;
    row.label_ko = "달력 실패";
    return;
  }
  st.planner_strategy = {
    strategy_summary: volume.summary,
    profile_diversity_intent: volume.profile_diversity_intent || "",
    slots: stamped,
    analytics_rows_used: analytics.rows.length,
    analytics_coverage_days: analytics.coverage_days,
    analytics_request_needed: false,
    analytics_request_reason: "",
    version: "creator_slot_judgment_v1",
  } as SevenDayStrategy;
  st.quota = null;
  row.required_slots = stamped.length;
  st.posts_per_day = Math.max(QUOTA_PER_DAY_MIN, Math.ceil(row.required_slots / QUOTA_DAYS));
  st.max_expand = Math.max(Number(st.max_expand || 0), expandRoundBudget(row.required_slots));
  const seedTarget = candidatePoolTarget(row.required_slots);
  row.summary = [
    row.summary,
    `Creator DNA 잠금 ${row.required_slots}칸 · Planner가 시각 배정 · Seed Generator에 ${seedTarget}개 요청 (칸 + ${SEED_POOL_BUFFER})`,
    `Creator 7일 판단: ${volume.summary}`,
    analyticsLine,
    `예정 시각 첫 원글 ${stamped.find((s) => s.planned_pt)?.planned_pt || "14:00 PT"}`,
  ].filter(Boolean).join("\n");
  if ((st.gated || []).length < seedTarget && canKeepExpanding(st)) {
    row.step = "expand";
    row.label_ko = `Planner 칸용 Seed ${(st.gated || []).length}/${seedTarget}…`;
    return;
  }
  row.step = "select";
  row.label_ko = "Planner Seed 선택·배차…";
}

async function plannerSelectablePool(supabase: any, st: any): Promise<ConcreteSeed[]> {
  const since = new Date(Date.now() - COLLISION_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: acts } = await supabase
    .from("account_activities")
    .select("text_body, post_type, action_type, published_at, system_origin_class, x_post_id")
    .gte("published_at", since)
    .limit(500);
  const recentManual: RecentManualPost[] = (acts || [])
    .filter((row: any) => {
      const origin = String(row.system_origin_class || "").toUpperCase();
      const postType = String(row.post_type || row.action_type || "").toUpperCase();
      if (origin && !/USER_DIRECT|MANUAL/.test(origin)) return false;
      if (/REPLY|REPOST|RETWEET/.test(postType)) return false;
      return !postType || /ORIGINAL|QUOTE|UNKNOWN/.test(postType);
    })
    .map((row: any) => ({
      text: String(row.text_body || "").trim(),
      source_id: row.x_post_id,
      published_at: row.published_at,
      post_type: String(row.post_type || row.action_type || ""),
    }))
    .filter((row: RecentManualPost) => row.text.length >= 12);

  const pool: ConcreteSeed[] = [];
  const seen = new Set<string>();
  for (const seed of st.gated || []) {
    if (!seed?.concrete_subject) continue;
    const role = (seed.source_role as SourceRole) || "SEED_SOURCE";
    if (!isSeedEligibleRole(role)) continue;
    const key = isLivedSelfSeed(seed as any)
      ? `lived:${String(seed.seed_id || "")}`
      : subjectKey(String(seed.concrete_subject));
    if (!key || seen.has(key)) continue;
    const leakage = guardCandidateAgainstManualLeakage({
      source_role: role,
      concrete_subject: String(seed.concrete_subject),
      point_or_tension: seed.point_or_tension ? String(seed.point_or_tension) : undefined,
      recent_manual: recentManual,
      user_explicit: role === "USER_EXPLICIT_SEED",
    });
    if (!leakage.allow_as_seed) continue;
    seen.add(key);
    pool.push({ ...seed, status: "ELIGIBLE" });
  }
  const lived = pool.filter((s) => isLivedSelfSeed(s as any));
  const pub = pool.filter((s) => !isLivedSelfSeed(s as any));
  lived.sort((a, b) => {
    const ta = Date.parse(String((a as any).occurred_at || (a as any).published_at || 0)) || 0;
    const tb = Date.parse(String((b as any).occurred_at || (b as any).published_at || 0)) || 0;
    return tb - ta;
  });
  return [...lived, ...pub];
}

async function stepPlannerSelect(supabase: any, xaiKey: string, row: any) {
  const st = row.state;
  const strategy = st.planner_strategy as SevenDayStrategy | null;
  if (!strategy) {
    row.step = "strategy";
    row.label_ko = "7일 Planner 전략…";
    return;
  }
  const assigned: PlannerSeedAssignment[] = Array.isArray(st.planner_assignments) ? st.planner_assignments : [];
  const days = nextUnassignedDayOffsets(strategy.slots, assigned.map((item) => item.slot_id));
  const pool = await plannerSelectablePool(supabase, st);
  if (days.length) {
    const daySlots = strategy.slots.filter((slot) => days.includes(slot.day_offset));
    const result = await selectSeedsForDays({
      xaiKey,
      strategy,
      seedPool: pool,
      days,
      alreadyAssigned: assigned,
      timeoutMs: 28000,
    });
    if (!result.ok || !result.value) {
      st.select_timeouts = Number(st.select_timeouts || 0) + 1;
      if (isTransientXaiError(result.error) && st.select_timeouts <= 1) {
        holdForXai(row, `xAI 응답 대기 · ${days.map((d) => d + 1).join(",")}일차 Seed 선택 이어감…`, `Planner select: ${result.error}`);
        return;
      }
      st.select_timeouts = 0;
      st.planner_assignments = fillUnassignedPlannerSlotsFromPool({
        slots: daySlots,
        assignments: assigned,
        pool,
      });
      row.summary = [
        row.summary,
        `Planner select ${result.error || "unusable"} · 기존 Pool로 ${days.map((d) => d + 1).join(",")}일차 배차`,
      ].filter(Boolean).join("\n");
    } else {
      st.select_timeouts = 0;
      const have = new Set(assigned.map((item) => item.slot_id));
      for (const item of result.value.assignments) {
        if (!have.has(item.slot_id)) {
          assigned.push(item);
          have.add(item.slot_id);
        }
      }
      const enforced = applyNewestLivedExperienceAssignments({
        slots: daySlots,
        assignments: assigned.filter((item) => {
          const slot = strategy.slots.find((s) => s.slot_id === item.slot_id);
          return slot && days.includes(slot.day_offset);
        }),
        missing: result.value.missing,
        pool: pool as any[],
      });
      const kept = assigned.filter((item) => {
        const slot = strategy.slots.find((s) => s.slot_id === item.slot_id);
        return !(slot && days.includes(slot.day_offset));
      });
      st.planner_assignments = [...kept, ...enforced.assignments];
      if (enforced.missing.length > 0) {
        const direction = enforced.missing[0]?.exploration_direction || "";
        const fingerprint = missingSlotFingerprint(enforced.missing);
        st.explored_missing = st.explored_missing && typeof st.explored_missing === "object" ? st.explored_missing : {};
        const alreadyExplored = !!st.explored_missing[fingerprint] || !canRefillField(st, direction);
        if (!alreadyExplored) {
          st.explored_missing[fingerprint] = true;
          st.planner_missing_count = enforced.missing.length;
          st.planner_exploration_direction = enforced.missing
            .map((item) => `${item.slot_id}: ${item.exploration_direction}`)
            .join(" | ")
            .slice(0, 1200);
          recordFieldRefill(st, direction);
          st.max_expand = Number(st.max_expand || 0) + Math.min(6, enforced.missing.length + 1);
          row.step = "expand";
          row.label_ko = `Planner 지정 분야 Seed 탐색 ${enforced.missing.length}개 슬롯…`;
          row.summary = [
            row.summary,
            `Planner가 기존 Pool에서 ${st.planner_assignments.length}/${strategy.slots.length} 선택 · ${enforced.missing.length}개 분야 추가 탐색 요청`,
          ].filter(Boolean).join("\n");
          return;
        }
        st.planner_assignments = fillUnassignedPlannerSlotsFromPool({
          slots: daySlots,
          assignments: st.planner_assignments,
          pool,
        });
        st.planner_exploration_direction = "";
        row.summary = [
          row.summary,
          `추가 탐색 한도 · 기존 Pool로 빈 칸 배차 ${st.planner_assignments.length}/${strategy.slots.length}`,
        ].filter(Boolean).join("\n");
      }
    }
    const remain = nextUnassignedDayOffsets(
      strategy.slots,
      (st.planner_assignments || []).map((item: PlannerSeedAssignment) => item.slot_id),
    );
    if (remain.length) {
      row.label_ko = `Planner Seed 선택 ${(st.planner_assignments || []).length}/${strategy.slots.length} · ${remain.map((d) => d + 1).join(",")}일차…`;
      return;
    }
  }

  const finalAssigned: PlannerSeedAssignment[] = Array.isArray(st.planner_assignments) ? st.planner_assignments : assigned;
  const seedById = new Map(pool.map((seed) => [String(seed.seed_id), seed]));
  const strategyById = new Map(strategy.slots.map((slot) => [slot.slot_id, slot]));
  const weekDays: Array<{ dayOffset: number; posts: any[] }> = Array.from(
    { length: QUOTA_DAYS },
    (_, dayOffset) => ({ dayOffset, posts: [] }),
  );
  for (const assignment of finalAssigned) {
    const seed = seedById.get(assignment.seed_id);
    const strategySlot = strategyById.get(assignment.slot_id);
    if (!seed || !strategySlot) continue;
    const day = Math.max(0, Math.min(QUOTA_DAYS - 1, strategySlot.day_offset));
    weekDays[day].posts.push(compactSlotLite(
      seed,
      day,
      weekDays[day].posts.length + 1,
      assignment.editorial_mode,
      {
        strategic_role: strategySlot.strategic_role,
        planner_intent: assignment.planner_intent || strategySlot.planner_intent,
        strategy_slot_id: strategySlot.slot_id,
        planned_at: strategySlot.planned_at,
        planned_pt: strategySlot.planned_pt,
      },
    ));
  }
  const flat = weekDays.flatMap((day) => day.posts || []);
  if (flat.length !== strategy.slots.length) {
    row.status = "error";
    row.error = `Planner 배차 미완: ${flat.length}/${strategy.slots.length}`;
    row.label_ko = "Planner 배차 실패";
    return;
  }
  st.days = weekDays;
  st.write_flat = flat;
  st.write_index = 0;
  st.write_started = true;
  st.weekly_signatures = [];
  st.write_outcomes = [];
  st.planner_exploration_direction = "";
  st.planner_missing_count = 0;
  row.required_slots = flat.length;
  row.step = "write";
  row.label_ko = `7일 초안 생성 0/${flat.length}…`;
  row.summary = [
    row.summary,
    `Planner 선택·배차 완료 ${flat.length}/${strategy.slots.length}`,
  ].filter(Boolean).join("\n");
}

async function stepRecover(supabase: any, xaiKey: string, row: any) {
  const st = row.state;
  const strategy = st.planner_strategy as SevenDayStrategy | null;
  if (!strategy) {
    row.status = "error";
    row.error = "Planner recovery state missing";
    row.label_ko = "Planner recovery 실패";
    return;
  }
  if (!Array.isArray(st.recover_batch) || !st.recover_batch.length) {
    if (st.pending_recovery && !st.pending_recovery.batch) {
      st.recover_batch = [st.pending_recovery];
    } else {
      row.status = "error";
      row.error = "Planner recovery state missing";
      row.label_ko = "Planner recovery 실패";
      return;
    }
  }
  const batch: any[] = st.recover_batch;
  const pending = st.pending_recovery || {
    batch: true,
    attempts: 0,
    strategy_slot_id: batch[0]?.strategy_slot_id,
    slot: batch[0]?.slot,
    judge_reasons: batch.flatMap((item: any) => item.judge_reasons || []).slice(0, 12),
  };
  st.pending_recovery = pending;
  pending.attempts = Number(pending.attempts || 0) + 1;
  if (pending.attempts > 4) {
    pending.attempts = 0;
    st.recovery_history = Array.isArray(st.recovery_history) ? st.recovery_history : [];
    st.recovery_history.push({
      strategy_slot_id: pending.strategy_slot_id,
      action: "TARGETED_EXPLORE",
      from_seed_id: "",
      to_seed_id: "",
      exploration_direction: slotExplorationDirection(batch[0]?.slot || pending),
      judge_reasons: pending.judge_reasons || [],
    });
    requestTargetedSeedRefill(row, pending, `거절 묶음 JSON 한도 → Seed Generator ${TARGETED_EXPLORE_SEED_COUNT}개`);
    return;
  }

  if (!st.recover_relabeled) {
    const audience = (st.audience_x_status as AudienceXStatus | undefined) || await loadAudienceXStatus(supabase);
    const result = await creatorRelabelRejectBatch({
      xaiKey,
      audience,
      rejected: batch.map((item: any) => ({
        strategy_slot_id: String(item.strategy_slot_id || item.slot?.strategy_slot_id || ""),
        growth_role: String(item.slot?.strategic_role || ""),
        editorial_mode: String(item.slot?.editorial_mode || ""),
        planner_intent: String(item.slot?.planner_intent || ""),
        judge_reasons: item.judge_reasons || [],
      })),
      timeoutMs: 28000,
    });
    if (!result.ok || !result.value) {
      if (isTransientXaiError(result.error)) {
        pending.attempts = Math.max(0, Number(pending.attempts || 1) - 1);
        holdForXai(row, "xAI 응답 대기 · Creator DNA 거절 재판단 이어감…", `Creator relabel: ${result.error}`);
        return;
      }
      row.label_ko = `Creator DNA 거절 재판단 재추론 ${pending.attempts}/4…`;
      row.summary = [row.summary, `Creator relabel: ${result.error || "unusable"}`].filter(Boolean).join("\n");
      return;
    }
    for (const labeled of result.value) {
      const strategySlot = strategy.slots.find((slot) => slot.slot_id === labeled.strategy_slot_id);
      if (!strategySlot) continue;
      strategySlot.strategic_role = labeled.strategic_role || strategySlot.strategic_role;
      strategySlot.editorial_mode = labeled.editorial_mode || strategySlot.editorial_mode;
      strategySlot.planner_intent = labeled.planner_intent || strategySlot.planner_intent;
    }
    st.recover_relabeled = true;
    row.label_ko = `거절 ${batch.length}칸 Planner Seed 배차…`;
    return;
  }

  const slots: PlannerSlotIntent[] = [];
  for (const item of batch) {
    const id = String(item.strategy_slot_id || item.slot?.strategy_slot_id || "");
    const strategySlot = strategy.slots.find((slot) => slot.slot_id === id);
    if (strategySlot) slots.push(strategySlot);
  }
  const pool = recoverSeedPool(st);
  if (!pool.length || !slots.length) {
    st.recovery_history = Array.isArray(st.recovery_history) ? st.recovery_history : [];
    st.recovery_history.push({
      strategy_slot_id: pending.strategy_slot_id,
      action: "TARGETED_EXPLORE",
      from_seed_id: seedIdOf(batch[0]?.slot || pending),
      to_seed_id: "",
      exploration_direction: slotExplorationDirection(batch[0]?.slot || pending),
      judge_reasons: pending.judge_reasons || [],
    });
    requestTargetedSeedRefill(row, pending, `거절 묶음 Seed 후보 없음 → Seed Generator ${TARGETED_EXPLORE_SEED_COUNT}개`);
    return;
  }
  const result = await attachSeedsForSlots({
    xaiKey,
    strategy,
    slots,
    seedPool: pool,
    reservedSeedIds: [...savedSeedIds(st)],
    timeoutMs: 28000,
  });
  if (!result.ok || !result.value) {
    if (isTransientXaiError(result.error)) {
      pending.attempts = Math.max(0, Number(pending.attempts || 1) - 1);
      holdForXai(row, "xAI 응답 대기 · Planner Seed 배차 이어감…", `Planner recover seeds: ${result.error}`);
      return;
    }
    row.label_ko = `거절 묶음 Seed 배차 재추론 ${pending.attempts}/4…`;
    row.summary = [row.summary, `Planner recover seeds: ${result.error || "unusable"}`].filter(Boolean).join("\n");
    return;
  }
  if (result.value.missing.length) {
    const direction = result.value.missing.map((item) => item.exploration_direction).filter(Boolean).join(" · ").slice(0, 240);
    st.planner_exploration_direction = direction || st.planner_exploration_direction;
    requestTargetedSeedRefill(row, pending, `거절 묶음 빈 칸 → Seed Generator ${TARGETED_EXPLORE_SEED_COUNT}개`);
    return;
  }
  const replacements: any[] = [];
  for (const assignment of result.value.assignments) {
    const seed = pool.find((candidate: any) => String(candidate.seed_id || "") === assignment.seed_id);
    const item = batch.find((entry: any) => String(entry.strategy_slot_id || entry.slot?.strategy_slot_id || "") === assignment.slot_id);
    const original = item?.slot || {};
    const strategySlot = strategy.slots.find((slot) => slot.slot_id === assignment.slot_id);
    if (!seed || !strategySlot) continue;
    const day = Math.max(0, Math.min(QUOTA_DAYS - 1, Number(original.dayOffset ?? strategySlot.day_offset) || 0));
    replacements.push(compactSlotLite(
      seed,
      day,
      Number(String(original.slotId || "").replace(/^D\d+P/, "")) || 1,
      strategySlot.editorial_mode,
      {
        strategic_role: strategySlot.strategic_role,
        planner_intent: assignment.planner_intent || strategySlot.planner_intent,
        strategy_slot_id: strategySlot.slot_id,
        planned_at: original.planned_at || strategySlot.planned_at,
        planned_pt: original.planned_pt || strategySlot.planned_pt,
      },
    ));
    st.recovery_history = Array.isArray(st.recovery_history) ? st.recovery_history : [];
    st.recovery_history.push({
      strategy_slot_id: assignment.slot_id,
      action: "RESELECT_EXISTING",
      from_seed_id: seedIdOf(original),
      to_seed_id: assignment.seed_id,
      exploration_direction: "",
      judge_reasons: item?.judge_reasons || [],
    });
  }
  if (replacements.length !== batch.length) {
    requestTargetedSeedRefill(row, pending, `거절 묶음 Seed 미완 → Seed Generator ${TARGETED_EXPLORE_SEED_COUNT}개`);
    return;
  }
  const insertAt = Math.max(0, Math.min(Number(st.write_index || 0), (st.write_flat || []).length));
  st.write_flat.splice(insertAt, 0, ...replacements);
  st.write_index = insertAt;
  st.pending_recovery = null;
  st.recover_batch = [];
  st.recover_relabeled = false;
  st.recover_write = true;
  st.planner_exploration_direction = "";
  row.step = "write";
  row.label_ko = `거절 ${replacements.length}칸 Writer 묶음 재작성 ${row.saved_count}/${row.required_slots}…`;
}

/** @deprecated Not called by the live job. Seed Generator no longer has a semantic Judge. */
async function legacySeedJudgeUnused(row: any) {
  const st = row.state;
  const start = (st.judged || []).length;
  const batch = (st.gated || []).slice(start, start + 16);
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
      relationship_evidence_ids: Array.isArray(b.relationship_evidence_ids) ? b.relationship_evidence_ids.map(String) : undefined,
      runtime_joint_context_id: b.runtime_joint_context_id ? String(b.runtime_joint_context_id) : undefined,
      verified_locations: Array.isArray(b.verified_locations) ? b.verified_locations.map(String) : undefined,
      verified_entities: Array.isArray(b.verified_entities) ? b.verified_entities.map(String) : undefined,
      verified_events: Array.isArray(b.verified_events) ? b.verified_events.map(String) : undefined,
    });
    if (!g.pass) {
      const rejectionReasons = g.provenance.reasons || ["GROUNDING_REJECTED"];
      const metrics = st.seed_metrics || (st.seed_metrics = { rejected_by_reason: {} });
      for (const reason of rejectionReasons) bumpReason(metrics.rejected_by_reason, String(reason));
      judged.push({ ...b, status: "REJECTED", editorial_fit: "POOR", seed_reject_reasons: rejectionReasons });
      continue;
    }
    b.grounding_status = g.provenance.grounding_status;
    b.grounding_reasons = g.provenance.reasons;
    b.claim_types = g.provenance.claim_types;
    b.inference_type = g.provenance.inference_type;
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
      const metrics = st.seed_metrics || (st.seed_metrics = { rejected_by_reason: {} });
      for (const reason of q.reasons) bumpReason(metrics.rejected_by_reason, String(reason));
      judged.push({ ...b, status: "HOLD", editorial_fit: "POOR", seed_reject_reasons: q.reasons });
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
  if (st.seed_metrics) st.seed_metrics.eligible = eligibleN;
  if (st.write_started) {
    const postsPerDay = Math.min(QUOTA_PER_DAY_MAX, Math.max(QUOTA_PER_DAY_MIN, Number(st.posts_per_day) || 4));
    const seen = new Set((st.write_flat || []).map((p: any) => subjectKey(p.concrete_subject)));
    for (const subject of st.attempted_seed_subjects || []) seen.add(subjectKey(String(subject)));
    const fresh = eligibleOf(judged).filter((s: any) => {
      const key = subjectKey(s.concrete_subject);
      return key && !seen.has(key);
    });
    appendEligibleSeedsToWrite(st, fresh, required, postsPerDay);
    if ((st.write_flat || []).length > Number(st.write_index || 0)) {
      row.step = "write";
      row.label_ko = `초안 생성 ${row.saved_count}/${required}…`;
      return;
    }
    if (!quotaFilled(row)) {
      st.humor_fill = true;
      st.compact_next = false;
      if (canKeepExpanding(st)) {
        row.step = "expand";
        row.label_ko = `할당량 이어서 추론 ${row.saved_count}/${required}…`;
      } else {
        row.status = "error";
        row.error = `Seed 탐색 한도 후 ${row.saved_count}/${required}. 저장된 초안은 보존했습니다.`;
        row.label_ko = "Seed 후보 소진";
      }
      return;
    }
    row.step = "write";
    row.label_ko = `초안 생성 ${row.saved_count}/${required}…`;
    return;
  }
  if (eligibleN < required) {
    if (canKeepExpanding(st)) {
      row.step = "expand";
      row.label_ko = `할당량 보충 ${eligibleN}/${required}…`;
    } else {
      row.status = "error";
      row.error = `Seed 탐색 한도 후 판정 통과 ${eligibleN}/${required}. 저장된 후보와 사유를 남겼습니다.`;
      row.label_ko = "Seed 후보 부족";
    }
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

/** @deprecated Not called by the live job. Planner xAI owns selection/allocation. */
async function legacyLocalSelectUnused(supabase: any, row: any) {
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
    .filter((r: any) => {
      const origin = String(r.system_origin_class || "").toUpperCase();
      const postType = String(r.post_type || r.action_type || "").toUpperCase();
      if (origin && !/USER_DIRECT|MANUAL/.test(origin)) return false;
      if (/REPLY|REPOST|RETWEET/.test(postType)) return false;
      return !postType || /ORIGINAL|QUOTE|UNKNOWN/.test(postType);
    })
    .map((r: any) => ({
      text: String(r.text_body || "").trim(),
      source_id: r.x_post_id,
      published_at: r.published_at,
      post_type: String(r.post_type || r.action_type || ""),
    }))
    .filter((r: RecentManualPost) => r.text.length >= 12);
  const selectRejected: Record<string, number> = {};
  let pool: ConcreteSeed[] = [];
  for (const s of st.judged || []) {
    if (!s?.concrete_subject) {
      bumpReason(selectRejected, "MISSING_SUBJECT");
      continue;
    }
    if (!isSelectableStatus(s.status)) {
      bumpReason(selectRejected, `STATUS_${String(s.status || "UNKNOWN")}`);
      continue;
    }
    const role = (s.source_role as SourceRole) || "SEED_SOURCE";
    if (!isSeedEligibleRole(role)) {
      bumpReason(selectRejected, "ROLE_NOT_SEED_ELIGIBLE");
      continue;
    }
    const g = guardCandidateAgainstManualLeakage({
      source_role: role,
      concrete_subject: String(s.concrete_subject || ""),
      point_or_tension: s.point_or_tension ? String(s.point_or_tension) : undefined,
      recent_manual: recentManualSelect,
      user_explicit: role === "USER_EXPLICIT_SEED",
    });
    if (!g.allow_as_seed) {
      bumpReason(selectRejected, `LEAKAGE_${g.reason}`);
      continue;
    }
    if (isKoreaOnlySituation(String(s.concrete_subject || ""))) {
      bumpReason(selectRejected, "KOREA_ONLY");
      continue;
    }
    if (isSlotTypeLabel(String(s.concrete_subject || ""))) {
      bumpReason(selectRejected, "SLOT_LABEL_BODY");
      continue;
    }
    if (isFrozenHumorClone(String(s.concrete_subject || ""))) {
      bumpReason(selectRejected, "FROZEN_CLONE");
      continue;
    }
    pool.push(s);
  }
  st.seed_select_metrics = {
    input: (st.judged || []).length,
    selectable_pool: pool.length,
    rejected_by_reason: selectRejected,
  };
  if (st.write_started) {
    const seen = new Set((st.write_flat || []).map((p: any) => subjectKey(p.concrete_subject)));
    const fresh = pool.filter((s) => {
      const key = subjectKey(s.concrete_subject);
      return key && !seen.has(key);
    });
    appendEligibleSeedsToWrite(st, fresh, required, postsPerDay);
    row.step = "write";
    row.label_ko = `초안 생성 ${row.saved_count}/${required}…`;
    return;
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
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => {
        if (!canServeEditorialMode(s, mode) || isAdjacentExpansionSeed(s)) return false;
        if (mode === "EXPERIENCE") {
          return isPersonalInterestSubject(String(s.concrete_subject || ""), String(s.cluster || ""));
        }
        return true;
      })
      ;
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
    const requestedMode = parseEditorialMode(String(seed.requested_editorial_mode || "INFORMATIVE")) as EditorialMode;
    const mode = requestedMode === "EXPERIENCE" && !isLivedSelfSeed(seed as any)
      ? "CASUAL_OBSERVATION"
      : requestedMode;
    outDays[day].posts.push(compactSlotLite(seed, day, outDays[day].posts.length + 1, mode));
    totalPlanned += 1;
  }
  while (totalPlanned < required && pool.length > 0) {
    const idx = pool.findIndex((s) => {
      if (!isSelectableStatus(s.status as any)) return false;
      if (isAdjacentExpansionSeed(s)) return false;
      const mode = parseEditorialMode(String(s.requested_editorial_mode || s.editorial_mode || "INFORMATIVE"));
      if (mode === "EXPERIENCE" && !isLivedSelfSeed(s as any)) return false;
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
    if (mode === "EXPERIENCE" && !isLivedSelfSeed(seed as any)) continue;
    const personal = isPersonalInterestSubject(String(seed.concrete_subject || ""), String(seed.cluster || ""));
    if (!personal) {
      const mDay = pickDayForMass(outDays, postsPerDay, MASS_PER_DAY_MAX);
      if (mDay >= 0) day = mDay;
      else continue;
    }
    if (mode === "EXPERIENCE" && !personal) continue;
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
  if (totalAfter < required) {
    st.adjacent_rounds = Number(st.adjacent_rounds || 0) + 1;
    st.humor_fill = true;
    st.compact_next = false;
    st.adjacent_fill = false;
    if (canKeepExpanding(st)) {
      row.step = "expand";
      row.label_ko = `선택 후보 보충 ${totalAfter}/${required}…`;
      row.summary = [row.summary, `계획 ${totalAfter}/${required} → xAI가 부족 영역 후보를 묶어서 추론`].filter(Boolean).join("\n");
    } else {
      row.status = "error";
      row.error = `Seed 탐색 한도 후 계획 ${totalAfter}/${required}. 낮은 품질로 채우지 않습니다.`;
      row.label_ko = "Seed 선택 후보 부족";
    }
    return;
  }
  const totalFilled = redistributed.days.reduce((s, d) => s + d.posts.length, 0);
  if (totalFilled < 1) {
    row.status = "error";
    row.error = `7일 계획이 0/${required}입니다.`;
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
  st.write_started = true;
  row.summary = [
    row.summary,
    `expand_seeds: ${(st.gated || []).length} · judged: ${(st.judged || []).length} · planned: ${totalFilled}/${required}` +
      (adjacentPlanned ? ` · 대중 ${adjacentPlanned}(하루 최대 ${MASS_PER_DAY_MAX})` : "") +
      (short ? " · 할당량이 찰 때까지 이어서 추론" : ""),
    st.seed_metrics
      ? `Seed 계측: 요청 ${st.seed_metrics.requested || 0} · raw ${st.seed_metrics.raw_returned || 0} · 정규화 ${st.seed_metrics.normalized_returned || 0} · 후보 ${st.seed_metrics.accepted || 0} · eligible ${st.seed_metrics.eligible || 0}`
      : "",
  ].filter(Boolean).join("\n");
  row.step = "write";
  row.label_ko = `초안 생성 0/${row.required_slots || st.write_flat.length}…`;
}

function attachCountLedger(row: any) {
  const st = row.state || {};
  const outcomes = Array.isArray(st.write_outcomes) ? st.write_outcomes : [];
  const required = Number(row.required_slots) || outcomes.length;
  const acceptedOutcomes = outcomes.filter((slot: any) =>
    String(slot.final_text || "").trim() &&
    (String(slot.judge_status || "") === "PASS" || String(slot.judge_status || "") === "PASS_WITH_CONCERNS")
  );
  const gate = evaluateOrder8cCompletionGate({
    requested_slots: required,
    slots: acceptedOutcomes,
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

async function stepWrite(supabase: any, xaiKey: string, userId: string, row: any) {
  const st = row.state;
  const flat: any[] = st.write_flat || [];
  const i = Number(st.write_index || 0);
  const required = Number(row.required_slots) || 0;
  if (quotaFilled(row)) {
    attachCountLedger(row);
    row.status = "done";
    row.step = "done";
    row.error = null;
    row.label_ko = `완료: ${row.saved_count}개 draft 저장 · 리뷰하세요`;
    return;
  }
  if (!String(xaiKey || "").trim()) {
    row.status = "error";
    row.error = "XAI_API_KEY가 없어 초안을 만들 수 없습니다.";
    row.label_ko = "작성 키 없음";
    return;
  }
  if (i >= flat.length) {
    if (st.pending_recovery || (Array.isArray(st.recovery_queue) && st.recovery_queue.length)) {
      if (st.pending_recovery) {
        row.step = "recover";
        row.label_ko = `거절 글 재배차 ${row.saved_count}/${required}…`;
      } else {
        beginRecoverIfQueueReady(row, required);
      }
    } else {
      row.status = "error";
      row.error = `7일 Judge 개수 미달: PASS 저장 ${row.saved_count}/${required}`;
      row.label_ko = "Judge 개수 미달";
    }
    return;
  }
  const chunk = flat.slice(i, i + (st.recover_write ? RECOVER_WRITE_CHUNK : WRITE_CHUNK));
  st.attempted_seed_subjects = Array.isArray(st.attempted_seed_subjects) ? st.attempted_seed_subjects : [];
  for (const slot of chunk) {
    const subject = String(slot?.concrete_subject || slot?.primaryTopic || "");
    if (subject && !st.attempted_seed_subjects.includes(subject)) st.attempted_seed_subjects.push(subject);
  }
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
    audienceSignals: audienceBarrierSignalsFromActivityMeta((voiceActs || []) as any),
    weekSignatures: st.weekly_signatures || [],
    skipSelectiveRegen: true,
  });
  st.write_outcomes = Array.isArray(st.write_outcomes) ? st.write_outcomes : [];
  st.weekly_signatures = Array.isArray(st.weekly_signatures) ? st.weekly_signatures : [];
  for (let k = 0; k < posts.length; k++) {
    const p = posts[k];
    const text = String(p.final_text || "").trim();
    st.write_outcomes.push({
      slotId: p.slotId,
      slot_id: p.slotId,
      strategy_slot_id: chunk[k]?.strategy_slot_id || null,
      seed_id: chunk[k]?.seed_id || null,
      concrete_subject: chunk[k]?.concrete_subject || p.concrete_subject || "",
      cluster: chunk[k]?.cluster || chunk[k]?.topic_cluster || "",
      editorial_mode: chunk[k]?.editorial_mode || "",
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
      const strategySlotId = String(chunk[k]?.strategy_slot_id || chunk[k]?.slotId || p.slotId || "slot");
      const rejected = String(p.judge_status || "") === "REJECT";
      const seedId = seedIdOf(chunk[k]);
      const reasons = (p.block_reasons && p.block_reasons.length)
        ? p.block_reasons
        : [String(p.judge_status || p.generation_status || "WRITER_FAILURE")];
      const subject = String(chunk[k]?.concrete_subject || chunk[k]?.primaryTopic || p.slotId || "slot").slice(0, 40);
      st.last_reject_ko = formatPipelineReject(subject, reasons, p.judge_status);
      appendRejectLog(st, st.last_reject_ko);
      row.summary = [row.summary, st.last_reject_ko].filter(Boolean).join("\n");
      if (isWriterFailure(reasons, p.judge_status) && isTransientXaiError(reasons.join(" ") || p.generation_status)) {
        holdForXai(row, `xAI 응답 대기 · 같은 칸 다시 씀 ${row.saved_count}/${required}…`, st.last_reject_ko);
        st.write_index = i;
        return;
      }
      if (rejected) {
        const rejects = bumpSeedReject(st, seedId);
        if (rejects >= SEED_REJECT_ABANDON) {
          row.summary = [row.summary, `Planner가 Seed 3회 거절 후 버림 ${seedId || strategySlotId} · 슬롯은 재배차`].filter(Boolean).join("\n");
        }
      }
      enqueueRecovery(st, {
        slot: chunk[k],
        strategy_slot_id: strategySlotId,
        seed_id: seedId,
        judge_reasons: reasons,
        attempts: 0,
      });
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
        strategy_slot_id: chunk[k]?.strategy_slot_id || null,
        day_offset: chunk[k]?.dayOffset ?? null,
        seed_id: chunk[k]?.seed_id || null,
        strategic_role: chunk[k]?.strategic_role || null,
        planner_intent: chunk[k]?.planner_intent || null,
        planned_at: chunk[k]?.planned_at || null,
        planned_pt: chunk[k]?.planned_pt || null,
        writer_model: "grok-4.6",
        engine: "v11_seven_day_planner_runtime",
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
    if (!ins.error) {
      row.saved_count = Number(row.saved_count || 0) + 1;
      if (chunk[k]) (chunk[k] as any)._saved = true;
    }
  }
  st.write_index = i + chunk.length;
  row.label_ko = `초안 생성 ${row.saved_count}/${required || (st.write_flat || []).length}…`;
  if (quotaFilled(row)) {
    attachCountLedger(row);
    row.status = "done";
    row.step = "done";
    row.error = null;
    row.label_ko = `완료: ${row.saved_count}개 draft 저장 · 리뷰하세요`;
    return;
  }
  if (beginRecoverIfQueueReady(row, required)) return;
  if (st.write_index >= (st.write_flat || []).length) {
    row.status = "error";
    row.error = `7일 Judge 개수 미달: PASS 저장 ${row.saved_count}/${required}`;
    row.label_ko = "Judge 개수 미달";
  }
}
