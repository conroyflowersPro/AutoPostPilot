#!/usr/bin/env node
/**
 * Full audit: Creator DNA + ORDER engines must reach the live job path
 * (quota → expand → select → write → Grok). Orphans that are review-only stay off this loop.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const job = read("supabase/functions/weekly-plan/generation-job.ts");
const ix = read("supabase/functions/weekly-plan/index.ts");
const wr = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const dgc = read("supabase/functions/weekly-plan/deep-generation-context.ts");
const pipe = read("supabase/functions/weekly-plan/order-write-pipeline.ts");
const dna = read("supabase/functions/weekly-plan/engine-dna.ts");
const arch = read("supabase/functions/weekly-plan/engine-architecture.ts");
const libArch = read("lib/intelligence/engine-architecture.ts");
const libDna = read("lib/intelligence/creator-dna-runtime.ts");
const libPerf = read("lib/intelligence/performance-dna-runtime.ts");
const intent = read("supabase/functions/weekly-plan/creator-intent-14d.ts");
const aud = read("supabase/functions/weekly-plan/audience-reaction-intelligence.ts");
const interp = read("supabase/functions/weekly-plan/seed-interpretation.ts");
const quota = read("supabase/functions/weekly-plan/quota-inference.ts");
const seedReason = read("supabase/functions/weekly-plan/creator-seed-reasoning.ts");
const stage = read("supabase/functions/weekly-plan/engine-stage-philosophy.ts");
const score = read("lib/learning/score.ts");
const judge = read("supabase/functions/weekly-plan/semantic-judge.ts");
const ver = read("lib/version.ts");
const planner = read("supabase/functions/weekly-plan/seven-day-planner.ts");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass++;
    console.log("  PASS ", name);
  } else {
    fail++;
    console.log("  FAIL ", name);
  }
}

console.log("DNA + engine live-path wiring (v12.0.0)");

ok("D1. Grok Writer gets Creator Intelligence", /creatorDnaBlock\(\)/.test(wr) && /CREATOR INTELLIGENCE/.test(wr));
ok("D2. Grok Writer gets Planner Intent, not strategy engine rules", /ASSIGNED PLANNER INTENT/.test(wr) && !/engineRulesAsWill\(\)/.test(wr));
ok("D3. Writer does not use Performance DNA as writing input",
  /writerArchitectureLock/.test(wr) &&
  /Performance DNA is Planner-only/.test(arch) &&
  !/performanceDnaBlock\(\)/.test(wr));
ok("D4. horizon bounds are not a Quota xAI call", /SEED_POOL_BUFFER = 10/.test(quota) && !/inferWeeklyQuota/.test(quota) && !/plannerArchitectureLock/.test(quota));
ok("D5. Grok Seed gets Creator bounds without strategic intelligence", /creatorDnaBlock\(\)/.test(seedReason) && !/engineRulesAsWill\(\)/.test(seedReason) && !/performanceDnaBlock\(\)/.test(seedReason));

ok("D6. interpretSeed emits why_it_might_matter_to_creator", /why_it_might_matter_to_creator/.test(interp));
ok("D7. deep context maps why_it_might_matter_to_creator", /why_it_might_matter_to_creator/.test(dgc));
ok("D8. deep context maps concrete_human_element", /concrete_human_element/.test(dgc));
ok("D9. core thought maps why_it_might_matter_to_creator", /buildCoreThought[\s\S]*why_it_might_matter_to_creator/.test(dgc));

ok("D10. everyday strategy is not pre-chosen for Writer", !/writingStagePhilosophyBlock\(\)/.test(wr) && !/\.\.\.writerEverydayConstraintLines/.test(wr));
ok("D11. style family is not pre-chosen for Writer", !/writingStagePhilosophyBlock\(\)/.test(wr) && !/\.\.\.writerStyleConstraintLines/.test(wr));
ok("D12. writer factual boundaries", /writerBoundaryConstraintLines/.test(wr) && /FACTUAL DO-NOT-INVENT/.test(wr) && /\.\.\.writerBoundaryConstraintLines/.test(wr));
ok("D13. humor form is not enumerated or pre-chosen in live Writer", !/writingStagePhilosophyBlock\(\)/.test(wr) && !/\.\.\.writerHumorConstraintLines/.test(wr));
ok("D14. live writer concatenates fact boundaries only, not delivery engines",
  /\.\.\.writerBoundaryConstraintLines\(ctx\)/.test(wr) &&
  !/\.\.\.writerEverydayConstraintLines/.test(wr) &&
  !/\.\.\.writerStyleConstraintLines/.test(wr) &&
  !/\.\.\.writerHumorConstraintLines/.test(wr) &&
  !/\.\.\.writerMechanismConstraintLines/.test(wr));

ok("D15. pipeline records audienceSignals after thought, not as a thought picker", /audience_signals: args\.audienceSignals/.test(pipe) && /selectDeliveryAfterThought/.test(pipe));
ok("D16. pipeline records creator_dna style after thought", /creator_dna: \{/.test(pipe) && /decideCreatorStyle/.test(pipe) && /selectDeliveryAfterThought/.test(pipe));
ok("D17. pipeline keeps USER_DIRECT voice", /inferSlotVoice/.test(pipe) && /from "\.\/user-direct-voice-window\.ts"/.test(pipe));
ok("D18. job write passes audienceBarrierSignalsFromActivityMeta",
  /audienceBarrierSignalsFromActivityMeta/.test(job) && /writeSlotBatch\(/.test(job));
ok("D19. index write passes audience barrier signals",
  /audienceBarrierSignalsFromActivityMeta/.test(ix) && /audienceSignals:/.test(ix));
ok("D20. ORDER 4 barrier helper never uses comment wording",
  /Never uses comment wording/.test(aud) && /audienceBarrierSignalsFromActivityMeta/.test(aud));

ok("D21. 14d overlay helper exists", /overlayClusterWeightsWithIntent14d/.test(intent) && /blendInterestMix/.test(intent));
ok("D22. job loadEvidence overlays 14d intent", /overlayClusterWeightsWithIntent14d/.test(job));
ok("D23. index quota/expand overlay 14d intent",
  (ix.match(/overlayClusterWeightsWithIntent14d/g) || []).length >= 2);
ok("D24. Planner xAI owns Seed selection without local rank", /selectSeedsForDays/.test(job) && /selectSeedsForSevenDayPlan/.test(planner) && !/clusterPriorityFromMix/.test(job));
ok("D25. job keeps experience cite seeds",
  /buildRecentExperienceCandidates/.test(job) && /from "\.\/experience-evidence\.ts"/.test(job));

ok("D26. Edge/lib DNA both forbid a fixed personal-public mix",
  /NO FIXED MIX/.test(dna) && /NO FIXED MIX/.test(libPerf));
ok("D27. Edge WHO California lockstep with lib",
  /Korean-language creator living in California/.test(libDna) &&
  /Creator lives in California/.test(dna));
ok("D28. version 12.0.0", /APP_VERSION = "12.0.0"/.test(ver) && /APP_VERSION = "12.0.0"/.test(ix));

ok("D29. seed-bootstrap stays off generate job",
  !/from "\.\/seed-bootstrap\.ts"/.test(job));
ok("D30. deep context stores protected_meaning and politeness",
  /protected_meaning:/.test(dgc) && /politeness_level:/.test(dgc));
ok("D31. Creator DNA is how he sees/thinks/expresses, not a template",
  /PURPOSE: Preserve how this person sees/.test(dna) &&
  /NOT A TEMPLATE/.test(dna) &&
  /What would he notice first/.test(dna) &&
  /AP_PIPELINE drafts must not rewrite Creator DNA/.test(dna) &&
  /PURPOSE: Preserve how this person sees/.test(libDna) &&
  /Ask what he would notice first/.test(dna));
ok("D32. Planner is strategy/select/allocation/recovery engine",
  /inferSevenDayStrategy/.test(planner) &&
  /selectSeedsForSevenDayPlan/.test(planner) &&
  /recoverRejectedPlannerSlot/.test(planner) &&
  /PLANNER ROLE/.test(dna) &&
  /not a writing engine/.test(dna) &&
  /stronger months from now/.test(dna) &&
  /Do not learn from unpublished AI drafts/.test(dna));
ok("D33. Architecture lock: no engine replaces the Creator",
  /No engine replaces the Creator/.test(arch) &&
  /No engine replaces the Creator/.test(libArch) &&
  /plannerArchitectureLock/.test(planner) &&
  !/plannerArchitectureLock/.test(seedReason) &&
  /writerArchitectureLock/.test(wr) &&
  /ARCHITECTURE_NO_ENGINE_REPLACES_CREATOR/.test(judge));
ok("D34. Seven-day role pipeline is locked in docs and runtime",
  /Planner seven-day strategy \(locks volume\) → Seed Pool\(explore to Planner count \+ buffer\)/.test(arch) &&
  /Planner seven-day strategy \(locks volume\) → Seed Pool\(explore to Planner count \+ buffer\)/.test(libArch) &&
  /stepStrategy/.test(job) && /stepPlannerSelect/.test(job) && /stepRecover/.test(job) &&
  /THOUGHT_FIRST_RUNTIME/.test(pipe) &&
  /selectDeliveryAfterThought/.test(pipe) &&
  /No engine replaces the Creator/.test(dna));
ok("D35. Forbidden mixes named",
  /Writer must not become Planner/.test(arch) &&
  /Performance DNA must not overwrite Creator DNA/.test(arch) &&
  /Revenue DNA must not dominate/.test(arch));
ok("D36. Planner Memory stores abstract patterns, not wording",
  /MANUAL_PREMIUM/.test(score) &&
  /must not overwrite Creator DNA/.test(score) &&
  /추상 패턴만 저장/.test(score) &&
  !/const snip = s\.contentSnippet/.test(score));
ok("D37. Seed generation philosophy reaches Grok expand",
  /seedCandidatePhilosophyBlock/.test(seedReason) &&
  /EXPLORE MANY/.test(stage) &&
  /A seed starts thinking/.test(stage) &&
  /not yet a post topic/.test(stage));
ok("D38. Core Thought is a judgment, can HOLD",
  /CORE_THOUGHT_HOLD/.test(read("supabase/functions/weekly-plan/deep-generation-context.ts")) &&
  /not_worth_publishing/.test(read("supabase/functions/weekly-plan/deep-generation-context.ts")) &&
  /fact_confidence/.test(read("supabase/functions/weekly-plan/deep-generation-context.ts")));
ok("D39. Mechanism NONE is normal",
  /none_is_normal/.test(read("supabase/functions/weekly-plan/reader-self-projection.ts")) &&
  /MECHANISM_NONE_IS_NORMAL/.test(read("supabase/functions/weekly-plan/reader-self-projection.ts")) &&
  !/default_observation_personality/.test(read("supabase/functions/weekly-plan/reader-self-projection.ts")));
ok("D40. Judge does not hard-reject Planner structural strategy",
  /qualityPhilosophyBlock/.test(judge) &&
  !/hard\.push\("structural_repetition_high"\)/.test(judge));
ok("D41. Writer decides creative form without a stage menu",
  /Decide the necessary reasoning and expression yourself/.test(wr) &&
  !/writingStagePhilosophyBlock\(\)/.test(wr));
ok("D42. seven-day Planner loads Intelligence and actual X Analytics; Seed does not",
  /loadPlannerIntelligence/.test(job) &&
  /from\("post_metrics"\)/.test(planner) &&
  /recent_x_analytics/.test(planner) &&
  !/audience_dna_current/.test(seedReason) &&
  !/planner_memory/.test(seedReason));
ok("D43. Audience DNA primary is X Analytics, not follow-the-followers",
  /X Analytics primary/.test(arch) &&
  /Primary source: X Analytics/.test(read("supabase/functions/weekly-plan/engine-learning-philosophy.ts")) &&
  /Must not overwrite Creator DNA/.test(read("supabase/functions/weekly-plan/engine-learning-philosophy.ts")));
ok("D44. Learning loop closes only when Planner reads",
  /next seven-day Planner reads/.test(arch) &&
  /LEARNING_CYCLE/.test(libArch) &&
  /plannerMustRead/.test(read("app/api/learning/analyze/route.ts")));
ok("D45. Performance DNA interpret order starts with followers gained",
  /followersGained: 50/.test(read("lib/learning/types.ts")) &&
  /Followers Gained → Profile Visits → Revenue/.test(dna));
ok("D46. Missing intelligence is UNKNOWN not zero",
  /UNKNOWN \/ insufficient evidence/.test(read("supabase/functions/weekly-plan/planner-intelligence.ts")) &&
  /빈 값을 성공으로 쓰지 않음/.test(score));
ok("D47. Operator collaboration is chat-only, not Writer",
  /operator-collaboration-v1/.test(read("lib/intelligence/operator-collaboration.ts")) &&
  /Not a being that thinks instead of the operator/.test(read("lib/intelligence/operator-collaboration.ts")) &&
  !/operator-collaboration/.test(wr) &&
  !/operatorCollaborationBlock/.test(wr));
ok("D48. Writer and Judge do not own virtual-week structure strategy",
  !/writerWeekStructureConstraintLines\(ctx/.test(wr) &&
  !/hard\.push\("structural_repetition_high"\)/.test(judge));
ok("D49. Rejected slot returns to Planner recovery",
  /pending_recovery/.test(job) && /row\.step = "recover"/.test(job) &&
  /recoverRejectedPlannerSlot/.test(job));
ok("D50. Job uses weekly-count-ledger as completion gate",
  /from "\.\/weekly-count-ledger\.ts"/.test(job) &&
  /evaluateOrder8cCompletionGate/.test(job) &&
  /attachCountLedger/.test(job) &&
  /planned/.test(job) && /regenerated/.test(job) && /blocked/.test(job));
ok("D51. Interest promotion needs repeated cycles, not one hit",
  /CYCLES_TO_PROMOTE = 2/.test(read("lib/learning/interest-promotion.ts")) &&
  /promoteInterestLadder/.test(read("app/api/learning/analyze/route.ts")) &&
  /INTEREST LADDER/.test(read("supabase/functions/weekly-plan/planner-intelligence.ts")) &&
  /One published success does not promote/.test(stage));

console.log("========================================");
console.log(`DNA WIRING: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
