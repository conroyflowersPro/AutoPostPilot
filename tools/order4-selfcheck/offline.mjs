import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const gp = path.join(root, "supabase/functions/generate-post");

const index = fs.readFileSync(path.join(gp, "index.ts"), "utf8");
const data = fs.readFileSync(path.join(gp, "creator-style-data.ts"), "utf8");
const vocab = fs.readFileSync(path.join(gp, "vocabulary-fidelity.ts"), "utf8");

assert.ok(!index.includes("const CREATOR_DNA_VOICE"));
assert.ok(index.includes("getCreatorDnaVoice"));
assert.ok(data.includes("getCreatorStyle"));
assert.ok(index.includes("slotById"));
assert.ok(index.includes("CREATOR_GENERATION_EXTERNAL_MODEL_REQUIRED"));
assert.ok(index.includes("dry_run_no_generation"));
assert.ok(vocab.includes("getStyleBaseline") || vocab.includes("length_distance"));
assert.ok(!/const CREATOR_DNA_VOICE = `CREATOR DNA[\s\S]*Cybertruck/.test(index));
console.log("ALL ORDER4 OFFLINE CHECKS PASSED xAI_API_USED=NO (offline)");
