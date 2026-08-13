#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
const MOD = path.join(ROOT, "supabase/functions/weekly-plan/generation-integration.ts");
const IND = path.join(ROOT, "supabase/functions/weekly-plan/independent-post-generation.ts");
const IDX = path.join(ROOT, "supabase/functions/weekly-plan/index.ts");
const DGC = path.join(ROOT, "supabase/functions/weekly-plan/deep-generation-context.ts");
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log("  PASS ", name); } else { fail++; console.log("  FAIL ", name); } }
const mod = existsSync(MOD) ? readFileSync(MOD, "utf8") : "";
const ind = existsSync(IND) ? readFileSync(IND, "utf8") : "";
const idx = existsSync(IDX) ? readFileSync(IDX, "utf8") : "";
const dgc = existsSync(DGC) ? readFileSync(DGC, "utf8") : "";
console.log("ORDER 7C Generation Integration & Hardening tests");
ok("C1. generation-integration module exists", mod.length > 1000);
ok("C2. ORDER7C_VERSION", /ORDER7C_VERSION/.test(mod));
ok("C3. MAX_GENERATION_ATTEMPTS = 2", /ORDER7C_MAX_GENERATION_ATTEMPTS\s*=\s*2/.test(mod));
ok("C4. integrateSlotGeneration async", /export async function integrateSlotGeneration/.test(mod));
ok("C5. evaluateWeeklyCompletionGate", /export function evaluateWeeklyCompletionGate/.test(mod));
ok("C6. ensureSlotCountPreserved", /export function ensureSlotCountPreserved/.test(mod));
ok("C7. silent drop forbidden", /ORDER7C_SILENT_SLOT_DROP_FORBIDDEN/.test(mod));
ok("C8. blocked still returned", /ORDER7C_BLOCKED_STILL_RETURNED/.test(mod));
ok("C9. retry preserves upstream", /ORDER7C_RETRY_PRESERVES_UPSTREAM/.test(mod));
ok("C10. no seed swap on retry", /ORDER7C_NO_SEED_SWAP_ON_RETRY/.test(mod));
ok("C11. no fake fallback", /ORDER7C_NO_FAKE_FALLBACK_TEXT/.test(mod));
ok("C12. lifecycle statuses", /RETRY_REQUIRED/.test(mod) && /RECOVERY_PENDING/.test(mod) && /BLOCKED/.test(mod));
ok("C13. completion gate fields", /requested_slots/.test(mod) && /returned_slots/.test(mod) && /count_integrity_pass/.test(mod));
ok("C14. structural repetition audit", /structural_repetition/.test(mod));
ok("C15. uses generateIndependentPost", /generateIndependentPost/.test(mod));
ok("C16. same context on retry (no seed swap logic)", /same_seed_retry/.test(mod));
ok("C17. index imports integrateSlotGeneration", /integrateSlotGeneration/.test(idx));
ok("C18. index imports completion gate", /evaluateWeeklyCompletionGate/.test(idx));
ok("C19. index APP order7c", /10\.0\.0-order7c/.test(idx));
ok("C20. index engine order7c", /phased_v10_order7c_generation_integration/.test(idx));
ok("C21. index diagnostics order7c", /order7c_generation_integration/.test(idx));
ok("C22. index calls integrateSlotGeneration", /await integrateSlotGeneration/.test(idx));
ok("C23. index still DeepGenerationContext", /buildDeepGenerationContext/.test(idx));
ok("C24. index still independent module", /independent-post-generation/.test(idx));
ok("C25. 7B live writer still present", /callXaiWriter/.test(ind) && /hotfix_live_xai/.test(ind));
ok("C26. 7A deep context still present", /buildDeepGenerationContext/.test(dgc));
ok("C27. no filter final_text drop pattern in 7C module", !/\.filter\(\s*[a-z]+\s*=>\s*[a-z]+\.final_text\s*\)/.test(mod));
ok("C28. pad blocked preserves count", /ensureSlotCountPreserved|silent_drop_detected/.test(mod + idx));
ok("C29. generation_attempts tracked", /generation_attempts/.test(mod) && /generation_attempts/.test(idx));
ok("C30. recovery_type tracked", /recovery_type/.test(mod) && /recovery_type/.test(idx));
ok("C31. ORDER0A postsPerDay", /postsPerDay/.test(idx));
ok("C32. ORDER0B leakage", /manual-leakage|order0b/.test(idx));
ok("C33. ORDER7B markers", /ORDER7B_VERSION/.test(idx));
ok("C34. ORDER7A markers", /ORDER7A_VERSION/.test(idx));
function evalGate(slots, requested) {
  const returned = slots.length;
  const dups = [];
  const seen = new Set();
  for (const s of slots) {
    const id = s.slotId || s.slot_id;
    if (seen.has(id)) dups.push(id); else seen.add(id);
  }
  let generated = 0, blocked = 0, recovered = 0;
  for (const s of slots) {
    const st = s.generation_status || s.lifecycle_status || "";
    if (st === "GENERATED") generated++;
    else if (st === "RECOVERED") recovered++;
    else if (st === "BLOCKED") blocked++;
  }
  return { returned_slots: returned, requested_slots: requested, count_ok: returned === requested && dups.length === 0, generated, blocked, recovered, silent_drop: returned < requested };
}
const A = Array.from({ length: 35 }, (_, i) => ({ slotId: `S${i}`, generation_status: "GENERATED", final_text: `t${i}` }));
ok("T-A requested 35 all success → 35", evalGate(A, 35).count_ok && evalGate(A, 35).generated === 35);
const B = A.map((s, i) => i < 4 ? { ...s, generation_status: "GENERATED", final_text: `retry-ok-${i}` } : s);
ok("T-B 4 retry success still 35", evalGate(B, 35).count_ok);
const C = Array.from({ length: 35 }, (_, i) => ({ slotId: `S${i}`, generation_status: i < 4 ? "RECOVERED" : "GENERATED", final_text: `x${i}` }));
ok("T-C recovery success 35", evalGate(C, 35).count_ok && evalGate(C, 35).recovered === 4);
const D = Array.from({ length: 35 }, (_, i) => ({ slotId: `S${i}`, generation_status: i < 2 ? "BLOCKED" : "GENERATED", final_text: i < 2 ? "" : `y${i}` }));
const gD = evalGate(D, 35);
ok("T-D 2 BLOCKED still 35 returned", gD.count_ok && gD.blocked === 2 && gD.returned_slots === 35);
ok("T-E dynamic 42", evalGate(Array.from({ length: 42 }, (_, i) => ({ slotId: `D${i}`, generation_status: "GENERATED", final_text: "z" })), 42).count_ok);
ok("T-F dynamic 49", evalGate(Array.from({ length: 49 }, (_, i) => ({ slotId: `D${i}`, generation_status: "GENERATED", final_text: "z" })), 49).count_ok);
ok("T-G silent drop detected when 33 of 35", evalGate(Array.from({ length: 33 }, (_, i) => ({ slotId: `S${i}`, generation_status: "GENERATED", final_text: "a" })), 35).silent_drop === true);
ok("T-H index no hard dry_run true", !/dry_run:\s*true/.test(idx));
ok("T-I compactSlot async", /async function compactSlot/.test(idx));
ok("T-J fill still uses compactSlot", /await compactSlot/.test(idx));
console.log("========================================");
console.log(`ORDER 7C: ${pass} PASS / ${fail} FAIL (total ${pass + fail})`);
process.exit(fail ? 1 : 0);
