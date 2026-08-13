#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";
import { execSync } from "child_process";

const ROOT = process.cwd();
const tools = path.join(ROOT, "tools");

const partFiles = fs.readdirSync(tools).filter((f) => /^order6a-style-module\.gz\.b64\.p\d+$/.test(f)).sort();
if (partFiles.length) {
  const joined = partFiles.map((f) => fs.readFileSync(path.join(tools, f), "utf8").trim()).join("");
  fs.writeFileSync(path.join(tools, "order6a-style-module.gz.b64"), joined);
  console.log("joined module parts", partFiles.length);
}

const wantMod = "53ff0224215459967e57a54efb6d39564490c41184e1ac7f49c13008482711c0";
const wantIdx = "27abda7e16c2556de18f5740a1eafbe045bbe3796614fb2d257e22b1061aef61";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

const gz = path.join(tools, "order6a-style-module.gz.b64");
if (fs.existsSync(gz)) {
  const data = zlib.gunzipSync(Buffer.from(fs.readFileSync(gz, "utf8").trim(), "base64"));
  const out = path.join(ROOT, "supabase/functions/weekly-plan/creator-style-decision.ts");
  fs.writeFileSync(out, data);
  console.log("module", data.length, sha256(data));
  if (sha256(data) !== wantMod) throw new Error("module SHA mismatch");
}

const patch = path.join(tools, "order6a-index.patch");
if (fs.existsSync(patch)) {
  try {
    execSync(`patch -p1 --forward --batch -i "${patch}"`, { cwd: ROOT, stdio: "inherit" });
  } catch (e) {
    console.log("index patch note:", e.message);
  }
}
const idx = fs.readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"));
console.log("index", idx.length, sha256(idx));
if (sha256(idx) !== wantIdx) throw new Error("index SHA mismatch");
console.log("ORDER6A materialize complete");
