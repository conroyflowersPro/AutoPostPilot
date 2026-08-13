#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const manifest = JSON.parse(fs.readFileSync("tools/v11-manifest.json", "utf8"));
for (const item of manifest) {
  const b64 = item.parts.map((p) => fs.readFileSync(p, "utf8")).join("");
  const buf = Buffer.from(b64, "base64");
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  if (sha !== item.sha256) { console.error("SHA mismatch", item.path, sha, item.sha256); process.exit(1); }
  fs.mkdirSync(path.dirname(item.path), { recursive: true });
  fs.writeFileSync(item.path, buf);
  console.log("OK", item.path, sha);
}
console.log("V11 MATERIALIZED", manifest.length);
