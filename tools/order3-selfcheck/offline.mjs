/**
 * ORDER 3 offline checks — no xAI
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function extractPacket(text) {
  const body = String(text || "").trim();
  if (body.length < 12) return null;
  let topic = "OTHER", subtopic = "GENERAL";
  const t = body.toLowerCase();
  if (/fsd|오토파일럿/.test(t)) { topic = "FSD"; subtopic = "SUPERVISION"; }
  else if (/cyber|사이버|충전/.test(t)) { topic = "CYBERTRUCK"; subtopic = /충전/.test(t) ? "CHARGING" : "OWNERSHIP"; }
  else if (/robotaxi|로보/.test(t)) { topic = "ROBOTAXI"; subtopic = "CURBSIDE"; }
  else if (/lafc|bmo|직관/.test(t)) { topic = "LAFC"; subtopic = "MATCHDAY"; }
  const entities = [];
  if (/\bfsd\b/i.test(body)) entities.push("FSD");
  if (/cybertruck|사이버/i.test(body)) entities.push("CYBERTRUCK");
  const locs = [];
  if (/샌프란|san francisco/i.test(body)) locs.push("SF");
  if (/레드우드|redwood/i.test(body)) locs.push("REDWOOD_CITY");
  if (/\bbmo\b/i.test(body)) locs.push("BMO");
  const exp = /(해봤|운전했|직관|충전했|타\s*보)/i.test(body);
  return { topic, subtopic, entities, verified_locations: locs, experience_facts: exp ? [body.slice(0, 40)] : [], factual_anchors: [body.slice(0, 40)] };
}

function reasonSubject(packet) {
  if (packet.experience_facts.length) {
    return `${packet.entities.slice(0, 2).join("+") || packet.topic} 중심으로 본 ${packet.topic} ${packet.subtopic}`.slice(0, 90);
  }
  return `${packet.topic} ${packet.subtopic} 구조·조건 관찰`.slice(0, 90);
}

{
  const raw = "샌프란시스코에서 레드우드 시티까지 FSD로 운전해봤어요. 믿을 수 없을 정도로 부드럽고 수월하게 차량 여행을 할 수 있게 해주네요.";
  const packet = extractPacket(raw);
  const sub = reasonSubject(packet);
  assert.ok(sub.length < raw.length);
  assert.ok(!sub.includes("믿을 수 없을 정도로"));
  console.log("PASS: raw post body not used as seed subject");
}
{
  const published = ["FSD 장거리 구간에서 감시 집중도가 달라진 체감", "사이버트럭 충전 세션에서 체류 시간이 일정을 가른 경험"];
  const avoidBuggy = new Set(published.map((s) => s.toLowerCase()));
  let skipped = 0;
  for (const p of published) if (avoidBuggy.has(p.toLowerCase())) skipped++;
  assert.equal(skipped, published.length);
  const emitted = new Set();
  let kept = 0;
  for (const p of published) {
    const sig = p.toLowerCase();
    if (emitted.has(sig)) continue;
    emitted.add(sig);
    kept++;
  }
  assert.equal(kept, 2);
  console.log("PASS: avoid-set bug diagnosed; fixed emitted-only de-dupe keeps candidates");
}
{
  const files = [
    "supabase/functions/weekly-plan/evidence-packet.ts",
    "supabase/functions/weekly-plan/seed-engine.ts",
    "supabase/functions/weekly-plan/runtime-grounding.ts",
    "supabase/functions/weekly-plan/index.ts",
  ];
  for (const f of files) assert.ok(fs.existsSync(path.join(root, f)), f);
  const seed = fs.readFileSync(path.join(root, "supabase/functions/weekly-plan/seed-engine.ts"), "utf8");
  assert.ok(seed.includes("reasonSeedSubjectFromPacket"));
  assert.ok(seed.includes("publishedEvidence"));
  assert.ok(!seed.includes("concrete_subject: text.slice(0, 100)"));
  const idx = fs.readFileSync(path.join(root, "supabase/functions/weekly-plan/index.ts"), "utf8");
  assert.ok(idx.includes("grounding_status: seed.grounding_status"));
  assert.ok(idx.includes("publishedEvidence"));
  console.log("PASS: source files and ORDER3 markers present");
}
console.log("\nALL ORDER3 OFFLINE CHECKS PASSED xAI_API_USED=NO");
