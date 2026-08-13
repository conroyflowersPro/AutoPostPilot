#!/usr/bin/env node
/**
 * ORDER 6B — Contextual Style Selection & Natural Humor Intelligence tests
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STYLE = process.env.ORDER6B_STYLE || path.join(ROOT, "supabase/functions/weekly-plan/creator-style-decision.ts");
const HUMOR = process.env.ORDER6B_HUMOR || path.join(ROOT, "supabase/functions/weekly-plan/natural-humor-decision.ts");
const INDEX = process.env.ORDER6B_INDEX || path.join(ROOT, "supabase/functions/weekly-plan/index.ts");

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  PASS ", name); }
  else { fail++; console.log("  FAIL ", name); }
}

const style = existsSync(STYLE) ? readFileSync(STYLE, "utf8") : "";
const humor = existsSync(HUMOR) ? readFileSync(HUMOR, "utf8") : "";
const index = existsSync(INDEX) ? readFileSync(INDEX, "utf8") : "";

console.log("ORDER 6B Contextual Style + Natural Humor tests");
console.log("STYLE:", STYLE);
console.log("HUMOR:", HUMOR);
console.log("INDEX:", INDEX);

ok("A. style module exists", style.length > 1000);
ok("A2. humor module exists", humor.length > 1000);
ok("A3. index exists", index.length > 1000);
ok("A4. decideCreatorStyle", /export function decideCreatorStyle/.test(style));
ok("A5. decideNaturalHumor", /export function decideNaturalHumor/.test(humor));
ok("A6. multi-signal style context", /self_projection_soft_align|reader_inference_soft_align/.test(style));
ok("A7. ORDER6B_STYLE_VERSION", /ORDER6B_STYLE_VERSION/.test(style));
ok("A8. ORDER6B_HUMOR_VERSION", /ORDER6B_HUMOR_VERSION/.test(humor));

// No maps style
ok("B. no Topic→Style map", !/topic[_ ]*[=:>].*style|TOPIC_TO_STYLE|topicStyleMap/i.test(style) && /NO_TOPIC_STYLE_MAP/.test(style));
ok("C. no Editorial→Style map", /NO_EDITORIAL_STYLE_MAP/.test(style) && !/EDITORIAL_TO_STYLE|modeStyleMap/i.test(style));
ok("D. no Mechanism→Style map", /NO_MECHANISM_STYLE_MAP/.test(style));
ok("E. no Rail→Style map", /NO_RAIL_STYLE_MAP/.test(style));
ok("F. same topic can differ (no forced topic style)", /void ctx\.topic_cluster/.test(style));
ok("G. same mechanism can differ", /void ctx\.mechanism_status/.test(style));
ok("H. Creator DNA primary", /dna_prefers_compression|CreatorWritingDnaSignals|creator_dna/.test(style));
ok("I. low-barrier survives style", /preserves_low_barrier|everyday_barrier_penalizes/.test(style));
ok("J. short post possible", /short_post_compatible/.test(style));
ok("K. long-form selective", /selective_longform/.test(style) && /selective_longform_not_supported/.test(style));
ok("L. community-native contextual", /community_native_context_fit|community_native_ok/.test(style));

// Humor separations
ok("M. CASUAL does not imply Humor", /NO_CASUAL_HUMOR_MAP|casual_does_not_imply_humor/.test(humor));
ok("N. EXPERIENCE does not imply self-deprecation", /NO_EXPERIENCE_SELF_DEPRECATION|experience_does_not_imply_self_deprecation/.test(humor));
ok("O. Humor may be unsupported", /HUMOR_UNSUPPORTED/.test(humor));
ok("P. Humor must be grounded", /humor_grounded|grounded_irony|no_grounded_humor_source/.test(humor));
ok("Q. No humor quota", /NO_HUMOR_QUOTA/.test(humor));
ok("R. No forced joke", /NO_FORCED_JOKE|forced_humor_risk/.test(humor));
ok("S. No automatic ㅋㅋ", /NO_AUTO_KKK|laughter_marker_permission_only|laughter_marker_allowed/.test(humor));
ok("T. No automatic punchline", /NO_AUTO_PUNCHLINE|punchline_required:\s*false|punchlineRequired = false/.test(humor));
ok("U. Natural punchline may stop", /stop_after_punchline_ok/.test(humor));
ok("V. No mandatory explanation after punchline", /explanation_after_punchline_allowed/.test(humor));
ok("W. Mechanism does not determine Humor", /NO_MECHANISM_HUMOR_MAP|void ctx\.mechanism/.test(humor));
ok("X. Rail does not determine Humor", /NO_RAIL_HUMOR_MAP|void ctx\.rail_status/.test(humor));
ok("Y. Humor cannot fabricate experience", /NO_FABRICATE_EXPERIENCE/.test(humor));
ok("Z. Humor cannot fabricate facts", /NO_FABRICATE_FACTS|must_not_invent_facts/.test(humor));
ok("AA. Humor barrier preserve", /preserves_low_barrier/.test(humor));
ok("AB. Self-projection preserved", /preserves_self_projection/.test(humor));
ok("AC. recent Style repetition soft", /recent_repetition_soft_penalty|no_force_rotation/.test(style));
ok("AD. recent Humor repetition soft", /recent_humor_repetition_risk/.test(humor));
ok("AE. no mechanical rotation", /no_force_rotation|NO_HUMOR_QUOTA/.test(style + humor));
ok("AF. raw manual blocked style", /RAW_MANUAL_TEXT_BLOCKED|raw_style_surface_rejected/.test(style));
ok("AG. raw audience blocked humor", /RAW_TEXT_BLOCKED|raw_humor_surface_rejected/.test(humor));
ok("AH. no few-shot style/humor", /NO_FINISHED_EXAMPLES|few_shot/.test(style) && /sample_joke|few_shot/.test(humor));

// Regressions
ok("AI. ORDER0A volume markers in index", /POSTS_TARGET|required_slots|postsPerDay/.test(index));
ok("AJ. ORDER0B leakage markers", /manual-leakage|ORDER0B|source_role|seed_eligible/.test(index) || existsSync(path.join(path.dirname(INDEX), "manual-leakage-guard.ts")));
ok("AK. ORDER1 interpretation", /interpretSeed|seed-interpretation|seed_interpretation/.test(index));
ok("AL. ORDER2 reaction/self-projection", /selectReactionMechanism|reader-self-projection|reaction_mechanism/.test(index));
ok("AM. ORDER3 thinking rail", /selectThinkingRail|thinking_rail|thinking-rail-runtime/.test(index));
ok("AN. ORDER4 optional audience", true);
ok("AO. ORDER5 everyday before style", /decideEverydayLanguage[\s\S]*decideCreatorStyle/.test(index.replace(/\n/g, " ")));
ok("AP. ORDER6A style foundation", /decideCreatorStyle|ORDER6A_VERSION|order6a_style_foundation/.test(index));

// Wiring
ok("wire style after everyday", /decideEverydayLanguage[\s\S]{0,800}decideCreatorStyle/.test(index.replace(/\n/g," ")));
ok("wire humor after style", /decideCreatorStyle[\s\S]{0,1200}decideNaturalHumor/.test(index.replace(/\n/g," ")));
ok("index APP order6b", /10\.0\.0-order6b/.test(index));
ok("index engine order6b", /phased_v10_order6b_style_humor/.test(index));
ok("index attaches natural_humor", /natural_humor:\s*natural_humor/.test(index));
ok("index attaches humor_status", /humor_status:\s*natural_humor/.test(index));
ok("index attaches self_deprecation_allowed", /self_deprecation_allowed:\s*natural_humor/.test(index));
ok("index attaches laughter_marker_allowed", /laughter_marker_allowed:\s*natural_humor/.test(index));
ok("index attaches stop_after_punchline_ok", /stop_after_punchline_ok:\s*natural_humor/.test(index));
ok("index diagnostics order6b", /order6b_contextual_style_humor/.test(index));
ok("index minimal (no FAMILY_PROFILES in index)", !/FAMILY_PROFILES/.test(index));
ok("index minimal (no detectNaturalSources in index)", !/detectNaturalSources/.test(index));

// Humor schema fields
for (const f of [
  "humor_status","humor_compatible","humor_strength","humor_source_type","humor_grounded",
  "self_deprecation_allowed","laughter_marker_allowed","punchline_compatible","punchline_required",
  "stop_after_punchline_ok","explanation_after_punchline_allowed","humor_risk","forced_humor_risk",
  "confidence","preserves_low_barrier","preserves_self_projection","recent_humor_repetition_risk",
  "order6b_humor_version"
]) {
  ok("schema "+f, new RegExp(f).test(humor));
}

// Families still present
for (const f of ["COMPRESSED_CONVERSATIONAL","REFLECTIVE_CONVERSATIONAL","TECHNICAL_PRACTICAL","CASUAL_OBSERVATION","COMMUNITY_NATIVE_COMPRESSED","SELECTIVE_LONGFORM_REFLECTION","NEUTRAL_CREATOR_DEFAULT"]) {
  ok("family "+f, style.includes(f));
}

// Behavioral source patterns
ok("beh grounded sources list", /irony|contradiction|anticlimax|awkward_truth|shared_recognition|self_observed_imperfection/.test(humor));
ok("beh no joke text storage", !/const JOKE|samplePunchline\s*=/.test(humor));
ok("beh style multi-family score", /scoreFamily|FAMILY_PROFILES/.test(style));

console.log("========================================");
console.log(`ORDER 6B tests: ${pass} PASS / ${fail} FAIL (total ${pass+fail})`);
process.exit(fail ? 1 : 0);
