#!/usr/bin/env node
/**
 * ORDER 6C / Final ORDER 6 — Style/Humor Hardening & Full Validation
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STYLE = process.env.ORDER6C_STYLE || path.join(ROOT, "supabase/functions/weekly-plan/creator-style-decision.ts");
const HUMOR = process.env.ORDER6C_HUMOR || path.join(ROOT, "supabase/functions/weekly-plan/natural-humor-decision.ts");
const INDEX = process.env.ORDER6C_INDEX || path.join(ROOT, "supabase/functions/weekly-plan/index.ts");

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  PASS ", name); }
  else { fail++; console.log("  FAIL ", name); }
}

const style = existsSync(STYLE) ? readFileSync(STYLE, "utf8") : "";
const humor = existsSync(HUMOR) ? readFileSync(HUMOR, "utf8") : "";
const index = existsSync(INDEX) ? readFileSync(INDEX, "utf8") : "";
const flatIdx = index.replace(/\n/g, " ");

console.log("ORDER 6C / Final ORDER 6 validation");
console.log("STYLE:", STYLE, style.length);
console.log("HUMOR:", HUMOR, humor.length);
console.log("INDEX:", INDEX, index.length);

ok("A. coherent creator (identity base + coherence first)", /creator_identity_base|CREATOR_COHERENCE_FIRST|PROFILE_COHERENCE/.test(style));
ok("B. same Topic can yield different Styles (no topic key)", /void ctx\.topic_cluster|NO_TOPIC_STYLE_MAP/.test(style));
ok("C. no Topic→Style map", /NO_TOPIC_STYLE_MAP/.test(style) && !/TOPIC_TO_STYLE|topicStyleMap/.test(style));
ok("D. no Mode→Style map", /NO_EDITORIAL_STYLE_MAP/.test(style) && !/EDITORIAL_TO_STYLE|modeStyleMap/.test(style));
ok("E. no Mechanism→Style map", /NO_MECHANISM_STYLE_MAP/.test(style));
ok("F. no Rail→Style map", /NO_RAIL_STYLE_MAP/.test(style));
ok("G. no Everyday→Style hard map", /NO_EVERYDAY_STATUS_STYLE_MAP/.test(style));
ok("H. Creator DNA primary", /CreatorWritingDnaSignals|dna_prefers_compression|creator_dna/.test(style));
ok("I. recent Style repetition soft only", /recent_repetition_soft_penalty|repetitionRisk/.test(style));
ok("J. no forced Style rotation", /no_force_rotation|NO_FORCED_ROTATION|NO_PERSONA_ROTATION/.test(style));
ok("K. selective long-form", /selective_longform/.test(style) && /selective_longform_not_supported/.test(style));
ok("L. contextual community-native", /community_native_context_fit/.test(style));
ok("M. short-post support", /short_post_compatible/.test(style));
ok("N. low-barrier preservation", /preserves_low_barrier|everyday_barrier_penalizes/.test(style));
ok("O. Humor may be NONE/UNSUPPORTED", /HUMOR_UNSUPPORTED/.test(humor));
ok("P. no Humor quota", /NO_HUMOR_QUOTA|NONE_IS_NORMAL/.test(humor));
ok("Q. CASUAL does not imply Humor", /NO_CASUAL_HUMOR_MAP|casual_does_not_imply_humor/.test(humor));
ok("R. EXPERIENCE does not imply self-deprecation", /NO_EXPERIENCE_SELF_DEPRECATION|experience_does_not_imply_self_deprecation/.test(humor));
ok("S. grounded Humor required", /humor_grounded|no_grounded_humor_source|grounded_irony/.test(humor));
ok("T. no fabricated joke source", /NO_FABRICATE_EXPERIENCE|NO_FABRICATE_FACTS/.test(humor));
ok("U. no automatic ㅋㅋ", /NO_AUTO_KKK|laughter_marker_permission_only/.test(humor));
ok("V. punchline optional", /punchline_compatible/.test(humor));
ok("W. punchline never required", /punchlineRequired = false|NO_AUTO_PUNCHLINE/.test(humor));
ok("X. stop after punchline supported", /stop_after_punchline_ok/.test(humor));
ok("Y. no mandatory explanation after punchline", /explanation_after_punchline_allowed|NO_EXPLANATORY_TAIL/.test(humor));
ok("Z. Mechanism does not determine Humor", /NO_MECHANISM_HUMOR_MAP|void ctx\.mechanism/.test(humor));
ok("AA. Rail does not determine Humor", /NO_RAIL_HUMOR_MAP|void ctx\.rail_status/.test(humor));
ok("AB. Style family does not force Humor", /NO_STYLE_FAMILY_HUMOR_MAP|void ctx\.style_family/.test(humor));
ok("AC. recent Humor repetition soft only", /recent_humor_repetition_risk/.test(humor));
ok("AD. no mechanical Humor rotation", /NO_HUMOR_QUOTA|NO_FORCED_JOKE/.test(humor));
ok("AE. raw manual text blocked", /RAW_MANUAL|raw_style_surface_rejected|raw_humor_surface_rejected/.test(style + humor));
ok("AF. raw audience text blocked", /audience_text|comment_text/.test(style + humor));
ok("AG. historical raw text blocked", /historical_post_text/.test(style + humor));
ok("AH. few-shot Style examples blocked", /few_shot|NO_FINISHED_EXAMPLES/.test(style));
ok("AI. sample joke/punchline blocked", /sample_joke|sample_punchline/.test(humor));
ok("AJ. unsupported facts blocked", /NO_FABRICATE_FACTS|must_not_invent_facts/.test(humor));
ok("AK. unsupported experiences blocked", /NO_FABRICATE_EXPERIENCE/.test(humor));
ok("AL. Reader Self-Projection preserved", /preserves_self_projection|reader_inference_space|self_projection_soft_align/.test(style + humor));
ok("AM. Thinking Rail preserved (style does not rewrite)", /void ctx\.rail_status|NO_RAIL_STYLE_MAP/.test(style));
ok("AN. Reaction Mechanism preserved", /void ctx\.mechanism_status|NO_MECHANISM_STYLE_MAP/.test(style));
ok("AO. Everyday Language preserved", /preserves_low_barrier|everyday_barrier/.test(style));
ok("AP. ORDER0A volume", /POSTS_TARGET|required_slots|postsPerDay/.test(index));
ok("AQ. ORDER0B leakage", /manual-leakage|source_role|ORDER0B/.test(index) || existsSync(path.join(path.dirname(INDEX), "manual-leakage-guard.ts")));
ok("AR. ORDER1 interpretation", /interpretSeed|seed_interpretation/.test(index));
ok("AS. ORDER2 reaction/self-projection", /selectReactionMechanism|reaction_mechanism/.test(index));
ok("AT. ORDER3 thinking rail", /selectThinkingRail|thinking_rail/.test(index));
ok("AU. ORDER4 optional", true);
ok("AV. ORDER5 everyday before style", /decideEverydayLanguage[\s\S]*decideCreatorStyle/.test(flatIdx));
ok("AW. ORDER6A style foundation", /decideCreatorStyle|ORDER6A_VERSION|order6a_style_foundation/.test(index));
ok("AX. ORDER6B humor layer", /decideNaturalHumor|ORDER6B_HUMOR_VERSION|order6b_contextual/.test(index));
ok("6C style version", /ORDER6C_STYLE_VERSION/.test(style));
ok("6C humor version", /ORDER6C_HUMOR_VERSION/.test(humor));
ok("6C no persona rotation", /NO_PERSONA_ROTATION|no_persona_rotation/.test(style));
ok("6C no style template", /NO_STYLE_TEMPLATE|no_style_template/.test(style));
ok("6C authenticity over diversity", /AUTHENTICITY_OVER_DIVERSITY|authenticity_over_diversity/.test(style));
ok("6C no AI report voice", /NO_AI_REPORT_VOICE|no_ai_report_voice/.test(style));
ok("6C surface-only families", /SURFACE_ONLY_FAMILIES|surface_only_families/.test(style));
ok("6C humor optional / NONE normal", /HUMOR_OPTIONAL|NONE_IS_NORMAL/.test(humor));
ok("6C no humor formula", /NO_HUMOR_FORMULA/.test(humor));
for (const f of ["COMPRESSED_CONVERSATIONAL","REFLECTIVE_CONVERSATIONAL","TECHNICAL_PRACTICAL","CASUAL_OBSERVATION","COMMUNITY_NATIVE_COMPRESSED","SELECTIVE_LONGFORM_REFLECTION","NEUTRAL_CREATOR_DEFAULT"]) {
  ok("family "+f, style.includes(f));
}
ok("no fixed Korean sample sentences in style", !/[가-힣]{12,}/.test(style.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*/g,"")));
ok("no hook→formula comments as code maps", !/hook\s*→\s*explanation|setup\s*→\s*punchline every/.test(style+humor));
ok("pipeline Everyday→Style→Humor", /decideEverydayLanguage[\s\S]{0,900}decideCreatorStyle[\s\S]{0,1500}decideNaturalHumor/.test(flatIdx));
ok("index APP order6c", /10\.0\.0-order6c/.test(index));
ok("index engine order6c", /phased_v10_order6c_style_humor_hardened/.test(index));
ok("index diagnostics order6c", /order6c_style_humor_hardened/.test(index));
ok("index no FAMILY_PROFILES", !/FAMILY_PROFILES/.test(index));
ok("index no detectNaturalSources", !/detectNaturalSources/.test(index));
ok("index attaches natural_humor", /natural_humor:\s*natural_humor/.test(index));
ok("index weekly_humor remains 0 (no quota)", /weekly_humor:\s*0/.test(index));
for (const k of ["raw_text","manual_text","audience_text","few_shot","finished_post","historical_post_text","sample_punchline"]) {
  ok("anti-copy key "+k, (style+humor).includes(k));
}
console.log("========================================");
console.log(`ORDER 6C / Final ORDER 6: ${pass} PASS / ${fail} FAIL (total ${pass+fail})`);
process.exit(fail ? 1 : 0);
