#!/usr/bin/env node
/**
 * Operator–agent collaboration contract must exist for the next Cursor agent,
 * and must never leak into Writer / Planner post prompts.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const collab = read("lib/intelligence/operator-collaboration.ts");
const agents = read("AGENTS.md");
const protocol = read("architecture/GROK_DEVELOPMENT_INTENT_PROTOCOL.md");
const dir = read("architecture/v11.0.0_PRODUCT_DIRECTION.md");
const wr = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const pipe = read("supabase/functions/weekly-plan/order-write-pipeline.ts");
const quota = read("supabase/functions/weekly-plan/quota-inference.ts");
const seed = read("supabase/functions/weekly-plan/creator-seed-reasoning.ts");
const dna = read("supabase/functions/weekly-plan/engine-dna.ts");
const ver = read("lib/version.ts");
const ix = read("supabase/functions/weekly-plan/index.ts");

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

console.log("Operator collaboration contract (v11.12.8)");

ok("C1. version lock", /operator-collaboration-v1\.1/.test(collab));
ok(
  "C2. tool not substitute thinker",
  /Not a being that thinks instead of the operator/.test(collab) &&
    /사고를 대신/.test(agents)
);
ok(
  "C3. operator owns purpose and final decision",
  /operator holds purpose and final decision/.test(collab) &&
    /목적과 최종 결정/.test(agents)
);
ok(
  "C4. forbidden: unrequested goals / silent redesign / agent-convenient flow",
  /Do not add unrequested goals/.test(collab) &&
    /Do not change orders, design, or plans without consent/.test(collab) &&
    /Do not redefine the work flow/.test(collab) &&
    /요청하지 않은 목표/.test(agents) &&
    /작업 흐름/.test(agents)
);
ok(
  "C5. clear execute; ambiguous wait; object to error; no pretend",
  /If the instruction is clear, execute it as given/.test(collab) &&
    /wait for consent/.test(collab) &&
    /do not simply agree/.test(collab) &&
    /Do not pretend capability/.test(collab) &&
    /지시가 명확/.test(agents) &&
    /맞장구/.test(agents) &&
    /근거/.test(agents) &&
    /가능한 척/.test(agents)
);
ok(
  "C6. consent words; 진행 is not consent",
  /반영해/.test(collab) &&
    /넣어/.test(collab) &&
    /이대로/.test(collab) &&
    /진행/.test(collab) &&
    /반영해/.test(agents) &&
    /진행/.test(agents)
);
ok(
  "C7. judgment is for operator time/effort/errors",
  /not to make the agent comfortable/.test(collab) &&
    /편하게/.test(agents)
);
ok(
  "C8. product direction names the contract",
  /Operator–agent collaboration/.test(dir) &&
    /operator-collaboration-v1\.1/.test(dir) &&
    /AGENTS.md/.test(dir) &&
    /GROK_DEVELOPMENT_INTENT_PROTOCOL/.test(dir)
);
ok(
  "C9. NOT injected into Grok writer",
  !/operatorCollaborationBlock/.test(wr) &&
    !/operator-collaboration/.test(wr) &&
    !/OPERATOR COLLABORATION/.test(wr) &&
    !/thinks instead of the operator/.test(wr)
);
ok(
  "C10. NOT injected into Grok quota or seed",
  !/operatorCollaborationBlock/.test(quota) &&
    !/operator-collaboration/.test(quota) &&
    !/operatorCollaborationBlock/.test(seed) &&
    !/operator-collaboration/.test(seed)
);
ok(
  "C11. Creator DNA is still see/think/express, not this chat contract",
  /PURPOSE: Preserve how this person sees/.test(dna) &&
    !/operator-collaboration-v1/.test(dna)
);
ok(
  "C12. shipping 11.12.8",
  /APP_VERSION = "11.12.8"/.test(ver) && /APP_VERSION = "11.12.8"/.test(ix)
);
ok(
  "C13. AGENTS.md forbids leaking into post prompts",
  /post prompt/.test(agents) && /Writer/.test(agents)
);
ok(
  "C14. Korean is the operator language",
  /Talk with Seung in \*\*Korean\*\*/.test(agents)
);
ok("C15. deploy only on 배포해", /배포해/.test(agents));
ok(
  "C16. standing intent protocol is encoded, not v11-only",
  /Do not code the user's words\. Build the user's intent/.test(protocol) &&
    /v11 전용이 아니다/.test(protocol) &&
    /Do not code the user's words\. Build the user's intent/.test(agents) &&
    /Development Intent Protocol/.test(agents) &&
    /COLLAB_BUILD_INTENT/.test(collab)
);
ok(
  "C17. intent protocol is NOT injected into Writer / Grok quota / seed",
  !/Build the user's intent/.test(wr) &&
    !/GROK_DEVELOPMENT_INTENT_PROTOCOL/.test(wr) &&
    !/Build the user's intent/.test(quota) &&
    !/Build the user's intent/.test(seed)
);
ok(
  "C18. thought first, style follows — docs and writeOneSlot runtime",
  /Thought first, style follows/.test(protocol) &&
    /Thought first, style follows/.test(agents) &&
    /COLLAB_THOUGHT_FIRST/.test(collab) &&
    !/Thought first, style follows/.test(wr) &&
    /THOUGHT_FIRST_RUNTIME/.test(pipe) &&
    /selectDeliveryAfterThought/.test(pipe)
);

console.log("========================================");
console.log(`COLLAB: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
