#!/usr/bin/env node
import fs from "fs";
import path from "path";
import zlib from "zlib";
const ROOT = process.env.ORDER5A_ROOT || process.cwd();
const partsDir = path.join(ROOT, "tools/order5a-parts");

function materialize(prefix, destRel, expectedParts, expectSize) {
  const chunks = [];
  for (let i = 0; i < expectedParts; i++) {
    const p = path.join(partsDir, `${prefix}.p${String(i).padStart(2, "0")}.b64`);
    if (!fs.existsSync(p)) throw new Error("missing part " + p);
    chunks.push(fs.readFileSync(p, "utf8").trim());
  }
  const b64 = chunks.join("");
  const gz = Buffer.from(b64, "base64");
  const raw = zlib.gunzipSync(gz);
  const dest = path.join(ROOT, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, raw);
  console.log("wrote", destRel, raw.length, "bytes");
  if (expectSize && raw.length !== expectSize) {
    console.error("size mismatch", raw.length, expectSize);
    process.exit(1);
  }
  return raw.length;
}

materialize("everyday-language-reasoning.ts", "supabase/functions/weekly-plan/everyday-language-reasoning.ts", 6, 21497);
materialize("order5a-everyday-language-test.mjs", "tools/order5a-everyday-language-test.mjs", 5, 13331);
console.log("MATERIALIZE_OK");
