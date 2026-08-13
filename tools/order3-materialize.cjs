const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const PARTS = path.join(ROOT, "tools/order3-parts");
const TARGET = path.join(ROOT, "supabase/functions/weekly-plan/index.ts");
const EXPECT_SHA = "81d21cb69e37f032e1609fd5ce093c11a33d3b79ce5631fd1059e8d0bb026677";
const EXPECT_SIZE = 33159;
const files = fs.readdirSync(PARTS).filter(f => f.startsWith("index.ts.p") && f.endsWith(".b64")).sort();
if (!files.length) throw new Error("no parts");
let b64 = "";
for (const f of files) b64 += fs.readFileSync(path.join(PARTS, f), "utf8").trim();
const buf = zlib.gunzipSync(Buffer.from(b64, "base64"));
const sha = crypto.createHash("sha256").update(buf).digest("hex");
if (buf.length !== EXPECT_SIZE || sha !== EXPECT_SHA) {
  console.error("MISMATCH", buf.length, sha, "expected", EXPECT_SIZE, EXPECT_SHA);
  process.exit(1);
}
const text = buf.toString("utf8");
const required = [
  "selectThinkingRail",
  "phased_v10_order3_thinking_rail",
  "10.0.0-order3",
  "guardCandidateAgainstManualLeakage",
  "interpretSeed",
  "selectReactionMechanism",
  "phase === \"expand\"",
  "phase === \"select\"",
  "thinking_rail,",
  "rail_ok",
  "ORDER3_VERSION",
];
for (const r of required) {
  if (!text.includes(r)) {
    console.error("MISSING marker:", r);
    process.exit(1);
  }
}
fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, buf);
console.log("MATERIALIZED", TARGET, buf.length, sha);
