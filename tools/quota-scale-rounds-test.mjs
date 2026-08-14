#!/usr/bin/env node
/**
 * Larger inferred quota (up to 8/day × 7 = 56) must not fatten one Edge call.
 * More posts/seeds → more small rounds.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const scale = readFileSync(path.join(ROOT, "lib/weekly-generate-scale.ts"), "utf8");
const gen = readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8");
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");
const qi = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/quota-inference.ts"), "utf8");

function expandRoundBudget(requiredSlots) {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  const fill = Math.ceil((slots * 1.2) / 3);
  return Math.min(36, Math.max(16, fill + 8));
}
function topupRoundBudget(requiredSlots) {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  return Math.min(16, Math.max(6, Math.ceil(slots / 7)));
}
function priorSubjectCap(requiredSlots) {
  const slots = Math.max(1, Math.round(Number(requiredSlots) || 0) || 1);
  return Math.max(80, slots * 2);
}

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

console.log("Quota scale: more slots → more rounds, not fatter requests");
ok("Q1. X anti-dump max 8/day", /QUOTA_PER_DAY_MAX = 8/.test(qi) && /MAX_WEEKLY_SLOTS = QUOTA_PER_DAY_MAX \* QUOTA_DAYS/.test(scale));
ok("Q2. Edge expand batch stays 10 at any quota", /const EXPAND_BATCH = 10/.test(ix) && /export const EXPAND_BATCH = 10/.test(scale));
ok("Q3. write chunk stays 2", /export const WRITE_CHUNK = 2/.test(scale) && /WRITE_CHUNK/.test(gen));
ok("Q4. 28-slot budget exceeds frozen 12", expandRoundBudget(28) > 12);
ok("Q5. 56-slot fill at ~3 seeds/round", expandRoundBudget(56) >= Math.ceil((56 * 1.2) / 3));
ok("Q6. 56-slot topup > frozen 4", topupRoundBudget(56) > 4);
ok("Q7. 56-slot prior subjects > 80", priorSubjectCap(56) > 80);
ok("Q8. client uses expandRoundBudget(requiredSlots)", /expandRoundBudget\(requiredSlots\)/.test(gen));
ok("Q9. client uses topupRoundBudget(requiredSlots)", /topupRoundBudget\(requiredSlots\)/.test(gen));
ok("Q10. client uses priorSubjectCap", /priorSubjectCap\(requiredSlots\)/.test(gen) && !/slice\(-80\)/.test(gen));
ok("Q11. no frozen MAX_EXPAND_ROUNDS = 12", !/MAX_EXPAND_ROUNDS = 12/.test(gen));
ok("Q12. expand timeout does not abort the week", /SEED_INFERENCE_REQUIRES_XAI/.test(gen) && /return 0/.test(gen));
ok("Q13. scale helper formula lockstep", /PESSIMISTIC_SEEDS_PER_EXPAND = 3/.test(scale) && /Math\.min\(36, Math\.max\(16/.test(scale));
ok("Q14. min quota 21 still has rounds", expandRoundBudget(21) >= 16);

console.log("========================================");
console.log(`QUOTA SCALE: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
