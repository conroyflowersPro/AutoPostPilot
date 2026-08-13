import { readFileSync, writeFileSync, readdirSync } from "fs";
import { gunzipSync } from "zlib";
const dir = "tools/order7c-index-parts";
const files = readdirSync(dir).filter(f => f.endsWith(".b64")).sort();
const b64 = files.map(f => readFileSync(dir + "/" + f, "utf8")).join("");
const buf = gunzipSync(Buffer.from(b64, "base64"));
writeFileSync("supabase/functions/weekly-plan/index.ts", buf);
console.log("assembled", buf.length);
