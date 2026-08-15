/**
 * 말투 is inferred. Editorial mode is not a 해요 table.
 * 3-day batch must not collapse to one ending.
 */
import { inferSlotSurface, type VoiceRegister } from "../supabase/functions/weekly-plan/user-direct-voice-window.ts";

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

console.log("Register inference (no mode table)");
const a = inferSlotSurface({ voice: thin, slotIndex: 1 });
const b = inferSlotSurface({
  voice: thin,
  recentEndingCounts: { HAEYO: 4, EUMSEUM: 0, OTHER: 0 },
  lastEnding: "HAEYO",
  slotIndex: 5,
});
const c = inferSlotSurface({
  voice: thin,
  recentEndingCounts: { HAEYO: 0, EUMSEUM: 4, OTHER: 0 },
  lastEnding: "EUMSEUM",
  slotIndex: 6,
});
ok("R1. thin window still infers an ending", a.ending === "HAEYO" || a.ending === "EUMSEUM" || a.ending === "OTHER");
ok("R2. 해요 collapse picks something else", b.ending !== "HAEYO");
ok("R3. 음슴 collapse picks something else", c.ending !== "EUMSEUM");
ok("R4. reason is not editorial-mode table", /not an editorial-mode table|anti-collapse/.test(a.reason + b.reason));
ok("R5. constraint forbids mode lock", /Editorial mode is not 말투/.test(a.constraint_line));

const mixed: VoiceRegister = { ...thin, n: 8, thin: false, ending_haeyo_rate: 0.5, ending_eumseum_rate: 0.2 };
const d = inferSlotSurface({
  voice: mixed,
  recentEndingCounts: { HAEYO: 1 },
  lastEnding: "HAEYO",
  slotIndex: 2,
});
ok("R6. after a 해요 post, next is not 해요", d.ending !== "HAEYO");

console.log("========================================");
console.log(`REGISTER INFERENCE: ${pass} PASS / ${fail} FAIL`);
if (fail) Deno.exit(1);
