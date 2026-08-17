import assert from "node:assert/strict";
import {
  buildDaySpreadSlots,
  laWallTimeToISO,
  nextForYouSlotAfterOccupied,
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
const start = laWallTimeToISO(y, m, d, 14, 0);
const occupied = [
  laWallTimeToISO(y, m, d, 14, 0),
  laWallTimeToISO(y, m, d, 16, 0),
  laWallTimeToISO(y, m, d, 18, 0),
];

const resume = nextForYouSlotAfterOccupied(start, occupied);
const r = ptHour(resume);
assert.equal(r.hour, 20, `resume should be 20:00 PT, got ${resume}`);
assert.equal(r.minute, 0);

const nextDayStart = laWallTimeToISO(y, m, d + 1, 14, 0);
const resumeNextDay = nextForYouSlotAfterOccupied(nextDayStart, occupied);
const n = ptHour(resumeNextDay);
assert.equal(n.day, 18);
assert.equal(n.hour, 14);

const holes = nextForYouSlotAfterOccupied(start, [laWallTimeToISO(y, m, d, 18, 0)]);
const h = ptHour(holes);
assert.equal(h.hour, 20, "do not fill 14:00 when 18:00 is already booked");

const slots = buildDaySpreadSlots(resume, 3, 5);
assert.equal(slots.length, 3);
assert.equal(ptHour(slots[0]).hour, 20);
assert.equal(ptHour(slots[1]).hour, 22, "X For You keeps ~2h; do not pack 20/21/22");
assert.equal(ptHour(slots[2]).hour, 14);

const packed = buildDaySpreadSlots(start, 5, 5).map((iso) => ptHour(iso).hour);
assert.deepEqual(packed, [14, 16, 18, 20, 22]);

const sixth = buildDaySpreadSlots(start, 6, 5);
assert.equal(ptHour(sixth[5]).hour, 14);
assert.notEqual(ptHour(sixth[5]).day, ptHour(sixth[0]).day);

console.log("schedule-resume-occupied ok", { resume, resumeNextDay, holes, slots });
