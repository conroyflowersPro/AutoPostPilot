/**
 * ORDER 3 — Thinking Rail Runtime structural / regression tests
 * Run: node tools/order3-thinking-rail-test.mjs
 */
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { pathToFileURL } from "url";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.ORDER3_ROOT || join(__dirname, "..");
const WP = join(ROOT, "supabase/functions/weekly-plan");

let passed = 0;
let failed = 0;
const fails = [];

function ok(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`PASS — ${name}`);
  } else {
    failed++;
    fails.push(name + (detail ? ": " + detail : ""));
    console.log(`FAIL — ${name}${detail ? " :: " + detail : ""}`);
  }
}

function loadTsAsJs(path) {
  return readFileSync(path, "utf8");
}

const railPath = join(WP, "thinking-rail-runtime.ts");
const indexPath = join(WP, "index.ts");
const interpPath = join(WP, "seed-interpretation.ts");
const readerPath = join(WP, "reader-self-projection.ts");

ok("A0 thinking-rail-runtime exists", existsSync(railPath));
ok("A0 index exists", existsSync(indexPath));
ok("A0 seed-interpretation exists", existsSync(interpPath));
ok("A0 reader-self-projection exists", existsSync(readerPath));

const railSrc = existsSync(railPath) ? loadTsAsJs(railPath) : "";
const indexSrc = existsSync(indexPath) ? loadTsAsJs(indexPath) : "";

ok("B1 selectThinkingRail export", /export function selectThinkingRail/.test(railSrc));
ok("B2 ThinkingRailDecision type", /export type ThinkingRailDecision/.test(railSrc));
ok("B3 ABSTRACT_RAIL_LIBRARY", /export const ABSTRACT_RAIL_LIBRARY/.test(railSrc));
ok("B4 style_decision null hard", /style_decision:\s*null/.test(railSrc) && /ORDER3_STYLE_ALWAYS_NULL/.test(railSrc));
ok("B5 no topic map flag", /ORDER3_NO_TOPIC_RAIL_MAP/.test(railSrc));

ok(
  "C1 no topic→rail lookup table",
  !/topicToRail\s*=|selectThinkingRailHint|\bTOPIC_TO_RAIL\b/.test(railSrc) &&
    !/Tesla\s*→\s*Rail|FSD\s*→\s*Rail/.test(railSrc),
);
ok(
  "C2 no keyword regex rail forcing",
  !/selectThinkingRailHint|if\s*\(\s*\/OPTIMUS|if\s*\(\s*\/FSD\|AUTOPILOT/.test(railSrc),
);
ok(
  "C3 index no keyword rail force",
  !/selectThinkingRailHint|TOPIC_RAIL_MAP|if\s*\(\s*\/FSD.*rail/.test(indexSrc),
);

ok("D1 mechanism independent (no fixed map)", !/MECHANISM_TO_RAIL|mechanism_id\s*===\s*["']M\d+["']\s*\?\s*rail/.test(railSrc));
ok("D2 reaction import type only", /MechanismSelectionResult/.test(railSrc));

ok("E1 minimal / derived support", /RAIL_MINIMAL|selection_mode:\s*"minimal"|derived:\s*true/.test(railSrc));
ok("E2 RAIL_NONE support", /RAIL_NONE/.test(railSrc));

ok("F1 ending stop_on_mechanism", /stop_on_mechanism/.test(railSrc));
ok("F2 compression high preference", /compression_preference/.test(railSrc));

ok("G1 long_horizon_allowed field", /long_horizon_allowed/.test(railSrc));
ok("G2 no auto escalate", /never auto-escalate|Only when interpretation already surfaces/.test(railSrc));

ok("H1 experience_grounded field", /experience_grounded/.test(railSrc));
ok("H2 experience_required field", /experience_required/.test(railSrc));
ok("H3 must_not_claim respected", /must_not_claim_first_person|experience_blocked/.test(railSrc));

ok("I1 style always null in decision", /style_decision:\s*null/.test(railSrc));
ok("I2 ORDER3_STYLE_ALWAYS_NULL", /ORDER3_STYLE_ALWAYS_NULL\s*=\s*true/.test(railSrc));

ok("J1 no text_body / raw post in rail module", !/text_body|manual_post_raw|historical_post_text/.test(railSrc));
ok("J2 input boundary structured only", /SeedInterpretation/.test(railSrc) && /interpretation:\s*SeedInterpretation/.test(railSrc));

ok("K1 no mandatory observation→explanation→future", !/observation\s*→\s*explanation\s*→\s*future|fill-in-the-blank/.test(railSrc));
ok("K2 optional_beats not forced", /optional_reasoning_beats/.test(railSrc));

ok("L1 preserve_reader_entry", /preserve_reader_entry/.test(railSrc));

ok("M1 ORDER3_VERSION", /thinking_rail_runtime_v1_order3/.test(railSrc));
ok(
  "M2 index engine order3",
  /phased_v10_order3_thinking_rail|order3_thinking_rail/.test(indexSrc) || /ORDER3|thinking.rail/.test(indexSrc),
);

ok("N1 index imports selectThinkingRail", /selectThinkingRail/.test(indexSrc));
ok("N2 thinking_rail on compactSlot or diagnostics", /thinking_rail|rail_decision|ThinkingRail/.test(indexSrc));

ok("O1 ORDER 0B leakage still referenced", /order0b|manual.leakage|guardCandidateAgainstManualLeakage/.test(indexSrc));
ok("O2 ORDER 1 interpretation still wired", /interpretSeed|seed_interpretation|order1_seed_interpretation/.test(indexSrc));
ok("O3 ORDER 2 mechanism still wired", /selectReactionMechanism|order2_reader_mechanism|reaction_mechanism/.test(indexSrc));

ok(
  "P1 same-topic different-seed different-rail possible (no fixed map)",
  /scoreRail|ABSTRACT_RAIL_LIBRARY\.map/.test(railSrc) && !/topicToRail\s*=|\bTOPIC_TO_RAIL\b/.test(railSrc),
);

ok("P2 adapted path exists", /RAIL_ADAPTED|selection_mode:\s*"adapted"/.test(railSrc));
ok("P3 derived path exists", /derived:\s*true|selection_mode:\s*"derived"|RAIL_DERIVED|RAIL_MINIMAL/.test(railSrc));

ok("Q1 no fact invention in rail", !/invent.*fact|new_fact|fabricat/.test(railSrc.toLowerCase()) || /must never|cannot introduce new evidence/.test(railSrc));

ok("R1 recent_repetition_risk", /recent_repetition_risk|assessRepetition/.test(railSrc));
ok("R2 overuse soft penalty not force rotate", /recent_overuse|fit still wins|soft anti-repetition/.test(railSrc));

ok("S1 humor_compatible optional only", /humor_compatible/.test(railSrc) && !/force.*joke|mandatory punchline/.test(railSrc));

ok(
  "T1 diagnostics-ready fields",
  /confidence|fit_signals|block_reasons|long_horizon_allowed|experience_required|compression_preference/.test(railSrc),
);

console.log("----");
console.log(`RESULT: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log("FAILURES:\n" + fails.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
process.exit(0);
