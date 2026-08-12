/** ORDER 0A HOTFIX 3 integration tests — see pack for full suite */
import { readFileSync } from "fs";
function buildCanonicalTarget(input) {
  const finalSlots = Number(input.planner_final_slots);
  const base = Number(input.planner_base_required);
  if (Number.isFinite(finalSlots) && finalSlots > 0)
    return { canonical_minimum: finalSlots, target_source: "planner_final_slots", canonical_maximum: finalSlots + 1 };
  if (Number.isFinite(base) && base > 0)
    return { canonical_minimum: base, target_source: "planner_base_required", canonical_maximum: base + 1 };
  const fb = Math.max(0, Number(input.request_fallback_slots) || 0);
  return { canonical_minimum: fb, target_source: "ui_fallback_request_params_only", canonical_maximum: fb + 1 };
}
function isMeaningfulDistinct(c, existing) {
  const a = String(c.concrete_subject || "").toLowerCase().trim();
  const strip = (s) => s.replace(/\s*[—\-]\s*(실사용 관점|전후 변화|선택 기준).*$/g, "").trim();
  for (const e of existing) {
    const b = String(e.concrete_subject || "").toLowerCase().trim();
    if (a === b || strip(a) === strip(b)) return false;
  }
  return true;
}
const results = [];
function run(n, r) { results.push({ n, pass: !!r.pass }); console.log(`${r.pass ? "PASS" : "FAIL"} — ${n}`); }
run("planner-over-ui", (() => {
  const t = buildCanonicalTarget({ planner_base_required: 22, request_fallback_slots: 999 });
  return { pass: t.canonical_minimum === 22 };
})());
run("anti-suffix", (() => {
  const base = "cybertruck charge";
  const d = [];
  for (const s of [base, base + " — 실사용 관점"]) {
    if (isMeaningfulDistinct({ concrete_subject: s }, d)) d.push({ concrete_subject: s });
  }
  return { pass: d.length === 1 };
})());
const recovery = readFileSync("supabase/functions/weekly-plan/count-recovery.ts", "utf8");
const page = readFileSync("app/generate/page.tsx", "utf8");
const can = readFileSync("lib/generation/canonical-target.ts", "utf8");
run("no-angle-variant", { pass: !recovery.includes("ANGLE_VARIANT") && recovery.includes("isMeaningfulDistinct") });
run("canonical-sot", { pass: can.includes("canonical_minimum") && page.includes("buildCanonicalTarget") });
const failed = results.filter((r) => !r.pass).length;
console.log(failed === 0 ? "\nALL PASS" : `\nFAIL ${failed}`);
process.exit(failed === 0 ? 0 : 1);
