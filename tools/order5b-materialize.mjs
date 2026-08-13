#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = process.env.GITHUB_WORKSPACE || resolve(dirname(fileURLToPath(import.meta.url)), "..");
function materialize(manifestPath, partsDir) {
  const manifest = JSON.parse(readFileSync(resolve(root, manifestPath), "utf8"));
  const files = readdirSync(resolve(root, partsDir)).filter(f => f.endsWith(".b64")).sort();
  if (files.length !== manifest.parts) { console.error("part count", files.length, manifest.parts); process.exit(1); }
  let b64 = "";
  for (const f of files) b64 += readFileSync(resolve(root, partsDir, f), "utf8").trim();
  const raw = gunzipSync(Buffer.from(b64, "base64"));
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== manifest.sha256) { console.error("SHA", sha, manifest.sha256); process.exit(1); }
  mkdirSync(dirname(resolve(root, manifest.file)), { recursive: true });
  writeFileSync(resolve(root, manifest.file), raw);
  console.log("materialized", manifest.file, "bytes", raw.length, "sha", sha);
}
materialize("tools/order5b-mod-manifest.json", "tools/order5b-mod-parts");
materialize("tools/order5b-manifest.json", "tools/order5b-parts");
