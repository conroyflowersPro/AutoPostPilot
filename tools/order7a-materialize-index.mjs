#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const parts = readdirSync("tools").filter(f => f.startsWith("order7a-index.gz.b64.p")).sort();
let b64 = "";
for (const p of parts) b64 += readFileSync("tools/"+p, "utf8").trim();
const buf = gunzipSync(Buffer.from(b64, "base64"));
const text = buf.toString("utf8");
if (!text.includes("buildDeepGenerationContext") || !text.includes("order7a_deep_generation")) {
  console.error("materialize validation failed");
  process.exit(1);
}
writeFileSync("supabase/functions/weekly-plan/index.ts", text);
console.log("wrote index", text.length, createHash("sha256").update(text).digest("hex"));
