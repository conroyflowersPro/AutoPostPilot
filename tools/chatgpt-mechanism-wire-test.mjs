#!/usr/bin/env node
/**
 * Grok writer may consume the selected reaction mechanism as optional delivery.
 * Mass everyday seeds still get a reader-entry move — personality is the closed thought, not a slogan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const wr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/independent-post-generation.ts"), "utf8");
const dgc = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/deep-generation-context.ts"), "utf8");
const rsp = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/reader-self-projection.ts"), "utf8");
const pipe = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8");
const se = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-interpretation.ts"), "utf8");

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

function hasMeaningful(s) {
  const t = String(s || "").trim();
  if (!t || /^(none|low|n\/a|null)$/i.test(t)) return false;
  return t.length >= 4;
}

function isEverydayPublicScene(text) {
  return /알림|화면|주차|구독|수수료|요금|날씨|외출|길찾기|와이퍼|대기|줄|시간|돈|습관|불편|선택|사람|휴대폰|번역|초안|요약|음성|드라이브|연석|업데이트|레이어/.test(
    String(text || ""),
  );
}

console.log("Grok writer mechanism wiring");
ok("M1. writer exports mechanism constraint helper", /export function writerMechanismConstraintLines/.test(wr));
ok("M2. mechanism helper does not pick the thought", /writerMechanismConstraintLines/.test(wr) && /Not injected into the live writer prompt/.test(wr) && /NONE is normal/.test(wr));
ok("M3. live user message does not inject mechanism lines", /callGrokWriter/.test(wr) && !/\.\.\.writerMechanismConstraintLines/.test(wr));
ok("M4. deep context reads selected_mechanism string", /typeof mech\.selected_mechanism === "string"/.test(dgc) && /getMechanismById/.test(dgc));
ok("M5. deep context copies reader_entry_point", /reader_entry_point: s\(mech\.reader_entry_point/.test(dgc));
ok("M6. NONE string is not treated as human text", /none\|low/.test(rsp) && /hasText/.test(rsp));
ok("M7. everyday public fallback is not a cluster switch", /everyday_public_reader_entry/.test(rsp) && !/switch\s*\(\s*(topic|cluster|keyword)/i.test(rsp));
ok("M8. no FSD→mechanism table", !/FSD\s*[=:].*M[0-9]/.test(rsp));
ok("M9. parking seed is everyday public", isEverydayPublicScene("빨간 연석 옆 길가 주차"));
ok("M10. stacked alerts are everyday public", isEverydayPublicScene("휴대폰 알림이 겹쳐 어느 레이어가 위인지"));
ok("M11. abstract ticker is not everyday public", !isEverydayPublicScene("macro liquidity outlook"));
ok("M12. NONE is not meaningful human text", !hasMeaningful("NONE") && hasMeaningful("daily time / effort / choice friction"));
ok("M13. write batch anti-repeats mechanisms", /recentMechanismUsage/.test(pipe) && /recent\.push/.test(pipe));
ok("M14. human element sees 알림/주차/구독", /알림\|화면\|주차\|구독/.test(se));
ok("M15. writer still forbids naming mechanism in the post", /never name the mechanism/i.test(wr) && /M1–M9/.test(wr));

console.log("========================================");
console.log(`MECHANISM WIRE: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
