#!/usr/bin/env node
import fs from "fs";
import path from "path";
const ROOT = process.env.ORDER5A_ROOT || process.cwd();
const dir = path.join(ROOT, "tools/order5a-text-parts");
function join(prefix, n, dest) {
  const chunks = [];
  for (let i = 0; i < n; i++) {
    const p = path.join(dir, `${prefix}.p${String(i).padStart(2,"0")}.bin.b64`);
    if (!fs.existsSync(p)) throw new Error("missing " + p);
    chunks.push(Buffer.from(fs.readFileSync(p, "utf8").trim(), "base64"));
  }
  const raw = Buffer.concat(chunks);
  const out = path.join(ROOT, dest);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, raw);
  console.log("wrote", dest, raw.length);
  return raw.length;
}
const m = join("mod", 4, "supabase/functions/weekly-plan/everyday-language-reasoning.ts");
const t = join("test", 3, "tools/order5a-everyday-language-test.mjs");
if (m !== 21497) { console.error("mod size mismatch", m); process.exit(1); }
if (t < 10000) { console.error("test size mismatch", t); process.exit(1); }
console.log("BIN_MATERIALIZE_OK");
