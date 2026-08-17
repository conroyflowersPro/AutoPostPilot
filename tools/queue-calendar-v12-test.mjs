#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const inscribe = read("lib/calendar/planner-inscribe.ts");
const sync = read("lib/x/sync.ts");
const evidence = read("lib/x/evidence.ts");
const page = read("app/page.tsx");
const list = read("app/components/PostList.tsx");
const cal = read("app/components/QueueMonthCalendar.tsx");
const ver = read("lib/version.ts");
const ix = read("supabase/functions/weekly-plan/index.ts");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass += 1;
    console.log("  PASS ", name);
  } else {
    fail += 1;
    console.log("  FAIL ", name);
  }
}

console.log("Queue status calendar (v12)");

ok("Q1. Planner inscription has no Grok", /Does not plan slots/.test(inscribe) && !/api\.x\.ai/.test(inscribe));
ok("Q2. zero kinds omitted", /counts\[k\] > 0/.test(inscribe));
ok("Q3. AP vs handmade classifier", /export function classifyXPostOrigin/.test(inscribe) && /AP_PIPELINE/.test(inscribe));
ok("Q4. sync button classifies origin", /classifyXPostOrigin\(p\.id/.test(sync) && /loadApOriginHints/.test(sync));
ok("Q5. sync is not all USER_DIRECT", !/systemOriginClass: "USER_DIRECT"/.test(sync));
ok("Q6. evidence uses this sync's origin", /system_origin_class: keptOrigin/.test(evidence) === false);
ok("Q7. queue shows 계획 and 예약 times", /function queueWhen/.test(list) && /kind: "예약"/.test(list) && /kind: "계획"/.test(list) && /시각 없음/.test(list));
ok("Q8. queue still lists all written posts", /select\("\*"\)/.test(page) && /작성된 글 전체/.test(page));
ok("Q9. month calendar on queue home", /QueueMonthCalendar/.test(page) && /수제/.test(cal) && /재게시/.test(cal) && /예약/.test(cal));
ok("Q10. login does not sync X", !/runXAccountSync/.test(page) && /href="\/api\/x\/sync"/.test(page));
ok("Q11. shipping 12.5.1", /APP_VERSION = "12.5.1"/.test(ver) && /APP_VERSION = "12.5.1"/.test(ix));
ok("Q12. booked schedule days merged into month calendar", /mergeBookedScheduleDays/.test(inscribe) && /booked: "예약"/.test(inscribe));

console.log("========================================");
console.log(`QUEUE CALENDAR: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
