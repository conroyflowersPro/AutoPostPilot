/**
 * Planner decides 말투 per slot. No frozen mix percentage.
 */
import { planSlotSurface, type VoiceRegister } from "../supabase/functions/weekly-plan/user-direct-voice-window.ts";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log("  PASS ", name);
  } else {
    fail++;
    console.log("  FAIL ", name);
  }
}

const thin: VoiceRegister = {
  window_days: 60,
  n: 0,
  thin: true,
  median_chars: 0,
  ending_haeyo_rate: 0,
  ending_eumseum_rate: 0,
  ending_question_rate: 0,
  kk_rate: 0,
  question_ending_allowed: false,
  comparable_n: 0,
  comparable_entry_n: 0,
  notes: [],
};

console.log("Register planner (no frozen mix)");
const a = planSlotSurface({ voice: thin, slotIndex: 1, seedKey: "Terafab" });
const b = planSlotSurface({
  voice: thin,
  recentEndingCounts: { HAEYO: 4, EUMSEUM: 0, OTHER: 0 },
  lastEnding: "HAEYO",
  slotIndex: 5,
  seedKey: "a",
});
const c = planSlotSurface({
  voice: thin,
  recentEndingCounts: { HAEYO: 0, EUMSEUM: 4, OTHER: 0 },
  lastEnding: "EUMSEUM",
  slotIndex: 6,
  seedKey: "b",
});
ok("R1. empty batch still gets a planner ending", a.ending === "HAEYO" || a.ending === "EUMSEUM" || a.ending === "OTHER");
ok("R2. after many 해요, planner does not pick 해요", b.ending !== "HAEYO");
ok("R3. after many 음슴, planner does not pick 음슴", c.ending !== "EUMSEUM");
ok("R4. reason is planner, no frozen ratio", /planner chose this slot/.test(a.reason) && /No frozen/.test(a.reason));
ok("R5. constraint forbids mode lock and mix quota", /Editorial mode is not 말투/.test(a.constraint_line) && /not a quota/.test(a.constraint_line));

const mixed: VoiceRegister = { ...thin, n: 8, thin: false, ending_haeyo_rate: 0.9, ending_eumseum_rate: 0.05 };
const d = planSlotSurface({
  voice: mixed,
  recentEndingCounts: { HAEYO: 1 },
  lastEnding: "HAEYO",
  slotIndex: 2,
  seedKey: "c",
});
ok("R6. after a 해요 post, next is not 해요 even if handmade is 해요-heavy", d.ending !== "HAEYO");
ok("R7. handmade 90% 해요 does not become a quota", d.ending !== "HAEYO");

console.log("========================================");
console.log(`REGISTER PLANNER: ${pass} PASS / ${fail} FAIL`);
if (fail) Deno.exit(1);
