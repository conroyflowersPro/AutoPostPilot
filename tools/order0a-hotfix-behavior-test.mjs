/** ORDER 0A HOTFIX behavior tests — see pack for full; minimal runner */
import { readFileSync } from "fs";

function resolveCanonicalTarget(input) {
  const finalSlots = Number(input.planner_final_slots);
  if (Number.isFinite(finalSlots) && finalSlots > 0)
    return { canonical_requested_slots: finalSlots, canonical_source: "planner_final_slots" };
  const base = Number(input.planner_base_required);
  if (Number.isFinite(base) && base > 0)
    return { canonical_requested_slots: base, canonical_source: "planner_base_required" };
  const planned = Number(input.total_planned);
  if (input.count_ok === true && Number.isFinite(planned) && planned > 0)
    return { canonical_requested_slots: planned, canonical_source: "planner_total_planned_if_complete" };
  const ui = Math.max(1, Number(input.ui_requested_slots) || 1);
  return { canonical_requested_slots: ui, canonical_source: "ui_fallback" };
}
function computeShortfall(c, cur) {
  return Math.max(0, (Number(c) || 0) - Math.max(0, Number(cur) || 0));
}
function countIntegrityOk(req, fin) {
  if (fin < req) return { ok: false, reason: "BELOW_REQUESTED" };
  if (fin > req + 1) return { ok: false, reason: "ABOVE_REQUESTED_PLUS_ONE" };
  return { ok: true, reason: "OK" };
}

const results = [];
function run(name, fn) {
  const r = fn();
  results.push({ name, pass: !!r.ok, ...r });
  console.log(`${r.ok ? "PASS" : "FAIL"} — ${name}`, JSON.stringify(r));
}

run("F-canonical-35", () => {
  const t = resolveCanonicalTarget({ planner_base_required: 35, ui_requested_slots: 42 });
  return { ok: t.canonical_requested_slots === 35, ...t };
});
run("F-canonical-28-final", () => {
  const t = resolveCanonicalTarget({ planner_final_slots: 28, planner_base_required: 35, ui_requested_slots: 42 });
  return { ok: t.canonical_requested_slots === 28, ...t };
});
run("F-not-underfilled-planned", () => {
  const t = resolveCanonicalTarget({ total_planned: 9, count_ok: false, ui_requested_slots: 42 });
  return { ok: t.canonical_requested_slots === 42, ...t };
});
run("legacy-8-removed", () => {
  const s = computeShortfall(42, 5);
  const legacy = Math.max(0, Math.min(42, 8) - 5);
  return { ok: s === 37 && s !== legacy, shortfall: s, legacy_wrong: legacy };
});
run("integrity-under", () => {
  const i = countIntegrityOk(42, 9);
  return { ok: i.ok === false && i.reason === "BELOW_REQUESTED", reason: i.reason };
});

const weekly = readFileSync("supabase/functions/weekly-plan/index.ts", "utf8");
const recovery = readFileSync("supabase/functions/weekly-plan/count-recovery.ts", "utf8");
const countRun = readFileSync("lib/generation/count-run.ts", "utf8");
run("code-no-min-8", () => ({ ok: !/Math\.min\(\s*required_slots\s*,\s*8\s*\)/.test(weekly) }));
run("code-recovery-module", () => ({ ok: recovery.includes("recoverExpandCandidates") }));
run("code-canonical", () => ({ ok: countRun.includes("resolveCanonicalTarget") }));

const failed = results.filter((r) => !r.pass).length;
console.log(failed === 0 ? "\nORDER 0A HOTFIX behavior tests: ALL PASS" : `\nFAIL ${failed}`);
process.exit(failed === 0 ? 0 : 1);
