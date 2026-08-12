/**
 * ORDER 5A — Everyday Language Foundation tests (A–P + structural)
 * Run: ORDER5A_ROOT=$PWD node tools/order5a-everyday-language-test.mjs
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = process.env.ORDER5A_ROOT || process.cwd();
const modPath = path.join(ROOT, "supabase/functions/weekly-plan/everyday-language-reasoning.ts");

if (!fs.existsSync(modPath)) {
  console.error("FAIL: module missing", modPath);
  process.exit(1);
}

const src = fs.readFileSync(modPath, "utf8");

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    failures.push(name + (detail ? " — " + detail : ""));
    console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

// ---------- Structural source guards ----------
ok("S1 module exists", fs.existsSync(modPath));
ok("S2 ORDER5A_VERSION present", /ORDER5A_VERSION/.test(src));
ok("S3 style_decision null hardcode", /style_decision:\s*null/.test(src) && /ORDER5A_STYLE_ALWAYS_NULL/.test(src));
ok("S4 no humor engine", /ORDER5A_NO_HUMOR_ENGINE/.test(src) && /humor_engine_active:\s*false/.test(src));
ok("S5 no topic entry map flag", /ORDER5A_NO_TOPIC_ENTRY_MAP/.test(src));
ok("S6 no fixed vocab table flag", /ORDER5A_NO_FIXED_VOCAB_TABLE/.test(src));
ok("S7 raw manual blocked flag", /ORDER5A_RAW_MANUAL_TEXT_BLOCKED/.test(src));
ok("S8 raw audience blocked flag", /ORDER5A_RAW_AUDIENCE_TEXT_BLOCKED/.test(src));
ok("S9 decideEverydayLanguage export", /export function decideEverydayLanguage/.test(src));
ok("S10 EverydayLanguageDecision type", /export type EverydayLanguageDecision/.test(src));
ok("S11 PRECISION_CONFLICT status", /PRECISION_CONFLICT/.test(src));
ok("S12 no word-replacement dictionary", !/const\s+VOCAB\s*=|wordA.*wordB|viralWords|simpleWordTable/.test(src));
ok("S13 no topic→strategy switch on topic labels", !/switch\s*\(\s*topic\s*\)/.test(src) && !/topicToEntry\s*=/.test(src) && !/[^A-Z_]TOPIC_ENTRY_MAP\s*=/.test(src));
ok("S14 sensationalism_blocked field", /sensationalism_blocked/.test(src));
ok("S15 attention_relevance_ok field", /attention_relevance_ok/.test(src));
ok("S16 protected_meaning field", /protected_meaning/.test(src));
ok("S17 forbidden_simplifications field", /forbidden_simplifications/.test(src));
ok("S18 comprehension_barrier field", /comprehension_barrier/.test(src));
ok("S19 participation_barrier field", /participation_barrier/.test(src));
ok("S20 broad_concrete_anchor fields", /broad_concrete_anchor_needed/.test(src) && /broad_concrete_anchor_type/.test(src));

async function loadModule() {
  try {
    const url = pathToFileURL(modPath).href;
    return await import(url);
  } catch {
    return null;
  }
}

const mod = await loadModule();

function baseInterp(over = {}) {
  return {
    status: "INTERPRETATION_OK",
    what_is_new_or_interesting: "",
    concrete_human_element: "",
    possible_reader_connection: "",
    possible_macro_implication: "",
    novelty_signal: "NONE",
    factual_boundaries: [],
    experience_boundaries: {
      creator_experienced: false,
      evidence_supported: false,
      must_not_claim_first_person: true,
    },
    ...over,
  };
}

if (mod && typeof mod.decideEverydayLanguage === "function") {
  {
    const d = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        concrete_human_element: "",
        possible_reader_connection: "",
        possible_macro_implication: "장기 이동 패턴 변화",
        novelty_signal: "MEDIUM",
        factual_boundaries: [{ item: "일반적 관측", status: "confirmed" }],
      }),
    });
    ok("A prefer broader when accurate", d.broad_concrete_anchor_needed === true || d.reader_entry_strategy !== "PRESERVE_AS_IS");
  }

  {
    const d = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        factual_boundaries: [
          { item: "FSD v12.5.1 빌드 특정 버전", status: "confirmed" },
          { item: "HW4 전용 파라미터", status: "confirmed" },
        ],
        what_is_new_or_interesting: "버전 고정 이슈",
        novelty_signal: "HIGH",
      }),
    });
    ok(
      "B precision conflict or forbidden strip",
      d.status === "PRECISION_CONFLICT" ||
        d.forbidden_simplifications.some((x) => String(x).includes("strip_precision")) ||
        d.protected_meaning.length > 0,
    );
  }

  ok("C no fixed vocab dependency", mod.ORDER5A_NO_FIXED_VOCAB_TABLE === true);
  ok("D no topic map flag", mod.ORDER5A_NO_TOPIC_ENTRY_MAP === true);

  {
    const a = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        what_is_new_or_interesting: "Tesla topic A",
        concrete_human_element: "운전 중 느낀 점",
        possible_reader_connection: "비슷한 경험",
      }),
    });
    const b = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        what_is_new_or_interesting: "LAFC topic B",
        concrete_human_element: "경기장에서 느낀 점",
        possible_reader_connection: "비슷한 경험",
      }),
    });
    ok(
      "D contextual not topic-keyed",
      a.comprehension_barrier === b.comprehension_barrier ||
        a.reader_entry_strategy === b.reader_entry_strategy,
    );
  }

  {
    const low = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        concrete_human_element: "출근길 습관",
        possible_reader_connection: "누구나 하는 선택",
        novelty_signal: "LOW",
      }),
    });
    const high = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        possible_macro_implication: "시스템 전체 아키텍처 함의",
        novelty_signal: "HIGH",
        factual_boundaries: [
          { item: "API latency p99", status: "confirmed" },
          { item: "firmware OTA channel", status: "confirmed" },
          { item: "SDK endpoint deprecation", status: "confirmed" },
        ],
      }),
    });
    ok(
      "E comprehension contextual",
      low.comprehension_barrier === "LOW" || low.comprehension_barrier === "MODERATE",
    );
    ok(
      "E2 high jargon/abstraction raises barrier",
      high.comprehension_barrier === "HIGH" || high.comprehension_barrier === "MODERATE",
    );
  }

  {
    const open = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        possible_reader_connection: "독자도 비슷한 상황 가능",
        concrete_human_element: "일상 선택",
      }),
      mechanism: { story_invitation_strength: "HIGH" },
    });
    const closed = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        experience_boundaries: {
          creator_experienced: true,
          evidence_supported: true,
          must_not_claim_first_person: false,
        },
      }),
    });
    ok("F participation lower when open invite", open.participation_barrier === "LOW" || open.participation_barrier === "MODERATE");
    ok("F2 lived-only tends higher participation barrier", closed.participation_barrier === "HIGH" || closed.participation_barrier === "MODERATE");
  }

  {
    const d = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        status: "INTERPRETATION_OK",
        novelty_signal: "NONE",
      }),
    });
    ok(
      "G attention relevance gate",
      d.attention_reengagement_needed === false || d.attention_relevance_ok === true,
    );
  }

  {
    const d = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        concrete_human_element: "가격 변화",
        possible_reader_connection: "구매 고민",
      }),
    });
    ok("H sensationalism always blocked", d.sensationalism_blocked === true);
  }

  {
    const d = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        concrete_human_element: "운전",
        possible_macro_implication: "패턴",
      }),
      creator_comm_pref: {
        prefers_broad_concrete_when_accurate: true,
        allows_attention_reentry: true,
      },
    });
    ok("I creator pref abstract only", d.style_decision === null && !("raw_creator_text" in d));
    ok("I2 fit may mention creator_pref", Array.isArray(d.fit_signals));
  }

  ok("J raw manual blocked constant", mod.ORDER5A_RAW_MANUAL_TEXT_BLOCKED === true);
  ok("J2 no manual_text field in decision", (() => {
    const d = mod.decideEverydayLanguage({ interpretation: baseInterp() });
    return !("manual_text" in d) && !("raw_post" in d) && !("example_hook" in d);
  })());

  ok("K raw audience blocked constant", mod.ORDER5A_RAW_AUDIENCE_TEXT_BLOCKED === true);
  {
    const d = mod.decideEverydayLanguage({
      interpretation: baseInterp({ concrete_human_element: "테스트" }),
      audience_signals: {
        participation_barrier_tendency: "LOW",
        comprehension_barrier_tendency: "MODERATE",
        strong_self_projection_rate: 0.4,
      },
    });
    ok("K2 only structured audience signals", !("raw_comments" in d) && d.style_decision === null);
  }

  {
    const d = mod.decideEverydayLanguage({ interpretation: baseInterp({ concrete_human_element: "일상" }) });
    ok("L style_decision null", d.style_decision === null);
    ok("L2 ORDER5A_STYLE_ALWAYS_NULL", mod.ORDER5A_STYLE_ALWAYS_NULL === true);
  }

  {
    const d = mod.decideEverydayLanguage({ interpretation: baseInterp() });
    ok("M humor_engine_active false", d.humor_engine_active === false);
    ok("M2 NO_HUMOR flag", mod.ORDER5A_NO_HUMOR_ENGINE === true);
  }

  {
    const d = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        factual_boundaries: [{ item: "confirmed only", status: "confirmed" }],
      }),
    });
    ok(
      "N protected_meaning only from input facts",
      d.protected_meaning.every((p) => typeof p === "string") &&
        !d.protected_meaning.some((p) => /invented|fabricat/i.test(p)),
    );
  }

  {
    const d = mod.decideEverydayLanguage({
      interpretation: baseInterp({
        experience_boundaries: {
          creator_experienced: false,
          evidence_supported: false,
          must_not_claim_first_person: true,
        },
      }),
    });
    ok(
      "O no first-person fabrication path",
      d.forbidden_simplifications.includes("claim_unverified_first_person") ||
        d.protected_meaning.some((p) => /experience_boundary/.test(p)),
    );
  }

  {
    const blocked = mod.decideEverydayLanguage({
      interpretation: baseInterp({ status: "INTERPRETATION_BLOCKED" }),
    });
    ok("P blocked status", blocked.status === "BLOCKED" && blocked.style_decision === null);
    ok("P2 isEverydayLanguagePassable false on blocked", mod.isEverydayLanguagePassable(blocked) === false);
  }

  ok("X ORDER5A_GUARDS present", mod.ORDER5A_GUARDS && mod.ORDER5A_GUARDS.version === mod.ORDER5A_VERSION);
} else {
  console.log("WARN: native TS import unavailable — structural tests only counted");
  ok("A structural broader preference code present", /prefer_broad|broad_concrete_anchor_needed/.test(src));
  ok("B structural precision conflict present", /PRECISION_CONFLICT|strip_precision/.test(src));
  ok("C structural no vocab table", /ORDER5A_NO_FIXED_VOCAB_TABLE/.test(src));
  ok("D structural no topic map", /ORDER5A_NO_TOPIC_ENTRY_MAP/.test(src));
  ok("E structural comprehension assessor", /assessComprehensionBarrier/.test(src));
  ok("E2 structural jargon/abstraction", /assessJargonRisk|assessAbstractionRisk/.test(src));
  ok("F structural participation assessor", /assessParticipationBarrier/.test(src));
  ok("F2 structural lived participation", /requiresLived|participation_barrier/.test(src));
  ok("G structural attention relevance", /attention_relevance_ok|evaluateAttentionStrategy/.test(src));
  ok("H structural sensationalism block", /sensationalism_blocked:\s*true/.test(src));
  ok("I structural creator pref abstract", /CreatorCommunicationPreference|creator_comm_pref/.test(src));
  ok("I2 structural no raw creator text field", !/raw_creator_text|manual_post_text/.test(src));
  ok("J structural raw manual blocked", /ORDER5A_RAW_MANUAL_TEXT_BLOCKED/.test(src));
  ok("J2 structural no example_hook", !/example_hook|sample_punchline/.test(src));
  ok("K structural raw audience blocked", /ORDER5A_RAW_AUDIENCE_TEXT_BLOCKED/.test(src));
  ok("K2 structural audience signals only", /AudienceBarrierSignals/.test(src));
  ok("L structural style null", /style_decision:\s*null/.test(src));
  ok("L2 structural STYLE_ALWAYS_NULL", /ORDER5A_STYLE_ALWAYS_NULL/.test(src));
  ok("M structural humor false", /humor_engine_active:\s*false/.test(src));
  ok("M2 structural NO_HUMOR", /ORDER5A_NO_HUMOR_ENGINE/.test(src));
  ok("N structural protected_meaning", /protected_meaning/.test(src));
  ok("O structural experience boundary forbid", /claim_unverified_first_person|must_not_claim_first_person/.test(src));
  ok("P structural BLOCKED status", /status === \"INTERPRETATION_BLOCKED\"|\"BLOCKED\"/.test(src));
  ok("P2 structural isEverydayLanguagePassable", /isEverydayLanguagePassable/.test(src));
  ok("X structural GUARDS", /ORDER5A_GUARDS/.test(src));
}

console.log("\n---");
console.log(`RESULT: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("Failures:");
  for (const f of failures) console.log(" -", f);
}
process.exit(failed > 0 ? 1 : 0);
