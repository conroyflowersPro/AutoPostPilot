#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const slots = read("supabase/functions/weekly-plan/creator-week-slots.ts");
const dna = read("supabase/functions/weekly-plan/engine-dna.ts");
const wr = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const ver = read("lib/version.ts");
const ix = read("supabase/functions/weekly-plan/index.ts");
const pkg = read("package.json");

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

const REACH_PER_DAY_MAX = 2;
function enforceReachDailyCap(list) {
  const byDay = new Map();
  for (const slot of list) {
    const day = Number(slot.day_offset);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(slot);
  }
  for (const daySlots of byDay.values()) {
    const reachAt = [];
    for (let i = 0; i < daySlots.length; i += 1) {
      if (String(daySlots[i].strategic_role || "").toUpperCase() === "REACH") reachAt.push(i);
    }
    while (reachAt.length > REACH_PER_DAY_MAX) {
      const idx = reachAt.pop();
      daySlots[idx].strategic_role = "RETURN";
    }
    if (reachAt.length === 0 && daySlots.length) {
      let pick = daySlots.findIndex((slot) => String(slot.editorial_mode || "").toUpperCase() !== "EXPERIENCE");
      if (pick < 0) pick = daySlots.length - 1;
      daySlots[pick].strategic_role = "REACH";
    }
  }
  return list;
}

console.log("REACH daily cap + Writer DNA slice (v12.5.3)");

ok("R1. parser constants 1 and max 2",
  /REACH_PER_DAY_TARGET = 1/.test(slots) && /REACH_PER_DAY_MAX = 2/.test(slots) && /enforceReachDailyCap/.test(slots));
ok("R2. PRESENCE is not a growth_role",
  /value === "PRESENCE"/.test(slots) && /never an AP growth_role/.test(dna) && /REACH is not PRESENCE/.test(dna));
ok("R3. extra REACH capped at 2", (() => {
  const day = [
    { day_offset: 0, strategic_role: "REACH", editorial_mode: "CASUAL_OBSERVATION" },
    { day_offset: 0, strategic_role: "REACH", editorial_mode: "INFORMATIVE" },
    { day_offset: 0, strategic_role: "REACH", editorial_mode: "OPINION" },
    { day_offset: 0, strategic_role: "RETURN", editorial_mode: "EXPERIENCE" },
  ];
  enforceReachDailyCap(day);
  return day.filter((s) => s.strategic_role === "REACH").length === 2;
})());
ok("R4. missing REACH fills one non-EXPERIENCE", (() => {
  const day = [
    { day_offset: 1, strategic_role: "RETURN", editorial_mode: "EXPERIENCE" },
    { day_offset: 1, strategic_role: "BRIDGE", editorial_mode: "INFORMATIVE" },
  ];
  enforceReachDailyCap(day);
  return day[1].strategic_role === "REACH" && day[0].strategic_role === "RETURN";
})());
ok("R5. Writer uses slice not full DNA block",
  /creatorDnaWriterSlice\(s\(planner\.strategic_role\)\)/.test(wr) && !/creatorDnaBlock\(\)/.test(wr));
ok("R6. Writer slice has always-forbids and Tesla only if seed", (() => {
  const start = dna.indexOf("export function creatorDnaWriterSlice");
  const next = dna.indexOf("\nexport function", start + 1);
  const sliceFn = dna.slice(start, next > start ? next : undefined);
  return /ALWAYS FORBIDDEN/.test(sliceFn) &&
    /End without closing the observation/.test(dna) &&
    /Tesla\/FSD appears only if this seed is that situation/.test(sliceFn) &&
    !/SEED INTEREST: Tesla\/FSD/.test(sliceFn);
})());
ok("R7. Slot DNA keeps Tesla as seed interest only",
  /SEED INTEREST: Tesla\/FSD/.test(dna) && /Do not force EXPERIENCE share/.test(dna));
ok("R8. version 12.5.3",
  /"version": "12.5.3"/.test(pkg) && /APP_VERSION = "12.5.3"/.test(ver) && /APP_VERSION = "12.5.3"/.test(ix));

console.log("========================================");
console.log(`REACH + WRITER SLICE: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
