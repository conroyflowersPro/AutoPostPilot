#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";
import { execSync } from "child_process";

const ROOT = process.cwd();
const tools = path.join(ROOT, "tools");

for (const base of ["order5c-mod.patch", "order5c-index.patch"]) {
  const gz = path.join(tools, base + ".gz.b64");
  if (fs.existsSync(gz)) {
    const data = zlib.gunzipSync(Buffer.from(fs.readFileSync(gz, "utf8").trim(), "base64"));
    fs.writeFileSync(path.join(tools, base), data);
    console.log("expanded", base, data.length);
  }
}

const wantIdx = "13a685609847a4b9ce669af52a0da3d89bb09ee3ba0d1ff4a268716ce9bfdc2f";
const wantMod = "8709dbd57f319b2554a4c59401a918b7b16200c74d5f4bdbd10c7c27fda0ccfc";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function applyPatch(name) {
  const p = path.join(tools, name);
  if (!fs.existsSync(p)) throw new Error("missing " + name);
  execSync(`patch -p1 --forward --batch -i "${p}"`, { cwd: ROOT, stdio: "inherit" });
}

const idxPath = "supabase/functions/weekly-plan/index.ts";
const modPath = "supabase/functions/weekly-plan/everyday-language-reasoning.ts";
console.log("before", fs.readFileSync(idxPath).length, fs.readFileSync(modPath).length);
applyPatch("order5c-mod.patch");
applyPatch("order5c-index.patch");
const idx = fs.readFileSync(idxPath);
const mod = fs.readFileSync(modPath);
const gi = sha256(idx), gm = sha256(mod);
console.log("after index", idx.length, gi);
console.log("after module", mod.length, gm);
if (gi !== wantIdx) throw new Error("index SHA mismatch");
if (gm !== wantMod) throw new Error("module SHA mismatch");
console.log("ORDER5C materialize complete");
