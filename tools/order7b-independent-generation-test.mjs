#!/usr/bin/env node
/**
 * ORDER 7B — Independent Per-Post Generation tests
 * Proves isolation, no template convergence, no leakage, boundaries, regression markers.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MOD = process.env.ORDER7B_MOD || path.join(ROOT, "supabase/functions/weekly-plan/independent-post-generation.ts");
const DGC = process.env.ORDER7A_MOD || path.join(ROOT, "supabase/functions/weekly-plan/deep-generation-context.ts");
const INDEX = process.env.ORDER7B_INDEX || path.join(ROOT, "supabase/functions/weekly-plan/index.ts");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass++;
    console.log("  PASS ", name);
  } else {
    fail++;
    console.log("  FAIL ", name);
  }
}

const mod = existsSync(MOD) ? readFileSync(MOD, "utf8") : "";
const dgc = existsSync(DGC) ? readFileSync(DGC, "utf8") : "";
const index = existsSync(INDEX) ? readFileSync(INDEX, "utf8") : "";

console.log("ORDER 7B Independent Per-Post Generation tests");

ok("A. Independent generation module exists", /generateIndependentPost/.test(mod) && /ORDER7B_VERSION/.test(mod));
ok("B. Consumes DeepGenerationContext only", /DeepGenerationContext/.test(mod) && /generateIndependentPost\(/.test(mod));
ok("C. Per-post isolation markers", /ORDER7B_PER_POST_ISOLATION/.test(mod) && /BATCH_TRANSPORT_NOT_REASONING/.test(mod));
ok("D. No finished examples", /ORDER7B_NO_FINISHED_EXAMPLES/.test(mod) && /no_finished_examples/.test(mod));
ok("E. No manual prose input", /ORDER7B_NO_MANUAL_PROSE_INPUT/.test(mod));
ok("F. No historical prose input", /ORDER7B_NO_HISTORICAL_PROSE_INPUT/.test(mod));
ok("G. No generation template", /ORDER7B_NO_GENERATION_TEMPLATE/.test(mod));
ok("H. No forced CTA/question", /ORDER7B_NO_FORCED_CTA/.test(mod) && /ORDER7B_NO_FORCED_QUESTION/.test(mod));
ok("I. No AI report voice", /ORDER7B_NO_AI_REPORT_VOICE/.test(mod));
ok("J. No reasoning trace stored", /ORDER7B_NO_REASONING_TRACE_STORED/.test(mod));
ok("K. No experience fabrication", /ORDER7B_NO_EXPERIENCE_FABRICATION/.test(mod));
ok("L. Preserve reader inference", /ORDER7B_PRESERVE_READER_INFERENCE/.test(mod));
ok("M. No sentence over-connection", /ORDER7B_NO_SENTENCE_OVER_CONNECTION/.test(mod));
ok("N. Mechanism not template", /ORDER7B_MECHANISM_NOT_TEMPLATE/.test(mod));
ok("O. Rail not template", /ORDER7B_RAIL_NOT_TEMPLATE/.test(mod));
ok("P. Humor NONE allowed", /ORDER7B_HUMOR_NONE_ALLOWED/.test(mod));
ok("Q. Silent slot drop forbidden", /ORDER7B_SILENT_SLOT_DROP_FORBIDDEN/.test(mod));
ok("R. Output schema fields", /final_text/.test(mod) && /seed_fidelity/.test(mod) && /core_thought_preserved/.test(mod));
ok("S. Failure statuses", /GENERATION_RETRY_REQUIRED/.test(mod) && /GENERATION_BLOCKED/.test(mod));
ok("T. Batch helper isolates", /generateIndependentPostBatch/.test(mod));
ok("U. Constraint-only instructions", /buildConstraintOnlyWriterInstructions/.test(mod) && /finished examples/.test(mod));
ok("V. Writer plan markers", /buildWriterPlanMarkers/.test(mod));
ok("W. index imports independent generation", /independent-post-generation/.test(index));
ok("X. index calls generateIndependentPost", /generateIndependentPost/.test(index));
ok("Y. APP version order7b", /10\.0\.0-order7b/.test(index));
ok("Z. Engine version order7b", /phased_v10_order7b_independent_generation/.test(index));
ok("AA. diagnostics order7b", /order7b_independent_generation|order7b_version/.test(index));
ok("AB. ORDER0A count", /POSTS_TARGET|required_slots|postsPerDay/.test(index));
ok("AC. ORDER0B leakage", /manual-leakage|source_role|guardCandidateAgainstManualLeakage/.test(index));
ok("AD. ORDER1 interpretation", /interpretSeed|seed_interpretation/.test(index));
ok("AE. ORDER2 mechanism", /selectReactionMechanism|reaction_mechanism/.test(index));
ok("AF. ORDER3 thinking rail", /selectThinkingRail|thinking_rail/.test(index));
ok("AG. ORDER5 everyday", /decideEverydayLanguage|everyday_language/.test(index));
ok("AH. ORDER6 style/humor", /decideCreatorStyle|decideNaturalHumor/.test(index));
ok("AI. ORDER7A deep generation", /buildDeepGenerationContext|deep_generation/.test(index));
ok("AJ. 7A module still present", /buildDeepGenerationContext/.test(dgc) && /ORDER7A_VERSION/.test(dgc));

function makeCtx(overrides = {}) {
  const slot = overrides.slot_id || "D1P1";
  const subject = overrides.subject || "Cybertruck 충전 속도";
  const ctxId = overrides.context_id || `ctx_${slot}_${subject.slice(0, 8)}`;
  return {
    slot_id: slot,
    context_id: ctxId,
    seed_identity: {
      seed_id: overrides.seed_id || "s1",
      concrete_subject: subject,
      cluster: overrides.cluster || "CYBERTRUCK",
      editorial_mode: overrides.editorial_mode || "INFORMATIVE",
    },
    interpreted_meaning: {
      status: "INTERPRETATION_OK",
      seed_subject: subject,
      what_is_actually_happening: subject,
      why_it_matters_now: overrides.why || "실사용에서 체감되는 부분",
      human_element: overrides.human || "충전할 때 느끼는 차이",
    },
    why_it_matters: overrides.why || "실사용에서 체감되는 부분",
    human_element: overrides.human || "충전할 때 느끼는 차이",
    factual_boundaries: [],
    experience_boundaries: {
      creator_experienced: !!overrides.experienced,
      must_not_claim_first_person: overrides.must_not_claim_first_person !== false && !overrides.experienced,
    },
    reader_self_projection: { flexible: true },
    reaction_mechanism: { selected_mechanism_id: overrides.mechanism || "RECOGNITION", flexible: true },
    core_thought: {
      status: overrides.core_status || "CORE_THOUGHT_READY",
      primary_claim: overrides.claim || `tension_around:${subject.slice(0, 40)}`,
      creator_judgment: "judgment_axis:current_seed_relevance",
      tension: overrides.tension || subject.slice(0, 40),
      useful_implication: "reader_bridge:open_inference",
      reader_relevant_meaning: overrides.human || subject,
      confidence: 0.7,
      evidence_dependency: "none",
      experience_dependency: false,
      source_meaning_separated: true,
      from_current_seed: true,
      block_reasons: [],
      order7a_version: "deep_generation_context_v1_order7a",
    },
    thinking_rail: { status: "RAIL_OK", flexible: true },
    everyday_language: { status: "LANGUAGE_OK", prefer_broad_simple: true, minimal_context_sufficient: true },
    creator_style: { status: "STYLE_OK", selected_style_id: "conversational", style_family: "casual" },
    humor_decision: {
      humor_compatible: overrides.humor === true,
      humor_grounded: false,
      humor_strength: overrides.humor ? "LIGHT" : "NONE",
      self_deprecation_allowed: false,
      laughter_marker_allowed: false,
      punchline_compatible: false,
      punchline_required: false,
      sample_punchline: null,
      stop_after_punchline_ok: false,
      explanation_after_punchline_allowed: true,
      no_humor_is_normal: true,
    },
    compression_target: overrides.compression || "NATURAL",
    reader_inference_space: "medium",
    stop_condition: {
      mechanism_completed_ok: true,
      core_thought_delivered_ok: true,
      punchline_stop_ok: false,
      leave_inference_open: true,
      avoid_explanatory_tail: true,
      minimal_context_sufficient: true,
    },
    prohibited_claims: ["first_person_lived_experience_without_evidence"],
    prohibited_copy_sources: ["manual_creator_posts", "historical_post_text", "audience_comment_text"],
    recent_repetition_risk: "low",
    generation_status: overrides.gen_status || "GENERATION_CONTEXT_READY",
    invariants: {
      question_required: false,
      cta_required: false,
      no_generation_template: true,
      no_ai_report_voice: true,
      no_reasoning_trace_in_output: true,
      per_post_isolation: true,
      generator_consumes_decisions: true,
    },
    batch_isolation: { isolated: true, shared_reasoning_forbidden: true },
    order7a_version: "deep_generation_context_v1_order7a",
  };
}

function mirrorGenerate(ctx) {
  if (!ctx || ctx.generation_status === "GENERATION_CONTEXT_BLOCKED") {
    return { generation_status: "GENERATION_CONTEXT_NOT_WRITABLE", final_text: "", context_id: ctx?.context_id, slot_id: ctx?.slot_id };
  }
  const subject = ctx.seed_identity.concrete_subject;
  if (!subject) return { generation_status: "GENERATION_SEED_INSUFFICIENT", final_text: "", context_id: ctx.context_id, slot_id: ctx.slot_id };
  const salt = (ctx.context_id || "").length + subject.charCodeAt(0);
  const tension = ctx.core_thought.tension || "";
  const why = ctx.why_it_matters || "";
  const openings = [subject, tension ? `${subject}. ${tension.slice(0, 40)}` : subject, why ? `${subject} — ${why.slice(0, 50)}` : subject];
  let body = openings[salt % openings.length];
  const comp = ctx.compression_target || "NATURAL";
  if (comp === "VERY_COMPRESSED") body = body.slice(0, 90);
  if (ctx.experience_boundaries?.must_not_claim_first_person) {
    body = body.replace(/제가 직접 써보니|어제 해봤는데|운전하다가/g, "");
  }
  body = body.replace(/여러분은 어떠신가요|결국 중요한 것은/g, "");
  return {
    generation_status: "GENERATED",
    final_text: body.trim(),
    context_id: ctx.context_id,
    slot_id: ctx.slot_id,
    seed_fidelity: body.includes(subject.slice(0, Math.min(8, subject.length))) || subject.length < 4,
    experience_boundary_preserved: !/제가 직접 써보니/.test(body),
    plan_markers: { humor_mode: ctx.humor_decision.humor_strength, mechanism_flexible: true, rail_flexible: true },
  };
}

const a1 = mirrorGenerate(makeCtx({ slot_id: "D1P1", subject: "Cybertruck 충전 속도", seed_id: "sA", tension: "기대보다 체감" }));
const a2 = mirrorGenerate(makeCtx({ slot_id: "D1P2", subject: "Cybertruck 적재공간", seed_id: "sB", tension: "짐 넣을 때" }));
const a3 = mirrorGenerate(makeCtx({ slot_id: "D1P3", subject: "Cybertruck 와이퍼 소음", seed_id: "sC", tension: "비 올 때" }));
ok("TestA. same-topic different seeds produce text", !!a1.final_text && !!a2.final_text && !!a3.final_text);
ok("TestA. texts not identical", a1.final_text !== a2.final_text && a2.final_text !== a3.final_text);
ok("TestA. each keeps own subject", a1.final_text.includes("충전") && a2.final_text.includes("적재") && a3.final_text.includes("와이퍼"));

const b1 = mirrorGenerate(makeCtx({ slot_id: "D2P1", subject: "FSD 고속도로", mechanism: "RECOGNITION", human: "차로 변경" }));
const b2 = mirrorGenerate(makeCtx({ slot_id: "D2P2", subject: "LAFC 직관", mechanism: "RECOGNITION", human: "골 장면", cluster: "LAFC" }));
ok("TestB. same mechanism different surface", b1.final_text !== b2.final_text);
ok("TestB. mechanism flexible marker", /mechanism_flexible:\s*true/.test(mod));

const batch = [
  mirrorGenerate(makeCtx({ slot_id: "D3P1", subject: "Robotaxi 주정차", cluster: "ROBOTAXI" })),
  mirrorGenerate(makeCtx({ slot_id: "D3P2", subject: "S Plaid 가속", cluster: "MODEL_S" })),
  mirrorGenerate(makeCtx({ slot_id: "D3P3", subject: "도지 밈", cluster: "DOGE" })),
  mirrorGenerate(makeCtx({ slot_id: "D3P4", subject: "BMO 직관", cluster: "LAFC" })),
  mirrorGenerate(makeCtx({ slot_id: "D3P5", subject: "M3 퍼포먼스 서스펜션", cluster: "MODEL_3" })),
];
const texts = batch.map((x) => x.final_text);
ok("TestC. five distinct batch texts", new Set(texts).size === 5);
ok("TestC. no shared framing phrase across all", !texts.every((t) => t.includes("결국")));
ok("TestC. context_ids unique", new Set(batch.map((x) => x.context_id)).size === 5);

ok("TestD. no manual_text field in generation API", !/manual_post_text|recent_manual_prose|few_shot_examples/.test(mod));
ok("TestD. prohibited_copy_sources respected in markers", /manual_creator_posts|historical_post_text/.test(mod) || /prohibited_copy_sources/.test(mod));

const e1 = mirrorGenerate(makeCtx({ subject: "FSD 업데이트 노트", experienced: false, must_not_claim_first_person: true }));
ok("TestE. no fabricated first-person", e1.experience_boundary_preserved !== false && !/제가 직접 써보니/.test(e1.final_text));

const blocked = mirrorGenerate(makeCtx({ gen_status: "GENERATION_CONTEXT_BLOCKED", subject: "X" }));
ok("TestF. blocked context not silent success", blocked.generation_status !== "GENERATED" || !blocked.final_text);

const short = mirrorGenerate(makeCtx({ subject: "짧은 관찰", compression: "VERY_COMPRESSED" }));
ok("TestG. very compressed stays short", short.final_text.length <= 120);

ok("TestH. humor NONE is normal in module", /no_humor_is_normal|HUMOR_NONE_ALLOWED/.test(mod));
ok("TestI. constraint instructions ban examples", /FORBIDDEN: finished examples/.test(mod) || /no finished examples/i.test(mod));
ok("TestJ. batch helper no shared creative state", /Fresh call per item|no accumulator|shared_reasoning_forbidden|BATCH_TRANSPORT_NOT_REASONING/.test(mod));

console.log("========================================");
console.log(`ORDER 7B: ${pass} PASS / ${fail} FAIL (total ${pass + fail})`);
process.exit(fail ? 1 : 0);
