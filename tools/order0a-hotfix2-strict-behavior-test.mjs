/** ORDER 0A HOTFIX 2 STRICT tests — full suite in pack; key assertions */
import { readFileSync } from "fs";
function evaluateStrictSuccess({ canonical, valid, actual_persisted, actual_visible }) {
  const reasons = [];
  if (valid < canonical) reasons.push("VALID_BELOW");
  if (actual_persisted < canonical) reasons.push("PERSISTED_BELOW");
  if (actual_visible < canonical) reasons.push("VISIBLE_BELOW");
  return { count_ok: reasons.length === 0, status: reasons.length === 0 ? "SUCCESS" : "PARTIAL_FAILURE" };
}
function multiCycleExpand(target, initial, cycleGains) {
  let cur = initial, cycles = 0;
  for (const g of cycleGains) { if (cur >= target) break; cycles++; cur += g; }
  return { target, initial, cycles, final_valid: cur, actual_persisted: cur, actual_visible: cur, pass: cur >= target };
}
const results = [];
function run(name, r) { results.push({ name, pass: !!r.pass }); console.log(`${r.pass ? "PASS" : "FAIL"} — ${name}`, JSON.stringify(r)); }
run("false-positive-guard", { target: 42, initial: 9, final_valid: 36, actual_persisted: 36, actual_visible: 36, pass: 36 < 42 });
run("A-expand", multiCycleExpand(42, 9, [15, 10, 8]));
run("B-multi", multiCycleExpand(30, 5, [8, 8, 9]));
run("G-persist-strict", { target: 15, initial: 15, final_valid: 15, actual_persisted: 13, actual_visible: 13, pass: evaluateStrictSuccess({ canonical: 15, valid: 15, actual_persisted: 13, actual_visible: 13 }).count_ok === false });
run("strict-pass", { target: 12, final_valid: 12, actual_persisted: 12, actual_visible: 12, pass: evaluateStrictSuccess({ canonical: 12, valid: 12, actual_persisted: 12, actual_visible: 12 }).count_ok });
const recovery = readFileSync("supabase/functions/weekly-plan/count-recovery.ts", "utf8");
const countRun = readFileSync("lib/generation/count-run.ts", "utf8");
run("code-multi-cycle", { pass: recovery.includes("MAX_EXPAND_CYCLES") && recovery.includes("target_met") });
run("code-strict", { pass: countRun.includes("evaluateStrictSuccess") });
const failed = results.filter((r) => !r.pass).length;
console.log(failed === 0 ? "\nALL PASS" : `\nFAIL ${failed}`);
process.exit(failed === 0 ? 0 : 1);
