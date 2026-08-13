#!/usr/bin/env node
import fs from "fs";
import zlib from "zlib";
import crypto from "crypto";
const p0 = fs.readFileSync("tools/order8c-index.gz.b64.p0", "utf8").trim();
const p1 = fs.readFileSync("tools/order8c-index.gz.b64.p1", "utf8").trim();
const p2 = fs.readFileSync("tools/order8c-index.gz.b64.p2", "utf8").trim();
const p3 = fs.readFileSync("tools/order8c-index.gz.b64.p3", "utf8").trim();
const b64 = p0 + p1 + p2 + p3;
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
