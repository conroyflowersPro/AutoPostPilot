#!/usr/bin/env node
import fs from "fs";
import zlib from "zlib";
import crypto from "crypto";
const b64 = fs.readFileSync("tools/order8c-index.gz.b64", "utf8").trim();
const gz = Buffer.from(b64, "base64");
const buf = zlib.gunzipSync(gz);
const out = "supabase/functions/weekly-plan/index.ts";
fs.writeFileSync(out, buf);
const sha = crypto.createHash("sha256").update(buf).digest("hex");
console.log("WROTE", out, "bytes", buf.length, "sha256", sha);
const text = buf.toString("utf8");
const ok = text.includes("ORDER8C_VERSION") && text.includes("order8c_gate") && text.includes("10.0.0-order8c-weekly-count-qa") && text.includes("phased_v10_order8c_weekly_count_qa");
if (!ok) {
  console.error("MARKERS_MISSING");
  process.exit(3);
}
console.log("MARKERS_OK");
