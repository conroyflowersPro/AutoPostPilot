#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();

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

const {
  coverageFromWindow,
  dateInInclusiveWindow,
  eachInclusiveDate,
  formatKoRange,
} = await import("./calendar-analytics-coverage-lib.mjs");

console.log("Calendar Analytics coverage");

const fixture = coverageFromWindow({
  window: { from: "2026-07-19", to: "2026-08-15" },
  imported_at: "2026-08-16",
  volume: { originals: 3 },
  posts: [
    { published_at: "2026-08-15T00:00:00.000Z", features: { is_original: true } },
    { published_at: "2026-08-15T00:00:00.000Z", features: { is_original: true } },
    { published_at: "2026-08-14T00:00:00.000Z", features: { isReply: true } },
    { published_at: "2026-08-14T00:00:00.000Z", features: { is_original: true } },
  ],
});

ok("C1. window dates", fixture.from === "2026-07-19" && fixture.to === "2026-08-15");
ok("C2. replies excluded", fixture.originalsByDate["2026-08-14"] === 1 && fixture.originalsByDate["2026-08-15"] === 2);
ok("C3. Aug 16 is outside window", dateInInclusiveWindow("2026-08-16", fixture.from, fixture.to) === false);
ok("C4. Aug 15 is inside window", dateInInclusiveWindow("2026-08-15", fixture.from, fixture.to) === true);
ok("C5. Korean range", formatKoRange(fixture.from, fixture.to) === "7월 19일–8월 15일");
ok("C6. inclusive day count", eachInclusiveDate(fixture.from, fixture.to).length === 28);

const bundled = JSON.parse(
  readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/x-analytics-30d-window.json"), "utf8"),
);
const live = coverageFromWindow(bundled);
ok("C7. bundled window 7/19–8/15", live.from === "2026-07-19" && live.to === "2026-08-15");
ok("C8. bundled originals 201", live.originals === 201);
ok("C9. bundled has Aug 15 originals", (live.originalsByDate["2026-08-15"] || 0) > 0);
ok("C10. bundled has no Aug 16 originals", !live.originalsByDate["2026-08-16"]);

const page = readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const cal = readFileSync(path.join(ROOT, "app/components/QueueMonthCalendar.tsx"), "utf8");
ok("C11. home passes analytics prop", /analytics=\{analytics\}/.test(page));
ok("C12. calendar label Analytics", /Analytics \{analyticsN\}/.test(cal));
const src = readFileSync(path.join(ROOT, "lib/calendar/analytics-coverage.ts"), "utf8");
ok("C13. TS coverage module exists", /export function coverageFromWindow/.test(src) && /export function dateInInclusiveWindow/.test(src));

console.log("========================================");
console.log(`ANALYTICS CAL: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
