/**
 * ORDER 0B — materialize weekly-plan/index.ts from gzip+b64 part (one-shot).
 * node tools/order0b-materialize-index.cjs
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const root = path.join(__dirname, "..");
const b64 = fs.readFileSync(path.join(__dirname, "order0b-index.gz.b64"), "utf8").trim();
const out = path.join(root, "supabase/functions/weekly-plan/index.ts");
const buf = zlib.gunzipSync(Buffer.from(b64, "base64"));
fs.writeFileSync(out, buf);
console.log("wrote", out, buf.length, "bytes");
