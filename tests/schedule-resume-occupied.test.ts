import assert from "node:assert/strict";
import {
  PERSONAL_CLOCK_HOURS,
  PERSONAL_POSTS_PER_DAY,
  buildDaySpreadSlots,
  laWallTimeToISO,
  nextForYouSlotAfterOccupied,
  nextPersonalClockOnOrAfter,
} from "../lib/schedule.ts";

function ptHour(iso: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => p.find((x) => x.type === t)?.value || "0";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  return { day: parseInt(get("day"), 10), hour, minute: parseInt(get("minute"), 10) };
}

const y = 2026;
const m = 8;
const d = 17;
const start = laWallTimeToISO(y, m, d, 11, 0);
const occupied = [
  laWallTimeToISO(y, m, d, 11, 0),
  laWallTimeToISO(y, m, d, 15, 0),
];

assert.deepEqual([...PERSONAL_CLOCK_HOURS], [11, 15, 19]);
assert.equal(PERSONAL_POSTS_PER_DAY, 3);

const resume = nextForYouSlotAfterOccupied(start, occupied);
const r = ptHour(resume);
assert.equal(r.hour, 19, `resume should be 19:00 PT, got ${resume}`);
assert.equal(r.minute, 0);

const resumeAfterNineteen = nextForYouSlotAfterOccupied(
  start,
  [...occupied, laWallTimeToISO(y, m, d, 19, 0)],
);
const after19 = ptHour(resumeAfterNineteen);
assert.equal(after19.day, 18);
assert.equal(after19.hour, 11, "after 19:00, next day's 11:00 — never 20/21/22");

const nextDayStart = laWallTimeToISO(y, m, d + 1, 11, 0);
const resumeNextDay = nextForYouSlotAfterOccupied(nextDayStart, occupied);
const n = ptHour(resumeNextDay);
assert.equal(n.day, 18);
assert.equal(n.hour, 11);

const holes = nextForYouSlotAfterOccupied(start, [laWallTimeToISO(y, m, d, 15, 0)]);
const h = ptHour(holes);
assert.equal(h.hour, 19, "do not fill 11:00 when 15:00 is already booked");

const leftoverTwoHour = nextForYouSlotAfterOccupied(start, [
  laWallTimeToISO(y, m, d, 14, 0),
  laWallTimeToISO(y, m, d, 16, 0),
  laWallTimeToISO(y, m, d, 18, 0),
]);
const leftover = ptHour(leftoverTwoHour);
assert.equal(leftover.day, 18);
assert.equal(leftover.hour, 11, "do not pack 20/21/22 after leftover 14/16/18");

const afterTwenty = ptHour(nextPersonalClockOnOrAfter(laWallTimeToISO(y, m, d, 20, 0)));
assert.equal(afterTwenty.day, 18);
assert.equal(afterTwenty.hour, 11);

const slots = buildDaySpreadSlots(resume, 3, 3);
assert.equal(slots.length, 3);
assert.equal(ptHour(slots[0]).hour, 19);
assert.equal(ptHour(slots[1]).hour, 11, "roll to next day 11:00 — do not pack 20/21/22");
assert.equal(ptHour(slots[2]).hour, 15);
assert.notEqual(ptHour(slots[1]).day, ptHour(slots[0]).day);

const packed = buildDaySpreadSlots(start, 3, 5).map((iso) => ptHour(iso).hour);
assert.deepEqual(packed, [11, 15, 19]);
assert.ok(!packed.some((hour) => [14, 16, 18, 20, 22].includes(hour)));

const six = buildDaySpreadSlots(start, 6, 5);
assert.equal(six.length, 6);
assert.deepEqual(six.map((iso) => ptHour(iso).hour), [11, 15, 19, 11, 15, 19]);
assert.notEqual(ptHour(six[3]).day, ptHour(six[0]).day);
assert.ok(!six.map((iso) => ptHour(iso).hour).some((hour) => [14, 16, 18, 20, 21, 22].includes(hour)));

console.log("schedule-resume-occupied ok", { resume, resumeNextDay, holes, leftoverTwoHour, slots });
