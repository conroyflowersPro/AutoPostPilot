/**
 * ORDER 1 — Seed Interpretation Layer acceptance tests A–I
 * Offline structural + contract verification (Edge runs TS; Node verifies source contract).
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const siPath = path.join(root, "supabase/functions/weekly-plan/seed-interpretation.ts");
const indexPath = path.join(root, "supabase/functions/weekly-plan/index.ts");
const guardPath = path.join(root, "supabase/functions/weekly-plan/manual-leakage-guard.ts");
const rolesPath = path.join(root, "supabase/functions/weekly-plan/source-roles.ts");

let fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " | " + detail : ""}`);
  if (!ok) fail++;
}

const siSrc = readFileSync(siPath, "utf8");
const indexSrc = readFileSync(indexPath, "utf8");
const guardSrc = existsSync(guardPath) ? readFileSync(guardPath, "utf8") : "";
const rolesSrc = existsSync(rolesPath) ? readFileSync(rolesPath, "utf8") : "";

// A
check("A1 seed-interpretation.ts exists", existsSync(siPath));
check("A2 exports interpretSeed", siSrc.includes("export function interpretSeed"));
check("A3 exports isInterpretationPassable", siSrc.includes("export function isInterpretationPassable"));
check("A4 exports isInterpretationBlocked", siSrc.includes("export function isInterpretationBlocked"));
check(
  "A5 status enum INTERPRETATION_OK/WEAK/BLOCKED",
  /INTERPRETATION_OK/.test(siSrc) && /INTERPRETATION_WEAK/.test(siSrc) && /INTERPRETATION_BLOCKED/.test(siSrc),
);

// B production wiring
check("B1 index imports seed-interpretation", indexSrc.includes('from "./seed-interpretation.ts"'));
check("B2 APP_VERSION order1", indexSrc.includes('APP_VERSION = "10.0.0-order1"'));
check("B3 WEEKLY_ENGINE_VERSION order1", indexSrc.includes("phased_v10_order1_seed_interpretation"));
check("B4 compactSlot attaches seed_interpretation", indexSrc.includes("seed_interpretation") && indexSrc.includes("interpretation_status"));
check("B5 INTERPRETATION_BLOCKED gate in select", indexSrc.includes("isInterpretationBlocked") && indexSrc.includes("interpretation_blocked"));
check("B6 diagnostics order1_seed_interpretation", indexSrc.includes("order1_seed_interpretation: true"));
check("B7 interpretConcreteSeed helper", indexSrc.includes("function interpretConcreteSeed"));

// C boundaries of layer
check("C1 no reaction mechanism decision", !/reaction_mechanism\s*=/.test(siSrc) && !siSrc.includes("REACTION_MECHANISM_LIBRARY"));
check("C2 no thinking rail selection", !siSrc.includes("THINKING_RAIL") && !siSrc.includes("thinking_rail"));
check("C3 no humor injection", !/natural_humor|HUMOR_MODE|forceHumor/.test(siSrc));
check("C4 no final writing / style template", !siSrc.includes("CREATOR_DNA_VOICE") && !siSrc.includes("Writing DNA"));

// D contract in source
check("D1 vague subject triggers BLOCKED path", siSrc.includes('status: "INTERPRETATION_BLOCKED"') && siSrc.includes("seed meaning too vague"));
check("D2 multi-candidate builder present", siSrc.includes("function buildCandidates") && siSrc.includes("candidate_count"));
check("D3 scoreCandidate present", siSrc.includes("function scoreCandidate"));
check("D4 factual_boundaries extraction", siSrc.includes("function extractFactualBoundaries") && siSrc.includes("prohibited_to_invent"));
check("D5 experience_boundaries force must_not_claim when no evidence", siSrc.includes("must_not_claim_first_person") && siSrc.includes("general_observation_only"));
check(
  "D6 EXPERIENCE mode rejection path",
  siSrc.includes("experience boundary conflict") || siSrc.includes('editorial_mode || "").toUpperCase() === "EXPERIENCE"'),
);
check("D7 repetition risk assessment", siSrc.includes("function assessRepetitionRisk") && siSrc.includes('repetition_risk === "HIGH"'));
check(
  "D8 isInterpretationPassable allows OK+WEAK only",
  /isInterpretationPassable[\s\S]{0,160}INTERPRETATION_OK[\s\S]{0,100}INTERPRETATION_WEAK/.test(siSrc),
);
check("D9 isInterpretationBlocked only for BLOCKED", /isInterpretationBlocked[\s\S]{0,100}INTERPRETATION_BLOCKED/.test(siSrc));

// E ORDER 0B regression
check("E1 manual-leakage-guard still present", guardSrc.includes("guardCandidateAgainstManualLeakage"));
check("E2 source-roles still present", rolesSrc.includes("isSeedEligibleRole") || rolesSrc.includes("CREATOR_LEARNING_SIGNAL"));
check("E3 index still calls leakage guard", indexSrc.includes("guardCandidateAgainstManualLeakage"));
check("E4 order0b diagnostics preserved", indexSrc.includes("order0b_manual_leakage_separation: true"));

// F ORDER 0A markers
check("F1 countIntegrityOk still used", indexSrc.includes("countIntegrityOk"));
check("F2 base_required_slots still planner-driven", indexSrc.includes("base_required_slots"));
check("F3 planner final_slots still referenced", indexSrc.includes("final_slots"));

// G gate + attachment
check("G1 interpretation_status field on slot", indexSrc.includes("interpretation_status: seed_interpretation.status"));
check(
  "G2 blocked seeds skipped before selectedWeekly push",
  /isInterpretationBlocked\(interp\)[\s\S]{0,80}interpretation_blocked\+\+[\s\S]{0,40}continue/.test(indexSrc),
);

// H anti-template
check("H1 no Terafab hardcode", !/Terafab|테라팹/.test(siSrc));
check("H2 no Cybertruck fixed template", !siSrc.includes("사이버트럭은 볼수록"));
check("H3 no fixed reaction template list assignment", !siSrc.includes("mechanism = 1") && !siSrc.includes('mechanism: "놀람'));

// I version / leftover order tests
check("I2 version strings consistent in index", indexSrc.includes("10.0.0-order1") && indexSrc.includes("order1_seed_interpretation"));

// ORDER 0B test file still present for regression suite
const o0b = path.join(root, "tools/order0b-manual-leakage-test.mjs");
check("I3 ORDER 0B regression test file present", existsSync(o0b));

console.log(fail === 0 ? "\nORDER 1 acceptance A–I: ALL PASS" : `\nORDER 1 acceptance: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
