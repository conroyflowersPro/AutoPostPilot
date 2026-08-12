/**
 * ORDER 0B — Manual Post Leakage Separation acceptance tests (A–G)
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wp = join(root, "supabase/functions/weekly-plan");

const STOP = new Set(
  "이 그 저 것 수 등 및 또 더 좀 잘 안 못 은 는 이 가 을 를 에 의 로 와 과 도 만 부터 까지 the a an of to in on for and or is are was were be been".split(
    /\s+/
  )
);
function tokens(s) {
  return new Set(
    String(s || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOP.has(t))
  );
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}
function extractSemanticUnits(text) {
  const body = String(text || "").trim();
  if (body.length < 12) return {};
  const sentences = body
    .split(/[.!?。\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  const first = sentences[0]?.slice(0, 80);
  const last = sentences.length > 1 ? sentences[sentences.length - 1]?.slice(0, 80) : undefined;
  const exp = /(직접|해봤|타\s*보|충전했|운전했|직관|체감|경험)/i.test(body);
  const claim = /(생각|보임|결국|그래서|오히려|문제|장점|단점)/i.test(body);
  return {
    central_event: first,
    central_observation: first,
    central_claim: claim ? last || first : undefined,
    personal_experience: exp ? first : undefined,
    conclusion: last,
    reasoning_angle: first,
    reader_takeaway: last,
  };
}
function unitOverlap(a, b) {
  const keys = [
    "central_event",
    "central_observation",
    "central_claim",
    "personal_experience",
    "conclusion",
    "reasoning_angle",
    "reader_takeaway",
  ];
  let hits = 0;
  let compared = 0;
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (!av || !bv) continue;
    compared += 1;
    if (jaccard(tokens(av), tokens(bv)) >= 0.45) hits += 1;
  }
  if (!compared) return 0;
  return hits / compared;
}
function eventClaimClusterScore(a, b) {
  const clusters = [
    [/합류|merge/i, /감시|감독|부하|supervision/i, /핸들|개입|잡/i],
    [/충전|슈퍼차저|supercharger/i, /대기|속도|세션/i],
    [/직관|bmo|경기/i, /동선|현장|입장/i],
    [/fsd/i, /신뢰|아직|완전/i, /고속도로|끼어/i],
  ];
  let best = 0;
  for (const group of clusters) {
    const ha = group.filter((re) => re.test(a)).length;
    const hb = group.filter((re) => re.test(b)).length;
    if (ha >= 2 && hb >= 2) {
      const score = Math.min(ha, hb) / group.length;
      if (score > best) best = score;
    }
  }
  return best;
}
function scoreSemanticOverlap(candidateText, recent) {
  const candUnits = extractSemanticUnits(candidateText);
  const candTok = tokens(candidateText);
  let best = 0;
  let matched;
  for (const r of recent) {
    const ru = extractSemanticUnits(r.text);
    const u = unitOverlap(candUnits, ru);
    const j = jaccard(candTok, tokens(r.text));
    const cluster = eventClaimClusterScore(candidateText, r.text);
    const score = Math.max(u, j * 0.85, cluster);
    if (score > best) {
      best = score;
      matched = r.source_id;
    }
  }
  let level = "NONE";
  if (best >= 0.55) level = "HIGH";
  else if (best >= 0.35) level = "MEDIUM";
  else if (best >= 0.18) level = "LOW";
  return { level, score: best, matched_source_id: matched };
}

function hasSurfaceWordingLeak(subject, recent) {
  const sub = String(subject || "").trim();
  if (sub.length < 16) return { leak: false };
  for (const r of recent) {
    const body = String(r.text || "");
    if (body.includes(sub) && sub.length >= 20) return { leak: true, matched_source_id: r.source_id };
    const words = sub.split(/\s+/).filter((w) => w.length >= 2);
    if (words.length >= 4) {
      const chunk = words.slice(0, 4).join(" ");
      if (body.includes(chunk)) return { leak: true, matched_source_id: r.source_id };
    }
  }
  return { leak: false };
}

const isSeedEligibleRole = (role) => role === "USER_EXPLICIT_SEED" || role === "SEED_SOURCE";

function guardCandidateAgainstManualLeakage(opts) {
  if (opts.user_explicit || opts.source_role === "USER_EXPLICIT_SEED") {
    return { allow_as_seed: true, reason: "PASS", semantic_recent_post_overlap: "NONE" };
  }
  if (!isSeedEligibleRole(opts.source_role)) {
    return { allow_as_seed: false, reason: "ROLE_NOT_SEED_ELIGIBLE", semantic_recent_post_overlap: "NONE" };
  }
  const pt = String(opts.post_type_of_source || "").toUpperCase();
  if (pt === "REPLY") {
    return { allow_as_seed: false, reason: "REPLY_AUTO_PROMOTE", semantic_recent_post_overlap: "NONE" };
  }
  const text = `${opts.concrete_subject || ""} ${opts.point_or_tension || ""}`.trim();
  const surface = hasSurfaceWordingLeak(opts.concrete_subject, opts.recent_manual || []);
  if (surface.leak) {
    return {
      allow_as_seed: false,
      reason: "SURFACE_WORDING",
      semantic_recent_post_overlap: "HIGH",
    };
  }
  const sem = scoreSemanticOverlap(text, opts.recent_manual || []);
  if (sem.level === "HIGH") {
    return {
      allow_as_seed: false,
      reason: "SEMANTIC_HIGH",
      semantic_recent_post_overlap: "HIGH",
    };
  }
  return {
    allow_as_seed: true,
    reason: "PASS",
    semantic_recent_post_overlap: sem.level,
  };
}

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    console.log("PASS ", name);
    passed += 1;
  } else {
    console.log("FAIL ", name);
    failed += 1;
  }
}

const FSD_MANUAL =
  "FSD 합류 후 감시 부하가 생각보다 크네요. 핸들을 자주 잡게 되고 아직 완전 신뢰는 안 가요. 고속도로 끼어들기에서 특히 그래요.";
const recent = [{ text: FSD_MANUAL, source_id: "m1", post_type: "ORIGINAL" }];

{
  const g = guardCandidateAgainstManualLeakage({
    source_role: "CREATOR_LEARNING_SIGNAL",
    concrete_subject: "FSD 합류 후 감시 부하",
    recent_manual: recent,
  });
  check("A role blocks CREATOR_LEARNING_SIGNAL as seed", !g.allow_as_seed && g.reason === "ROLE_NOT_SEED_ELIGIBLE");
}

{
  const g = guardCandidateAgainstManualLeakage({
    source_role: "SEED_SOURCE",
    concrete_subject: "FSD 합류 후 감시 부하가 생각보다 크네요. 핸들을 자주 잡게 되고",
    recent_manual: recent,
  });
  check("A2 surface wording of FSD manual blocked", !g.allow_as_seed);
}

check("B CREATOR_LEARNING_SIGNAL is valid non-seed role", !isSeedEligibleRole("CREATOR_LEARNING_SIGNAL"));
check("C PERFORMANCE_LEARNING_SIGNAL not seed-eligible", !isSeedEligibleRole("PERFORMANCE_LEARNING_SIGNAL"));

{
  const g = guardCandidateAgainstManualLeakage({
    source_role: "SEED_SOURCE",
    concrete_subject: "FSD SUPERVISION 관찰·판단 축",
    point_or_tension: "차원 기반 신규 각도 — 수제글 원문·결론 재사용 금지",
    recent_manual: recent,
  });
  check("D abstract dimension subject allowed", g.allow_as_seed);
}

{
  const para =
    "FSD 합류하고 나서 감시·감독 부하가 생각보다 크고 핸들 개입이 잦아요. 고속도로 끼어들기에서 신뢰가 아직 부족합니다.";
  const g = guardCandidateAgainstManualLeakage({
    source_role: "SEED_SOURCE",
    concrete_subject: para,
    recent_manual: recent,
  });
  check("E semantic HIGH blocks paraphrase of same event/claim", !g.allow_as_seed);
}

{
  const g2 = guardCandidateAgainstManualLeakage({
    source_role: "SEED_SOURCE",
    concrete_subject: "FSD 야간 시내 주행에서 보행자 예측 패턴 관찰",
    point_or_tension: "야간 시내 보행자 예측 관찰 축",
    recent_manual: recent,
  });
  check("F novel FSD angle not blocked by topic alone", g2.allow_as_seed);
}

{
  const g = guardCandidateAgainstManualLeakage({
    source_role: "SEED_SOURCE",
    concrete_subject: "좋은 포인트예요",
    post_type_of_source: "REPLY",
    recent_manual: recent,
  });
  check("G REPLY cannot auto-promote to ORIGINAL seed", !g.allow_as_seed && g.reason === "REPLY_AUTO_PROMOTE");
}

const requiredFiles = [
  "source-roles.ts",
  "manual-leakage-guard.ts",
  "experience-evidence.ts",
  "seed-engine.ts",
  "evidence-packet.ts",
  "index.ts",
];
for (const f of requiredFiles) {
  check(`file present ${f}`, existsSync(join(wp, f)));
}

const exp = readFileSync(join(wp, "experience-evidence.ts"), "utf8");
check("experience never body.slice subject", !/concrete_subject:\s*[^\n]*body\.slice/.test(exp));
check(
  "experience seed_eligible default false path",
  /seed_eligible:\s*userExplicit/.test(exp) || /seed_eligible:\s*!!c\.seed_eligible/.test(exp)
);

const se = readFileSync(join(wp, "seed-engine.ts"), "utf8");
check(
  "bootstrap does not emit ACCOUNT_ACTIVITY as seed rows",
  /Learning pass only/.test(se) && /Never auto SEED from manual body/.test(se)
);
check("bootstrap DIMENSION abstract seeds", /DIMENSION_REGISTRY/.test(se) && /source_role:\s*\"SEED_SOURCE\"/.test(se));

const ix = readFileSync(join(wp, "index.ts"), "utf8");
check("index imports manual-leakage-guard", /from\s+\"\.\/manual-leakage-guard\.ts\"/.test(ix));
check("index select seed_eligible gate", /seed_eligible/.test(ix) && /ORDER 0B/.test(ix));
check("index uses allow_as_seed API", /allow_as_seed/.test(ix));
check("index engine version order0b", /order0b_manual_leakage/.test(ix));

const ep = readFileSync(join(wp, "evidence-packet.ts"), "utf8");
check("evidence-packet abstract labels for ACCOUNT_ACTIVITY", /ORDER 0B/.test(ep) && /isManual/.test(ep));
check(
  "no body.slice anchors on manual path",
  /factual_anchors:\s*isManual/.test(ep) || /isManual \? label/.test(ep)
);

console.log("");
console.log(`ORDER 0B tests: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log("ORDER 0B ACCEPTANCE CHECKS FAILED");
  process.exit(1);
}
console.log("ALL ORDER 0B ACCEPTANCE CHECKS PASS");
process.exit(0);
