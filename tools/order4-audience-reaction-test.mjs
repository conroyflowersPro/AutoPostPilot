/**
 * ORDER 4 — Audience Reaction Intelligence structural tests (CI)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const ROOT = process.env.ORDER4_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WP = path.join(ROOT, "supabase/functions/weekly-plan");
let passed = 0, failed = 0;
function ok(n, c, d="") { if (c) { console.log("PASS —", n); passed++; } else { console.log("FAIL —", n, d); failed++; } }
const mod = path.join(WP, "audience-reaction-intelligence.ts");
ok("module exists", fs.existsSync(mod));
ok("index exists", fs.existsSync(path.join(WP, "index.ts")));
ok("migration exists", fs.existsSync(path.join(ROOT, "supabase/migrations/20260812_audience_reaction_intelligence_v1.sql")));
const src = fs.readFileSync(mod, "utf8");
const indexSrc = fs.readFileSync(path.join(WP, "index.ts"), "utf8");
ok("ORDER4_VERSION", src.includes("ORDER4_VERSION"));
ok("analyzePublishedPostAudience", src.includes("analyzePublishedPostAudience"));
ok("no topic map", src.includes("ORDER4_NO_TOPIC_MECHANISM_MAP = true"));
ok("raw text not generation", src.includes("ORDER4_RAW_TEXT_NOT_FOR_GENERATION"));
ok("no profiling", src.includes("ORDER4_NO_INDIVIDUAL_PROFILING"));
ok("seed false", /audienceEvidenceMayBecomeSeed[\s\S]*false/.test(src));
ok("dna false", /audienceEvidenceMayBecomeCreatorDna[\s\S]*false/.test(src));
ok("MANUAL_PUBLISHED", src.includes("MANUAL_PUBLISHED"));
ok("UNPUBLISHED_AI", src.includes("UNPUBLISHED_AI"));
ok("INSUFFICIENT_EVIDENCE", src.includes("INSUFFICIENT_EVIDENCE"));
ok("PERSONAL_STORY", src.includes("PERSONAL_STORY"));
ok("aggregate no raw", src.includes("contains_raw_comment_examples: false"));
ok("ORDER0A", indexSrc.includes("count_integrity"));
ok("ORDER0B", indexSrc.includes("guardCandidateAgainstManualLeakage"));
ok("ORDER1", indexSrc.includes("interpretSeed"));
ok("ORDER2", indexSrc.includes("selectReactionMechanism"));
ok("ORDER3", indexSrc.includes("selectThinkingRail"));
ok("no ORDER5", !/ORDER5|everyday_language_reasoning/.test(indexSrc));
console.log("----\nRESULT:", passed, "passed,", failed, "failed");
if (failed) process.exit(1);
console.log("ALL PASS");
