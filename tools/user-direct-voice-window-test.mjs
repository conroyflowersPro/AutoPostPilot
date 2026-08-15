#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
const VOICE = path.join(ROOT, "supabase/functions/weekly-plan/user-direct-voice-window.ts");
const INDEX = path.join(ROOT, "supabase/functions/weekly-plan/index.ts");
const PIPE = path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts");
const WRITER = path.join(ROOT, "supabase/functions/weekly-plan/independent-post-generation.ts");
let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  PASS ", name); }
  else { fail++; console.log("  FAIL ", name); }
}
const voice = readFileSync(VOICE, "utf8");
const index = readFileSync(INDEX, "utf8");
const pipe = readFileSync(PIPE, "utf8");
const writer = readFileSync(WRITER, "utf8");
console.log("USER_DIRECT voice window wiring");
ok("V1. module exists", voice.includes("buildUserDirectVoiceWindow"));
ok("V2. no archive fallback", !/creator-style-data/.test(voice) && !/6950/.test(voice));
ok("V3. AP excluded", /AP_PIPELINE/.test(voice));
ok("V4. 30 then 60", /window_days: 30/.test(voice) && /window_days: 60/.test(voice));
ok("V5. stats not examples", /no sample posts/.test(voice));
ok("V6. write phase loads 60d activities", /voiceSince/.test(index) && /voiceRows/.test(index));
ok("V7. pipeline infers slot voice", /inferSlotVoice/.test(pipe) && /voice_register: voicePayload/.test(pipe));
ok("V8. writer consumes register", /voice_register\?\.constraint_line/.test(writer));
ok("V9. question only from USER_DIRECT stats, never allowed on AP drafts", /question_ending_allowed = false/.test(voice));
ok("V10. planner decides surface, not a mode 해요 table", /planSlotSurface/.test(voice) && /No frozen 해요\/음슴 mix ratio/.test(voice) && !/POST CHARACTER: information\/compare/.test(voice));
ok("V11. pipeline does not lock 해요/음슴 before the thought", !/planSlotSurface/.test(pipe) && /voiceRegisterConstraintLine\(voice\)/.test(pipe) && !/thin \? 0\.4/.test(voice));
console.log("========================================");
console.log(`VOICE WINDOW: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
