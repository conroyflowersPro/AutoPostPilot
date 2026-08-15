#!/usr/bin/env node
/**
 * Full audit: Creator DNA + ORDER engines must reach the live job path
 * (quota → expand → select → write → ChatGPT). Orphans that are review-only stay off this loop.
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
const libDna = read("lib/intelligence/creator-dna-runtime.ts");
const libPerf = read("lib/intelligence/performance-dna-runtime.ts");
const intent = read("supabase/functions/weekly-plan/creator-intent-14d.ts");
const aud = read("supabase/functions/weekly-plan/audience-reaction-intelligence.ts");
const interp = read("supabase/functions/weekly-plan/seed-interpretation.ts");
const quota = read("supabase/functions/weekly-plan/quota-inference.ts");
const seedReason = read("supabase/functions/weekly-plan/creator-seed-reasoning.ts");
const ver = read("lib/version.ts");

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

console.log("DNA + engine live-path wiring (v11.4.6)");

ok("D1. ChatGPT writer injects Creator DNA", /creatorDnaBlock\(\)/.test(wr) && /CREATOR DNA/.test(wr));
ok("D2. ChatGPT writer injects engine rules", /engineRulesAsWill\(\)/.test(wr) && /ENGINE RULES/.test(wr));
ok("D3. ChatGPT writer injects performance DNA", /performanceDnaBlock\(\)/.test(wr) && /PERFORMANCE DNA/.test(wr));
ok("D4. Grok quota gets DNA", /creatorDnaBlock\(\)/.test(quota) && /engineRulesAsWill\(\)/.test(quota));
ok("D5. Grok seed expand gets DNA", /creatorDnaBlock\(\)/.test(seedReason) && /engineRulesAsWill\(\)/.test(seedReason));

ok("D6. interpretSeed emits why_it_might_matter_to_creator", /why_it_might_matter_to_creator/.test(interp));
ok("D7. deep context maps why_it_might_matter_to_creator", /why_it_might_matter_to_creator/.test(dgc));
ok("D8. deep context maps concrete_human_element", /concrete_human_element/.test(dgc));
ok("D9. core thought maps why_it_might_matter_to_creator", /buildCoreThought[\s\S]*why_it_might_matter_to_creator/.test(dgc));

ok("D10. writer everyday language lines", /writerEverydayConstraintLines/.test(wr) && /EVERYDAY LANGUAGE/.test(wr));
ok("D11. writer style lines", /writerStyleConstraintLines/.test(wr) && /CREATOR STYLE/.test(wr));
ok("D12. writer factual boundaries", /writerBoundaryConstraintLines/.test(wr) && /FACTUAL DO-NOT-INVENT/.test(wr));
ok("D13. writer humor decision lines", /writerHumorConstraintLines/.test(wr) && /HUMOR DECISION/.test(wr));
ok("D14. constraint builder concatenates everyday+style+boundary+humor",
  /writerEverydayConstraintLines\(ctx\)/.test(wr) &&
  /writerStyleConstraintLines\(ctx\)/.test(wr) &&
  /writerBoundaryConstraintLines\(ctx\)/.test(wr) &&
  /writerHumorConstraintLines\(ctx\)/.test(wr));

ok("D15. pipeline passes audienceSignals into everyday language", /audience_signals: args\.audienceSignals/.test(pipe));
ok("D16. pipeline passes creator_dna into style", /creator_dna: \{/.test(pipe) && /decideCreatorStyle/.test(pipe));
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
ok("D24. job select uses clusterPriorityFromMix", /clusterPriorityFromMix/.test(job));
ok("D25. job keeps experience cite seeds",
  /buildRecentExperienceCandidates/.test(job) && /from "\.\/experience-evidence\.ts"/.test(job));

ok("D26. Edge DNA MASS CAP matches lib intelligence",
  /MASS CAP: at most one mass-public daily-life original per day/.test(dna) &&
  /MASS CAP: at most one mass-public daily-life original per day/.test(libPerf));
ok("D27. Edge WHO California lockstep with lib",
  /Korean-language creator living in California/.test(libDna) &&
  /Creator lives in California/.test(dna));
ok("D28. version 11.4.6", /APP_VERSION = "11.4.6"/.test(ver) && /APP_VERSION = "11.4.6"/.test(ix));

ok("D29. review engines stay off generate job",
  !/from "\.\/selective-regeneration\.ts"/.test(job) &&
  !/from "\.\/regeneration-router\.ts"/.test(job) &&
  !/from "\.\/weekly-count-ledger\.ts"/.test(job) &&
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

console.log("========================================");
console.log(`DNA WIRING: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
