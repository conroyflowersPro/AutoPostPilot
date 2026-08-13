/**
 * ORDER 5B — Everyday Language Pipeline Integration tests
 * Run: node tools/order5b-everyday-pipeline-test.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.env.ORDER5B_ROOT || process.cwd();
const modPath = path.join(ROOT, "supabase/functions/weekly-plan/everyday-language-reasoning.ts");
const indexPath = path.join(ROOT, "supabase/functions/weekly-plan/index.ts");

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; failures.push(name + (detail ? " — " + detail : "")); console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

const modSrc = fs.existsSync(modPath) ? fs.readFileSync(modPath, "utf8") : "";
const idxSrc = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";

ok("A module exists", !!modSrc);
ok("B ORDER5A_VERSION preserved", /ORDER5A_VERSION/.test(modSrc));
ok("C ORDER5B_VERSION present", /ORDER5B_VERSION\s*=\s*"everyday_language_pipeline_v1_order5b"/.test(modSrc));
ok("D ORDER5B_PIPELINE_INTEGRATED", /ORDER5B_PIPELINE_INTEGRATED\s*=\s*true/.test(modSrc));
ok("E decideEverydayLanguage export", /export function decideEverydayLanguage/.test(modSrc));
ok("F style_decision always null", /style_decision:\s*null/.test(modSrc) && /ORDER5A_STYLE_ALWAYS_NULL/.test(modSrc));
ok("G humor inactive", /humor_engine_active:\s*false/.test(modSrc) && /ORDER5A_NO_HUMOR_ENGINE/.test(modSrc));
ok("H no topic→entry map", /ORDER5A_NO_TOPIC_ENTRY_MAP/.test(modSrc) && !/topicToEntry\s*=/.test(modSrc));
ok("I no fixed vocab table", /ORDER5A_NO_FIXED_VOCAB_TABLE/.test(modSrc));
ok("J raw manual text blocked", /ORDER5A_RAW_MANUAL_TEXT_BLOCKED/.test(modSrc));
ok("K raw audience text blocked", /ORDER5A_RAW_AUDIENCE_TEXT_BLOCKED/.test(modSrc));
ok("L precision conflict status", /PRECISION_CONFLICT/.test(modSrc));
ok("M attention_relevance_ok field", /attention_relevance_ok/.test(modSrc));
ok("N sensationalism_blocked field", /sensationalism_blocked/.test(modSrc));
ok("O human_relevance_bridge field", /human_relevance_bridge/.test(modSrc));
ok("P reader_entry_strategy field", /reader_entry_strategy/.test(modSrc));
ok("Q order5b_version on decision", /order5b_version:\s*ORDER5B_VERSION/.test(modSrc));
ok("R self_projection_preservation", /self_projection_preservation/.test(modSrc));
ok("S protected_meaning field", /protected_meaning/.test(modSrc));
ok("T isEverydayLanguagePassable", /isEverydayLanguagePassable/.test(modSrc));
ok("U index exists", !!idxSrc);
ok("V import decideEverydayLanguage", /decideEverydayLanguage/.test(idxSrc) && /from\s+"\.\/everyday-language-reasoning\.ts"/.test(idxSrc));
ok("W import ORDER5B_VERSION", /ORDER5B_VERSION/.test(idxSrc));
ok("X APP_VERSION 10.0.0-order5b", /APP_VERSION\s*=\s*"10\.0\.0-order5b"/.test(idxSrc));
ok("Y WEEKLY_ENGINE phased_v10_order5b_everyday_language", /WEEKLY_ENGINE_VERSION\s*=\s*"phased_v10_order5b_everyday_language"/.test(idxSrc));
ok("Z compactSlot accepts language param", /function compactSlot\([\s\S]*?language\?:\s*EverydayLanguageDecision/.test(idxSrc));
ok("AA compactSlot calls decideEverydayLanguage after rail", /selectThinkingRail\([\s\S]*?decideEverydayLanguage\(/.test(idxSrc));
ok("AB select path decideEverydayLanguage after selectThinkingRail", /const rail = selectThinkingRail\([\s\S]*?const lang = decideEverydayLanguage\(/.test(idxSrc));
ok("AC fill path decideEverydayLanguage after railFill", /const railFill = selectThinkingRail\([\s\S]*?const langFill = decideEverydayLanguage\(/.test(idxSrc));
ok("AD thinking_rail passed into language decision", /thinking_rail:\s*\{[\s\S]*?compression_preference[\s\S]*?preserve_reader_entry:\s*true/.test(idxSrc));
ok("AE everyday_language attached on slot", /everyday_language,/.test(idxSrc) && /language_status:\s*everyday_language\.status/.test(idxSrc));
ok("AF reader_entry_strategy on slot", /reader_entry_strategy:\s*everyday_language\.reader_entry_strategy/.test(idxSrc));
ok("AG human_relevance_bridge on slot", /human_relevance_bridge:\s*everyday_language\.human_relevance_bridge/.test(idxSrc));
ok("AH style_decision null on slot", /style_decision:\s*null/.test(idxSrc));
ok("AI order5b_version on slot", /order5b_version:\s*ORDER5B_VERSION/.test(idxSrc));
ok("AJ diagnostics order5b_everyday_language", /order5b_everyday_language:\s*true/.test(idxSrc));
ok("AK diagnostics everyday_language_version", /everyday_language_version:\s*ORDER5B_VERSION/.test(idxSrc));
ok("AL language counters", /language_ok/.test(idxSrc) && /language_translation/.test(idxSrc) && /language_precision/.test(idxSrc) && /language_other/.test(idxSrc));
ok("AM ORDER 0A–5A preserved markers", /order0b_manual_leakage_separation:\s*true/.test(idxSrc) && /order3_thinking_rail:\s*true/.test(idxSrc) && /order5a_foundation_version:\s*ORDER5A_VERSION/.test(idxSrc));
ok("AN no forced CTA/question from language layer", !/FORCE_CTA|FORCE_QUESTION|forced_cta|must_ask_question/.test(modSrc + idxSrc));
ok("AO no mechanism→language map", !/MECHANISM_TO_LANGUAGE|mechanismToLanguage\s*=/.test(modSrc + idxSrc));
ok("AP no rail→language map", !/RAIL_TO_LANGUAGE|railToLanguage\s*=/.test(modSrc + idxSrc));
ok("AQ no topic→language switch", !/switch\s*\(\s*topic\s*\)/.test(modSrc));
ok("AR short-post / precision protection", /PRECISION_CONFLICT|forbidden_simplifications|protected_meaning/.test(modSrc));
ok("AS pipeline order rail then language", /selectThinkingRail[\s\S]{0,500}decideEverydayLanguage/.test(idxSrc));
ok("AT index size >= 35k", idxSrc.length >= 35000, `len=${idxSrc.length}`);
ok("AU module size >= 21k", modSrc.length >= 21000, `len=${modSrc.length}`);
ok("AV no Netlify deploy markers", !/NETLIFY_DEPLOY_ORDER5B|force_netlify/.test(idxSrc + modSrc));
ok("AW ORDER 5C not started", !/ORDER5C|order5c|phased_v10_order5c/.test(idxSrc + modSrc));
ok("AX isPrecisionBlocked present", /isPrecisionBlocked/.test(modSrc) || /isPrecisionBlocked/.test(idxSrc));
ok("AY low-barrier statuses counted", /LOW_BARRIER_READY|NO_TRANSLATION_NEEDED|LANGUAGE_OK/.test(idxSrc));
ok("AZ TRANSLATION_NEEDED counter path", /TRANSLATION_NEEDED/.test(idxSrc));
ok("BA thinking_rail status forwarded", /status:\s*thinking_rail\.status|status:\s*rail\.status|status:\s*railFill\.status/.test(idxSrc));
ok("BB compactSlot default decides language when null", /language \|\|[\s\S]*decideEverydayLanguage/.test(idxSrc));
ok("BC fill path passes langFill into compactSlot", /compactSlot\([^)]*langFill\)/.test(idxSrc));
ok("BD select path passes lang into compactSlot", /compactSlot\([\s\S]{0,160}lang\)/.test(idxSrc));
ok("BE compression_preference_lang on slot", /compression_preference_lang:\s*everyday_language\.compression_preference/.test(idxSrc));
ok("BF precision_conflict on slot", /precision_conflict:\s*everyday_language\.precision_conflict/.test(idxSrc));
ok("BG attention_relevance_ok on slot", /attention_relevance_ok:\s*everyday_language\.attention_relevance_ok/.test(idxSrc));
ok("BH sensationalism_blocked on slot", /sensationalism_blocked:\s*everyday_language\.sensationalism_blocked/.test(idxSrc));
ok("BI self_projection_preservation on slot", /self_projection_preservation:\s*everyday_language\.self_projection_preservation/.test(idxSrc));
ok("BJ minimal_context_sufficient on slot", /minimal_context_sufficient:\s*everyday_language\.minimal_context_sufficient/.test(idxSrc));
ok("BK order5a foundation version in diagnostics", /order5a_foundation_version:\s*ORDER5A_VERSION/.test(idxSrc));
ok("BL engine field equals weekly engine version", /engine:\s*WEEKLY_ENGINE_VERSION/.test(idxSrc));
ok("BM no ORDER 6 markers", !/ORDER6|order6_|phased_v10_order6/.test(idxSrc + modSrc));
ok("BN selectThinkingRail still present", /selectThinkingRail/.test(idxSrc));
ok("BO ORDER 0A count integrity path preserved", /countIntegrityOk|base_required_slots|integrity_fills/.test(idxSrc));
ok("BP ORDER 0B leakage marker preserved", /order0b_manual_leakage_separation/.test(idxSrc));
ok("BQ ORDER 1 interpretation preserved", /order1_seed_interpretation:\s*true/.test(idxSrc));
ok("BR ORDER 2 mechanism preserved", /order2_reader_mechanism:\s*true/.test(idxSrc));
ok("BS ORDER 3 rail preserved", /order3_thinking_rail:\s*true/.test(idxSrc));
ok("BT SHA target index 36244", idxSrc.length === 36244 || Math.abs(idxSrc.length - 36244) < 50, `len=${idxSrc.length}`);

console.log("\n---");
console.log(`RESULT: ${passed} passed, ${failed} failed`);
if (failures.length) { console.log("Failures:"); for (const f of failures) console.log(" -", f); }
process.exit(failed > 0 ? 1 : 0);
